from __future__ import annotations

import argparse
import json
import logging
import time
from itertools import product
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

from config import settings
from data.data_pipeline import (
    build_engine,
    extract_view_interactions,
    extract_order_interactions,
    extract_wishlist_interactions,
    combine_interactions,
)
from data.feature_engineering import item_feature_tuples_for_catalog, user_feature_tuples_for_users
from data.season import build_item_season_map
from models.lightfm_model import LightFMRecommender
from training.evaluate import evaluate_lightfm

logger = logging.getLogger(__name__)

# Edit these lists to test different values.
# Example: lightfm_no_components = [64, 100, 128]
PARAM_GRID: dict[str, list[Any]] = {
    "lightfm_no_components": [64, 128],
    "lightfm_loss": ["warp"],
    "lightfm_learning_rate": [0.05],
    "lightfm_epochs": [50, 60, 80],
    "lightfm_num_threads": [4],
    "lightfm_alpha": [1e-4, 1e-5, 1e-6],
}


def _iter_param_grid(base: dict[str, Any], grid: dict[str, Iterable[Any]]) -> Iterable[dict[str, Any]]:
    keys = list(grid.keys())
    values_list: list[list[Any]] = []
    for key in keys:
        values = list(grid[key])
        if not values:
            raise ValueError(f"Grid for {key} is empty")
        values_list.append(values)

    for values in product(*values_list):
        params = base.copy()
        for key, value in zip(keys, values):
            params[key] = value
        yield params


