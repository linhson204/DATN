from __future__ import annotations

import logging
from math import log2
from typing import Optional

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix

from models.lightfm_model import LightFMRecommender

logger = logging.getLogger(__name__)


# ======================================================================
# Huấn luyện và đánh giá theo thời gian (time-based split)
# ======================================================================


def time_based_split(interactions: pd.DataFrame, holdout_days: int = 10) -> tuple[pd.DataFrame, pd.DataFrame]:
    if interactions.empty:
        return interactions.copy(), interactions.copy()

    interactions = interactions.copy()
    interactions["created_at"] = pd.to_datetime(interactions["created_at"], errors="coerce")
    interactions = interactions.dropna(subset=["created_at"]).sort_values("created_at")

    if interactions.empty:
        return interactions.copy(), interactions.copy()

    cutoff = interactions["created_at"].max() - pd.Timedelta(days=holdout_days)
    train_df = interactions[interactions["created_at"] < cutoff].copy()
    test_df = interactions[interactions["created_at"] >= cutoff].copy()

    return train_df, test_df



# ======================================================================
# Các chỉ số đánh giá chính (precision@k, recall@k, ndcg@k)
# ======================================================================


def _precision_at_k(recommended: list[str], relevant: set[str], k: int) -> float:
    top_k = recommended[:k]
    if not top_k:
        return 0.0
    hits = sum(1 for item in top_k if item in relevant)
    return hits / float(k)


def _recall_at_k(recommended: list[str], relevant: set[str], k: int) -> float:
    if not relevant:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / float(len(relevant))


def _ndcg_at_k(recommended: list[str], relevant: set[str], k: int) -> float:
    top_k = recommended[:k]
    if not top_k or not relevant:
        return 0.0

    dcg = 0.0
    for rank, item_id in enumerate(top_k, start=1):
        if item_id in relevant:
            dcg += 1.0 / log2(rank + 1)

    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / log2(rank + 1) for rank in range(1, ideal_hits + 1))
    if idcg == 0:
        return 0.0
    return dcg / idcg


# ======================================================================
# Các chỉ số đánh giá bổ sung (catalog coverage, novelty)
# ======================================================================


def _catalog_coverage(rankings: dict[str, list[str]], total_items: int, k: int) -> float:
    """
    Tỷ lệ các mặt hàng trong danh mục xuất hiện trong danh sách top-k của *bất kỳ* người dùng nào.

    Đo lường mức độ bao quát của mô hình trong việc khám phá danh mục.

    Giá trị 0,05 có nghĩa là chỉ có 5% sản phẩm được đề xuất.
    """
    if total_items == 0:
        return 0.0
    recommended_items: set[str] = set()
    for items in rankings.values():
        recommended_items.update(items[:k])
    return len(recommended_items) / total_items


def _item_popularity(train_df: pd.DataFrame) -> dict[str, float]:
    """Tính độ phổ biến của từng sản phẩm."""
    total_users = train_df["user_id"].nunique()
    if total_users == 0:
        return {}
    item_user_counts = train_df.groupby("product_id")["user_id"].nunique()
    return {str(pid): count / total_users for pid, count in item_user_counts.items()}


def _novelty_at_k(rankings: dict[str, list[str]], item_pop: dict[str, float], k: int) -> float:
    """Tính mức độ mới mẻ của các sản phẩm được đề xuất: trung bình của self-information.

    Giá trị cao → mô hình đề xuất các sản phẩm ít phổ biến (mới hơn).
    Một mô hình dựa hoàn toàn trên độ phổ biến sẽ có điểm thấp ở đây.
    """
    values: list[float] = []
    for items in rankings.values():
        for item_id in items[:k]:
            pop = item_pop.get(item_id, 0.0)
            if pop > 0:
                values.append(-log2(pop))
    return sum(values) / len(values) if values else 0.0


# ======================================================================
# Helper functions để xây dựng ground truth và tóm tắt các chỉ số đánh giá
# ======================================================================


