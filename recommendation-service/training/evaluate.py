from __future__ import annotations

import logging
from math import log2
from typing import Optional

import pandas as pd

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
    top_n: int = 20,
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