def run_tuning(mysql_url: str | None, top_n: int) -> pd.DataFrame:
    engine = build_engine(mysql_url)

    # ------------------------------------------------------------------
    # Trích xuất từng nguồn tín hiệu thô (chưa aggregate)
    # ------------------------------------------------------------------
    logger.info("Extracting raw interactions from database...")
    views = extract_view_interactions(engine)
    orders_raw = extract_order_interactions(engine)

    wishlist: pd.DataFrame | None = None
    try:
        wishlist = extract_wishlist_interactions(engine)
        logger.info("Extracted %d wishlist interactions", len(wishlist))
    except Exception:
        logger.warning("Failed to extract wishlist interactions, skipping")

    all_raw = pd.concat(
        [df for df in [views, orders_raw, wishlist] if df is not None and not df.empty],
        ignore_index=True,
    )
    if all_raw.empty:
        raise RuntimeError("No interactions found. Check source tables and lookback windows.")

    all_raw["created_at"] = pd.to_datetime(all_raw["created_at"], errors="coerce")
    all_raw = all_raw.dropna(subset=["created_at"])

    # ------------------------------------------------------------------
    # Split ở mức RAW EVENTS (trước khi aggregate)
    # ------------------------------------------------------------------
    # Đây là điểm mấu chốt: nếu aggregate trước rồi mới split (dùng MAX timestamp),
    # các sản phẩm được xem nhiều lần trong train period nhưng cũng xem gần đây
    # sẽ bị đưa toàn bộ vào test_df → model không có training signal → metric thấp giả tạo.
    cutoff = all_raw["created_at"].max() - pd.Timedelta(days=settings.split_holdout_days)
    logger.info(
        "Time split: cutoff=%s (holdout=%d days), train=%d events, test=%d events",
        cutoff.date(),
        settings.split_holdout_days,
        int((all_raw["created_at"] < cutoff).sum()),
        int((all_raw["created_at"] >= cutoff).sum()),
    )

    def _split_signal(df: pd.DataFrame, signal: str) -> pd.DataFrame:
        if df is None or df.empty:
            return pd.DataFrame()
        if "signal" not in df.columns:
            return df
        return df[df["signal"].str.upper() == signal].copy()

    train_views  = _split_signal(views[views["created_at"] < cutoff] if not views.empty else views, "VIEW")
    train_orders = _split_signal(orders_raw[orders_raw["created_at"] < cutoff] if not orders_raw.empty else orders_raw, "ORDER")
    train_wish   = _split_signal(wishlist[wishlist["created_at"] < cutoff] if wishlist is not None and not wishlist.empty else pd.DataFrame(), "WISHLIST")

    test_views   = _split_signal(views[views["created_at"] >= cutoff] if not views.empty else views, "VIEW")
    test_orders  = _split_signal(orders_raw[orders_raw["created_at"] >= cutoff] if not orders_raw.empty else orders_raw, "ORDER")
    test_wish    = _split_signal(wishlist[wishlist["created_at"] >= cutoff] if wishlist is not None and not wishlist.empty else pd.DataFrame(), "WISHLIST")

    train_df = combine_interactions(train_views, train_orders, train_wish if not train_wish.empty else None)
    test_df  = combine_interactions(test_views,  test_orders,  test_wish  if not test_wish.empty  else None)

    if train_df.empty or test_df.empty:
        raise RuntimeError("Time-based split produced an empty train or test set.")

    logger.info(
        "Split result: train=%d rows (%d users, %d items), test=%d rows (%d users, %d items)",
        len(train_df), train_df["user_id"].nunique(), train_df["product_id"].nunique(),
        len(test_df),  test_df["user_id"].nunique(),  test_df["product_id"].nunique(),
    )

    # ------------------------------------------------------------------
    # Chuẩn bị features và metadata dùng chung cho mọi tổ hợp tham số
    # ------------------------------------------------------------------
    train_item_ids = set(train_df["product_id"].astype(str).tolist())
    item_features = item_feature_tuples_for_catalog(engine, allowed_item_ids=train_item_ids)
    logger.info("Item features prepared: %d items with features", len(item_features))

    train_user_ids = set(train_df["user_id"].astype(str).tolist())
    user_features = user_feature_tuples_for_users(engine, allowed_user_ids=train_user_ids)
    logger.info("User features prepared: %d users with features", len(user_features))

    # order_history: lấy từ toàn bộ DB (giống train.py) để điều kiện inference khớp production.
    order_history: dict[str, list[str]] = {}
    if not orders_raw.empty:
        _orders = orders_raw.copy()
        _orders["user_id"] = _orders["user_id"].astype(str)
        _orders["product_id"] = _orders["product_id"].astype(str)
        _orders["created_at"] = pd.to_datetime(_orders["created_at"], errors="coerce")
        _orders = _orders.dropna(subset=["user_id", "product_id", "created_at"])
        _orders = _orders.sort_values("created_at", ascending=False, kind="stable")
        for user_id, group in _orders.groupby("user_id", sort=False):
            seen: set[str] = set()
            ordered_items: list[str] = []
            for product_id in group["product_id"].tolist():
                if product_id in seen:
                    continue
                seen.add(product_id)
                ordered_items.append(product_id)
            order_history[str(user_id)] = ordered_items
    logger.info("Order history built: %d users", len(order_history))

    item_seasons = build_item_season_map(engine)
    logger.info("Item season map: %d products with season info", len(item_seasons))

    base_params = {
        "lightfm_no_components": settings.lightfm_no_components,
        "lightfm_loss": settings.lightfm_loss,
        "lightfm_learning_rate": settings.lightfm_learning_rate,
        "lightfm_epochs": settings.lightfm_epochs,
        "lightfm_num_threads": settings.lightfm_num_threads,
        "lightfm_alpha": settings.lightfm_item_alpha,
        "lightfm_random_state": settings.lightfm_random_state,
    }

    rows: list[dict[str, Any]] = []
    for idx, params in enumerate(_iter_param_grid(base_params, PARAM_GRID), start=1):
        logger.info("[%d] Training LightFM with params=%s", idx, params)
        start = time.perf_counter()

        recommender = LightFMRecommender(
            no_components=int(params["lightfm_no_components"]),
            loss=str(params["lightfm_loss"]),
            learning_rate=float(params["lightfm_learning_rate"]),
            item_alpha=float(params["lightfm_alpha"]),
            user_alpha=float(params["lightfm_alpha"]),
            epochs=int(params["lightfm_epochs"]),
            num_threads=int(params["lightfm_num_threads"]),
            random_state=int(params["lightfm_random_state"]),
        )

        recommender.fit(
            train_df,
            item_feature_tuples=item_features,
            user_feature_tuples=user_features,
        )

        # Ghi đè user_order_history và item_seasons để điều kiện inference
        # khớp hoàn toàn với production (giống train.py).
        recommender.user_order_history = order_history
        recommender.set_item_seasons(item_seasons)

        metrics = evaluate_lightfm(
            recommender,
            test_df,
            train_df=train_df,
            top_n=top_n,
        )

        elapsed = time.perf_counter() - start
        row = {
            **params,
            "lightfm_item_alpha": float(params["lightfm_alpha"]),
            "lightfm_user_alpha": float(params["lightfm_alpha"]),
            **metrics,
            "train_seconds": round(elapsed, 2),
        }
        rows.append(row)

        logger.info("[%d] metrics=%s", idx, json.dumps(metrics, ensure_ascii=True))

    return pd.DataFrame(rows)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    parser = argparse.ArgumentParser(description="Grid search for LightFM hyperparameters.")
    parser.add_argument("--mysql-url", dest="mysql_url", default=None)
    parser.add_argument("--top-n", type=int, default=30)
    parser.add_argument("--sort-by", default="ndcg@10")
    args = parser.parse_args()

    results = run_tuning(
        mysql_url=args.mysql_url,
        top_n=args.top_n,
    )

    sort_by = args.sort_by
    if sort_by in results.columns:
        ascending = sort_by == "train_seconds"
        results = results.sort_values(sort_by, ascending=ascending)

    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 140)
    print(results.to_string(index=False))


if __name__ == "__main__":
    main()
