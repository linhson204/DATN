from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import joblib
import pandas as pd

from config import settings
from data.data_pipeline import build_engine, extract_interactions, extract_order_interactions, save_interactions
from data.feature_engineering import item_feature_tuples_for_catalog, user_feature_tuples_for_users
from data.season import build_item_season_map
from models.fallback import PopularItemsFallback
from models.lightfm_model import LightFMRecommender
from training.evaluate import (
    evaluate_content_based,
    evaluate_collaborative,
    evaluate_lightfm,
    evaluate_popular_baseline,
    time_based_split,
)

logger = logging.getLogger(__name__)


def train_pipeline(mysql_url: str | None = None) -> dict[str, dict[str, float]]:
    """
    Pipeline huấn luyện hoàn chỉnh:
    1. Trích xuất dữ liệu tương tác từ MySQL.
    2. Chia dữ liệu theo thời gian (time-based split).
    3. Chuẩn bị feature cho sản phẩm và người dùng (giới tính, nhóm tuổi).
    4. Huấn luyện mô hình LightFM.
    5. Xây dựng danh sách fallback (sản phẩm phổ biến/trending) cho cold-start.
    6. Đánh giá hiệu năng và lưu kết quả.
    """
    engine = build_engine(mysql_url)

    # ------------------------------------------------------------------
    # 1. Trích xuất dữ liệu tương tác từ MySQL
    # ------------------------------------------------------------------
    logger.info("Extracting interactions from database...")
    interactions = extract_interactions(engine)
    orders = extract_order_interactions(engine)

    if interactions.empty:
        raise RuntimeError("No interactions found. Check source tables and lookback windows.")

    logger.info(
        "Total interactions: %d rows, %d unique users, %d unique items",
        len(interactions),
        interactions["user_id"].nunique(),
        interactions["product_id"].nunique(),
    )

    save_interactions(interactions, settings.interactions_output_path)
    logger.info("Interactions saved to %s", settings.interactions_output_path)

    order_history: dict[str, list[str]] = {}
    if not orders.empty:
        orders = orders.copy()
        orders["user_id"] = orders["user_id"].astype(str)
        orders["product_id"] = orders["product_id"].astype(str)
        orders["created_at"] = pd.to_datetime(orders["created_at"], errors="coerce")
        orders = orders.dropna(subset=["user_id", "product_id", "created_at"])
        orders = orders.sort_values("created_at", ascending=False, kind="stable")

        for user_id, group in orders.groupby("user_id", sort=False):
            seen: set[str] = set()
            ordered_items: list[str] = []
            for product_id in group["product_id"].tolist():
                if product_id in seen:
                    continue
                seen.add(product_id)
                ordered_items.append(product_id)
            order_history[str(user_id)] = ordered_items

    order_history_path = Path(settings.artifact_dir) / "user_order_history.joblib"
    order_history_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(order_history, order_history_path)
    logger.info("Order history saved to %s (%d users)", order_history_path, len(order_history))

    # ------------------------------------------------------------------
    # 2. Chia dữ liệu theo thời gian (time-based split)
    # ------------------------------------------------------------------
    train_df, test_df = time_based_split(interactions, holdout_days=settings.split_holdout_days)
    if train_df.empty or test_df.empty:
        raise RuntimeError("Time-based split produced an empty train or test set.")

    logger.info(
        "Split: train=%d rows (%d users, %d items), test=%d rows (%d users, %d items), holdout=%d days",
        len(train_df),
        train_df["user_id"].nunique(),
        train_df["product_id"].nunique(),
        len(test_df),
        test_df["user_id"].nunique(),
        test_df["product_id"].nunique(),
        settings.split_holdout_days,
    )

    # ------------------------------------------------------------------
    # 3. Chuẩn bị feature cho sản phẩm và người dùng
    # ------------------------------------------------------------------
    train_item_ids = set(train_df["product_id"].astype(str).tolist())
    item_features = item_feature_tuples_for_catalog(engine, allowed_item_ids=train_item_ids)
    logger.info("Item features prepared: %d items with features", len(item_features))

    train_user_ids = set(train_df["user_id"].astype(str).tolist())
    user_features = user_feature_tuples_for_users(engine, allowed_user_ids=train_user_ids)
    logger.info("User features prepared: %d users with features", len(user_features))

    # ------------------------------------------------------------------
    # 4. Huấn luyện mô hình LightFM
    # ------------------------------------------------------------------
    recommender = LightFMRecommender(
        no_components=settings.lightfm_no_components,
        loss=settings.lightfm_loss,
        learning_rate=settings.lightfm_learning_rate,
        item_alpha=settings.lightfm_item_alpha,
        user_alpha=settings.lightfm_user_alpha,
        epochs=settings.lightfm_epochs,
        num_threads=settings.lightfm_num_threads,
        random_state=settings.lightfm_random_state,
    )

    logger.info(
        "Training LightFM (components=%d, loss=%s, lr=%.4f, epochs=%d)...",
        settings.lightfm_no_components,
        settings.lightfm_loss,
        settings.lightfm_learning_rate,
        settings.lightfm_epochs,
    )
    recommender.fit(
        train_df,
        item_feature_tuples=item_features,
        user_feature_tuples=user_features,
    )
    recommender.user_order_history = order_history

    # Gắn mapping product_id -> mùa vào recommender trước khi lưu artifact
    logger.info("Building item season map from product_attributes...")
    item_seasons = build_item_season_map(engine)
    recommender.set_item_seasons(item_seasons)
    logger.info("Item season map: %d products with season info", len(item_seasons))

    recommender.save_artifacts(settings.artifact_dir)

    # ------------------------------------------------------------------
    # 5. Xây dựng danh sách fallback (sản phẩm phổ biến/trending) cho cold-start
    # ------------------------------------------------------------------
    logger.info("Building cold-start fallback lists...")
    fallback = PopularItemsFallback.build_from_data(
        interactions=train_df,
        engine=engine,
        trending_days=settings.fallback_trending_days,
        top_n=settings.fallback_top_n,
    )
    fallback.save(settings.fallback_data_path)

    # ------------------------------------------------------------------
    # 6. Đánh giá mô hình — so sánh 4 phương pháp
    # ------------------------------------------------------------------
    logger.info("Evaluating models (4 methods)...")

    # 6a. Popular Baseline
    logger.info("  [1/4] Popular Baseline...")
    popular_metrics = evaluate_popular_baseline(train_df, test_df)

    # 6b. Content-Based Filtering (TF-IDF cosine similarity)
    logger.info("  [2/4] Content-Based Filtering (TF-IDF)...")
    cb_metrics = evaluate_content_based(
        item_feature_tuples=item_features,
        train_df=train_df,
        test_df=test_df,
    )

    # 6c. Collaborative Filtering thuần túy (LightFM không features)
    logger.info("  [3/4] Collaborative Filtering (LightFM no-features)...")
    cf_metrics = evaluate_collaborative(
        train_df=train_df,
        test_df=test_df,
        no_components=settings.lightfm_no_components,
        loss=settings.lightfm_loss,
        learning_rate=settings.lightfm_learning_rate,
        item_alpha=settings.lightfm_item_alpha,
        user_alpha=settings.lightfm_user_alpha,
        epochs=settings.lightfm_epochs,
        num_threads=settings.lightfm_num_threads,
        random_state=settings.lightfm_random_state,
    )

    # 6d. Hybrid (LightFM đầy đủ item + user features)
    logger.info("  [4/4] Hybrid LightFM (item + user features)...")
    hybrid_metrics = evaluate_lightfm(recommender, test_df, train_df=train_df)

    metrics = {
        "popular": popular_metrics,
        "content_based": cb_metrics,
        "collaborative": cf_metrics,
        "lightfm_hybrid": hybrid_metrics,
    }

    logger.info("-" * 60)
    logger.info("Evaluation summary (4 methods):")
    for model_name, model_metrics in metrics.items():
        logger.info("  %-20s %s", model_name, json.dumps(model_metrics, indent=None))
    logger.info("-" * 60)

    metrics_path = Path(settings.artifact_dir) / "metrics.json"
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    logger.info("Metrics saved to %s", metrics_path)

    return metrics


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(description="Train LightFM model and export artifacts.")
    parser.add_argument("--mysql-url", dest="mysql_url", default=None)
    args = parser.parse_args()

    metrics = train_pipeline(mysql_url=args.mysql_url)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()