def _ground_truth(test_df: pd.DataFrame) -> dict[str, set[str]]:
    grouped = test_df.groupby("user_id")["product_id"].apply(lambda values: set(values.astype(str))).to_dict()
    return {str(user_id): product_ids for user_id, product_ids in grouped.items()}


def _summarize_accuracy(
    rankings: dict[str, list[str]],
    truth: dict[str, set[str]],
    k_precision: int = 10,
    k_recall: int = 20,
    k_ndcg: int = 10,
) -> dict[str, float]:
    users = list(truth.keys())
    if not users:
        return {
            f"precision@{k_precision}": 0.0,
            f"recall@{k_recall}": 0.0,
            f"ndcg@{k_ndcg}": 0.0,
        }

    precision_values: list[float] = []
    recall_values: list[float] = []
    ndcg_values: list[float] = []

    for user_id in users:
        recommended = rankings.get(user_id, [])
        relevant = truth.get(user_id, set())
        precision_values.append(_precision_at_k(recommended, relevant, k_precision))
        recall_values.append(_recall_at_k(recommended, relevant, k_recall))
        ndcg_values.append(_ndcg_at_k(recommended, relevant, k_ndcg))

    return {
        f"precision@{k_precision}": float(sum(precision_values) / len(precision_values)),
        f"recall@{k_recall}": float(sum(recall_values) / len(recall_values)),
        f"ndcg@{k_ndcg}": float(sum(ndcg_values) / len(ndcg_values)),
    }


def _add_beyond_accuracy(
    metrics: dict[str, float],
    rankings: dict[str, list[str]],
    train_df: pd.DataFrame,
    k: int = 10,
) -> dict[str, float]:
    """Thêm các chỉ số đánh giá bổ sung (catalog coverage, novelty) vào kết quả."""
    total_items = train_df["product_id"].nunique()
    metrics[f"catalog_coverage@{k}"] = _catalog_coverage(rankings, total_items, k)

    item_pop = _item_popularity(train_df)
    metrics[f"novelty@{k}"] = _novelty_at_k(rankings, item_pop, k)
    return metrics


# ======================================================================
# Hàm đánh giá chính cho các mô hình khác nhau (popular baseline, LightFM)
# ======================================================================


def evaluate_popular_baseline(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    k_precision: int = 10,
    k_recall: int = 20,
    k_ndcg: int = 10,
) -> dict[str, float]:
    truth = _ground_truth(test_df)
    if not truth:
        return _summarize_accuracy({}, {}, k_precision=k_precision, k_recall=k_recall, k_ndcg=k_ndcg)

    popular_items = (
        train_df.groupby("product_id", as_index=False)["weight"]
        .sum()
        .sort_values("weight", ascending=False)["product_id"]
        .astype(str)
        .tolist()
    )

    rankings = {user_id: popular_items for user_id in truth.keys()}

    metrics = _summarize_accuracy(
        rankings,
        truth,
        k_precision=k_precision,
        k_recall=k_recall,
        k_ndcg=k_ndcg,
    )
    metrics = _add_beyond_accuracy(metrics, rankings, train_df, k=k_precision)
    return metrics


def evaluate_lightfm(
    model: LightFMRecommender,
    test_df: pd.DataFrame,
    train_df: Optional[pd.DataFrame] = None,
    top_n: int = 30,
    k_precision: int = 10,
    k_recall: int = 20,
    k_ndcg: int = 10,
) -> dict[str, float]:
    truth = _ground_truth(test_df)
    if not truth:
        return _summarize_accuracy({}, {}, k_precision=k_precision, k_recall=k_recall, k_ndcg=k_ndcg)

    rankings: dict[str, list[str]] = {}
    for user_id in truth.keys():
        recommendations = model.recommend_for_user(user_id, top_n=top_n)
        rankings[user_id] = [item_id for item_id, _ in recommendations]

    metrics = _summarize_accuracy(
        rankings,
        truth,
        k_precision=k_precision,
        k_recall=k_recall,
        k_ndcg=k_ndcg,
    )

    if train_df is not None:
        metrics = _add_beyond_accuracy(metrics, rankings, train_df, k=k_precision)

    return metrics


# ======================================================================
# Content-Based Filtering (TF-IDF cosine similarity trên item features)
# ======================================================================


