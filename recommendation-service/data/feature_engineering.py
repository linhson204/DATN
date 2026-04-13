from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timedelta
from typing import Iterable, Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from config import settings


def resolve_view_type(duration_seconds: Optional[int]) -> str:
    if duration_seconds > 6 and duration_seconds < 60:
        return "QUICK_VIEW"
    if duration_seconds >= 60 and duration_seconds < 210:
        return "DETAIL_VIEW"
    return "DEEP_VIEW"


def _normalize_token(value: object) -> str:
    """Chuẩn hóa giá trị thành token an toàn, giữ nguyên ký tự tiếng Việt/unicode."""
    text_value = str(value).strip().lower()
    # Chuẩn hóa unicode về dạng NFC để biểu diễn nhất quán
    text_value = unicodedata.normalize("NFC", text_value)
    # Thay thế các khoảng trắng liên tiếp bằng dấu gạch dưới
    text_value = re.sub(r"\s+", "_", text_value)
    # Giữ lại chữ cái (bao gồm cả unicode), chữ số, dấu gạch dưới, dấu hai chấm, dấu gạch ngang
    text_value = re.sub(r"[^\w:-]", "", text_value)
    return text_value


def _price_bucket(sale_price: float) -> str:
    """Phân loại giá bán thành các nhóm dễ đọc để sử dụng làm token đặc trưng LightFM."""
    if sale_price < 100_000:
        return "price_bucket:under_100k"
    elif sale_price < 300_000:
        return "price_bucket:100k_300k"
    elif sale_price < 500_000:
        return "price_bucket:300k_500k"
    elif sale_price < 1_000_000:
        return "price_bucket:500k_1m"
    elif sale_price < 3_000_000:
        return "price_bucket:1m_3m"
    else:
        return "price_bucket:above_3m"


def load_item_feature_rows(engine: Engine) -> pd.DataFrame:
    """Tải các hàng đặc trưng của sản phẩm từ cơ sở dữ liệu."""
    query = text(
        """
        SELECT
            p.id AS product_id,
            p.brand,
            p.target_gender,
            p.sale_price,
            c.article_type,
            c.sub_category,
            c.master_category
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE p.status = TRUE
          AND p.total_stock > 0
        """
    )
    return pd.read_sql(query, engine)


def build_lightfm_item_features(item_rows: pd.DataFrame) -> list[tuple[str, list[str]]]:
    """Xây dựng các đặc trưng LightFM từ các hàng sản phẩm."""
    if item_rows.empty:
        return []

    tuples: list[tuple[str, list[str]]] = []
    for row in item_rows.itertuples(index=False):
        product_id = str(row.product_id)
        features: list[str] = []

        if pd.notna(row.brand):
            features.append(f"brand:{_normalize_token(row.brand)}")
        if pd.notna(row.target_gender):
            features.append(f"gender:{_normalize_token(row.target_gender)}")
        if pd.notna(row.article_type):
            features.append(f"article:{_normalize_token(row.article_type)}")
        if pd.notna(row.sub_category):
            features.append(f"sub_category:{_normalize_token(row.sub_category)}")
        if pd.notna(row.master_category):
            features.append(f"master_category:{_normalize_token(row.master_category)}")
        if hasattr(row, "sale_price") and pd.notna(row.sale_price):
            features.append(_price_bucket(float(row.sale_price)))

        tuples.append((product_id, features))

    return tuples


def item_feature_tuples_for_catalog(
    engine: Engine,
    allowed_item_ids: Optional[Iterable[str]] = None,
) -> list[tuple[str, list[str]]]:
    """Lấy các tuple đặc trưng sản phẩm cho danh mục, tùy chọn lọc theo ID sản phẩm cho phép."""
    item_rows = load_item_feature_rows(engine)
    tuples = build_lightfm_item_features(item_rows)

    if allowed_item_ids is None:
        return tuples

    allow_set = {str(value) for value in allowed_item_ids}
    return [entry for entry in tuples if entry[0] in allow_set]


def compute_session_coview(
    engine: Engine,
    lookback_days: Optional[int] = None,
    session_minutes: Optional[int] = None,
) -> pd.DataFrame:
    """Tính toán số lần xem chung (co-view) giữa các sản phẩm dựa trên lịch sử xem của người dùng."""
    days = int(lookback_days or settings.coview_lookback_days)
    minutes = int(session_minutes or settings.coview_session_minutes)
    cutoff = datetime.now() - timedelta(days=days)

    query = text(
        """
        SELECT
            a.product_id AS seed_product_id,
            b.product_id AS co_view_product_id,
            COUNT(*) AS co_view_count
        FROM product_view_log a
        JOIN product_view_log b
          ON a.user_id = b.user_id
         AND a.product_id <> b.product_id
         AND ABS(TIMESTAMPDIFF(MINUTE, a.created_at, b.created_at)) <= :minutes
        WHERE a.created_at >= :cutoff
          AND b.created_at >= :cutoff
        GROUP BY a.product_id, b.product_id
        """
    )
    return pd.read_sql(query, engine, params={"cutoff": cutoff, "minutes": minutes})