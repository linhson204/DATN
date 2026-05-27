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
from data.data_pipeline import build_engine, extract_interactions
from data.feature_engineering import item_feature_tuples_for_catalog, user_feature_tuples_for_users
from models.lightfm_model import LightFMRecommender
from training.evaluate import evaluate_lightfm, time_based_split

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


def run_tuning(mysql_url: str | None, include_wishlist: bool, top_n: int) -> pd.DataFrame:
    engine = build_engine(mysql_url)

    logger.info("Extracting interactions from database...")
    interactions = extract_interactions(engine, include_wishlist=include_wishlist)
    if interactions.empty:
        raise RuntimeError("No interactions found. Check source tables and lookback windows.")

    train_df, test_df = time_based_split(interactions, holdout_days=settings.split_holdout_days)
    if train_df.empty or test_df.empty:
        raise RuntimeError("Time-based split produced an empty train or test set.")

    train_item_ids = set(train_df["product_id"].astype(str).tolist())
    item_features = item_feature_tuples_for_catalog(engine, allowed_item_ids=train_item_ids)
    logger.info("Item features prepared: %d items with features", len(item_features))

    train_user_ids = set(train_df["user_id"].astype(str).tolist())
    user_features = user_feature_tuples_for_users(engine, allowed_user_ids=train_user_ids)
    logger.info("User features prepared: %d users with features", len(user_features))

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
    parser.add_argument("--include-wishlist", action="store_true")
    parser.add_argument("--top-n", type=int, default=30)
    parser.add_argument("--sort-by", default="ndcg@10")
    args = parser.parse_args()

    results = run_tuning(
        mysql_url=args.mysql_url,
        include_wishlist=args.include_wishlist,
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