def evaluate_content_based(
    item_feature_tuples: list[tuple[str, list[str]]],
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    top_n: int = 30,
    k_precision: int = 10,
    k_recall: int = 20,
    k_ndcg: int = 10,
) -> dict[str, float]:
    """
    Đánh giá Content-Based Filtering dùng TF-IDF cosine similarity.

    Cách hoạt động:
    - Xây dựng TF-IDF vector từ item feature tokens (brand, category, material, price…).
    - Với mỗi user trong test: tổng hợp user profile = trung bình vector của
      các sản phẩm user đã tương tác trong train set.
    - Ranking = cosine similarity giữa user profile và tất cả item vectors.
    - Không dùng hành vi của user khác → đúng nghĩa Content-Based.
    """
    truth = _ground_truth(test_df)
    if not truth:
        return _summarize_accuracy({}, {}, k_precision=k_precision, k_recall=k_recall, k_ndcg=k_ndcg)

    if not item_feature_tuples:
        logger.warning("[Content-Based] item_feature_tuples rỗng, trả về metrics=0")
        return _summarize_accuracy({}, truth, k_precision=k_precision, k_recall=k_recall, k_ndcg=k_ndcg)

    # --- Bước 1: Xây dựng vocabulary (tập từ) từ tất cả feature tokens ---
    item_ids: list[str] = []
    item_token_lists: list[list[str]] = []
    for item_id, tokens in item_feature_tuples:
        item_ids.append(str(item_id))
        item_token_lists.append(tokens)

    all_tokens = sorted({tok for tokens in item_token_lists for tok in tokens})
    if not all_tokens:
        logger.warning("[Content-Based] Không có token nào trong item features")
        return _summarize_accuracy({}, truth, k_precision=k_precision, k_recall=k_recall, k_ndcg=k_ndcg)

    token_index: dict[str, int] = {tok: idx for idx, tok in enumerate(all_tokens)}
    n_items = len(item_ids)
    n_tokens = len(all_tokens)
    item_index: dict[str, int] = {item_id: idx for idx, item_id in enumerate(item_ids)}

    # --- Bước 2: Xây dựng TF matrix (term frequency) ---
    # TF: tần suất xuất hiện của token trong feature list của item (binary: 0 hoặc 1)
    rows_idx: list[int] = []
    cols_idx: list[int] = []
    for i, tokens in enumerate(item_token_lists):
        for tok in tokens:
            col = token_index.get(tok)
            if col is not None:
                rows_idx.append(i)
                cols_idx.append(col)

    tf_matrix = csr_matrix(
        (np.ones(len(rows_idx)), (rows_idx, cols_idx)),
        shape=(n_items, n_tokens),
        dtype=np.float32,
    )

    # --- Bước 3: Tính IDF và TF-IDF ---
    # IDF: log((1 + n_items) / (1 + df)) + 1, với df = số item chứa token đó
    df = np.diff(tf_matrix.tocsc().indptr)  # document frequency per token
    idf = np.log((1.0 + n_items) / (1.0 + df)) + 1.0  # (n_items + 1)
    tfidf_matrix = tf_matrix.multiply(idf)  # broadcast IDF vào từng hàng

    # L2-normalize từng hàng để dùng dot product = cosine similarity
    row_norms = np.asarray(np.sqrt(tfidf_matrix.multiply(tfidf_matrix).sum(axis=1))).ravel()
    row_norms[row_norms == 0] = 1.0
    tfidf_dense = tfidf_matrix.toarray() / row_norms[:, np.newaxis]  # shape (n_items, n_tokens)

    # --- Bước 4: Build user interaction map từ train set ---
    train_user_items: dict[str, list[str]] = (
        train_df.copy()
        .assign(user_id=lambda d: d["user_id"].astype(str),
                product_id=lambda d: d["product_id"].astype(str))
        .groupby("user_id")["product_id"]
        .apply(list)
        .to_dict()
    )

    # --- Bước 5: Với mỗi user, tính user profile và xếp hạng ---
    rankings: dict[str, list[str]] = {}
    skipped = 0
    for user_id in truth.keys():
        user_train_items = train_user_items.get(str(user_id), [])
        known_indices = [
            item_index[pid] for pid in user_train_items if pid in item_index
        ]
        if not known_indices:
            # Cold-start: không có thông tin trong train → skip
            skipped += 1
            rankings[user_id] = []
            continue

        # User profile = trung bình L2-normalized TF-IDF vectors của item đã tương tác
        user_vec = tfidf_dense[known_indices].mean(axis=0)  # shape (n_tokens,)
        user_norm = float(np.linalg.norm(user_vec))
        if user_norm > 0:
            user_vec = user_vec / user_norm

        # Cosine similarity = dot product (vì tfidf_dense đã L2-normalized)
        sims = tfidf_dense @ user_vec  # shape (n_items,)

        # Loại các item đã tương tác trong train
        interacted_set = set(user_train_items)
        for pid in interacted_set:
            idx = item_index.get(pid)
            if idx is not None:
                sims[idx] = -np.inf

        # Lấy top_n item có similarity cao nhất
        valid_mask = np.isfinite(sims)
        valid_count = int(valid_mask.sum())
        if valid_count == 0:
            rankings[user_id] = []
            continue

        effective_n = min(top_n, valid_count)
        top_indices = np.argpartition(sims, -effective_n)[-effective_n:]
        top_indices = top_indices[np.argsort(sims[top_indices])[::-1]]
        rankings[user_id] = [item_ids[int(i)] for i in top_indices]

    if skipped > 0:
        logger.info("[Content-Based] %d/%d test users bị skip (cold-start)", skipped, len(truth))

    metrics = _summarize_accuracy(
        rankings, truth,
        k_precision=k_precision,
        k_recall=k_recall,
        k_ndcg=k_ndcg,
    )
    metrics = _add_beyond_accuracy(metrics, rankings, train_df, k=k_precision)
    return metrics


# ======================================================================
# Collaborative Filtering thuần túy (LightFM không có side features)
# ======================================================================


def evaluate_collaborative(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    no_components: int = 64,
    loss: str = "warp",
    learning_rate: float = 0.05,
    item_alpha: float = 1e-5,
    user_alpha: float = 1e-5,
    epochs: int = 80,
    num_threads: int = 4,
    random_state: int | None = None,
    top_n: int = 30,
    k_precision: int = 10,
    k_recall: int = 20,
    k_ndcg: int = 10,
) -> dict[str, float]:
    """
    Đánh giá Collaborative Filtering thuần túy: LightFM train không có
    item features và user features (chỉ dùng ma trận tương tác user-item).

    Dùng cùng hyperparameters với hybrid để so sánh công bằng — sự khác biệt
    duy nhất là không có side information (features).
    """
    truth = _ground_truth(test_df)
    if not truth:
        return _summarize_accuracy({}, {}, k_precision=k_precision, k_recall=k_recall, k_ndcg=k_ndcg)

    logger.info(
        "[CF-only] Training LightFM without features "
        "(components=%d, loss=%s, lr=%.4f, epochs=%d)...",
        no_components, loss, learning_rate, epochs,
    )

    cf_model = LightFMRecommender(
        no_components=no_components,
        loss=loss,
        learning_rate=learning_rate,
        item_alpha=item_alpha,
        user_alpha=user_alpha,
        epochs=epochs,
        num_threads=num_threads,
        random_state=random_state,
    )
    # Fit không truyền item/user feature tuples → CF-only
    cf_model.fit(
        train_df,
        item_feature_tuples=None,
        user_feature_tuples=None,
    )

    rankings: dict[str, list[str]] = {}
    for user_id in truth.keys():
        recommendations = cf_model.recommend_for_user(user_id, top_n=top_n)
        rankings[user_id] = [item_id for item_id, _ in recommendations]

    metrics = _summarize_accuracy(
        rankings, truth,
        k_precision=k_precision,
        k_recall=k_recall,
        k_ndcg=k_ndcg,
    )
    metrics = _add_beyond_accuracy(metrics, rankings, train_df, k=k_precision)
    return metrics