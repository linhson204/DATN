from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timedelta
from typing import Iterable, Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from config import settings
from data.season import ALL_SEASONS, _normalize_season_token


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


def age_bucket_from_age(age: Optional[int]) -> Optional[str]:
    """Quy đổi tuổi thành nhóm tuổi ổn định để dùng làm feature."""
    if age is None:
        return None
    if age < 0 or age > 120:
        return None
    if age < 18:
        return "under_18"
    if age <= 24:
        return "18_24"
    if age <= 34:
        return "25_34"
    if age <= 44:
        return "35_44"
    if age <= 54:
        return "45_54"
    return "55_plus"


def age_bucket_from_birth_date(value: object, reference_time: Optional[pd.Timestamp] = None) -> Optional[str]:
    """Quy đổi ngày sinh thành nhóm tuổi dựa trên thời điểm tham chiếu hiện tại."""
    birth_time = pd.to_datetime(value, errors="coerce")
    if pd.isna(birth_time):
        return None

    ref = reference_time or pd.Timestamp.now()
    age_years = ref.year - birth_time.year - ((ref.month, ref.day) < (birth_time.month, birth_time.day))
    return age_bucket_from_age(int(age_years))


def age_bucket_from_birth_year(value: object, reference_year: Optional[int] = None) -> Optional[str]:
    """Quy đổi năm sinh thành nhóm tuổi khi dữ liệu chỉ có birth_year."""
    if value is None:
        return None

    try:
        year = int(value)
    except (TypeError, ValueError):
        return None

    if year < 1900 or year > 2100:
        return None

    current_year = reference_year or pd.Timestamp.now().year
    age = current_year - year
    return age_bucket_from_age(age)


def load_item_feature_rows(engine: Engine) -> pd.DataFrame:
    """Tải các hàng đặc trưng của sản phẩm từ cơ sở dữ liệu, bao gồm thông tin mùa."""
    query = text(
        """
        SELECT
            p.id AS product_id,
            p.brand,
            p.target_gender,
            p.sale_price,
            c.article_type,
            c.sub_category,
            c.master_category,
            pa.attribute_value AS season
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        LEFT JOIN product_attributes pa
            ON pa.product_id = p.id AND pa.attribute_key = 'season'
        WHERE p.status = TRUE
          AND p.total_stock > 0
        """
    )
    return pd.read_sql(query, engine)


def _discover_users_columns(engine: Engine) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Phát hiện tên cột user_id, gender, ngày sinh hoặc năm sinh trong bảng users."""
    try:
        columns = pd.read_sql(
            text(
                """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                """
            ),
            engine,
        )
    except Exception:
        return None, None, None, None

    if columns.empty or "COLUMN_NAME" not in columns.columns:
        return None, None, None, None

    lookup = {str(name).lower(): str(name) for name in columns["COLUMN_NAME"].tolist()}

    def pick(candidates: list[str]) -> Optional[str]:
        for candidate in candidates:
            if candidate in lookup:
                return lookup[candidate]
        return None

    user_id_col = pick(["id", "user_id"])
    gender_col = pick(["gender", "target_gender", "sex"])
    dob_col = pick(["date_of_birth", "birth_date", "dob"])
    birth_year_col = pick(["birth_year", "year_of_birth"])
    return user_id_col, gender_col, dob_col, birth_year_col


def load_user_profile_rows(engine: Engine) -> pd.DataFrame:
    """Tải dữ liệu hồ sơ người dùng (giới tính, ngày sinh) từ bảng users."""
    user_id_col, gender_col, dob_col, birth_year_col = _discover_users_columns(engine)
    if user_id_col is None:
        return pd.DataFrame(columns=["user_id", "gender", "date_of_birth", "birth_year"])

    select_gender = f"u.{gender_col} AS gender" if gender_col else "NULL AS gender"
    select_dob = f"u.{dob_col} AS date_of_birth" if dob_col else "NULL AS date_of_birth"
    select_birth_year = f"u.{birth_year_col} AS birth_year" if birth_year_col else "NULL AS birth_year"

    query = text(
        f"""
        SELECT
            u.{user_id_col} AS user_id,
            {select_gender},
            {select_dob},
            {select_birth_year}
        FROM users u
        """
    )

    try:
        rows = pd.read_sql(query, engine)
    except Exception:
        return pd.DataFrame(columns=["user_id", "gender", "date_of_birth", "birth_year"])

    return rows


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

        # Thêm token mùa (season) nếu có
        if hasattr(row, "season") and pd.notna(row.season):
            season_val = str(row.season).strip()
            if season_val in ALL_SEASONS:
                features.append(f"season:{_normalize_season_token(season_val)}")

        tuples.append((product_id, features))

    return tuples


def build_lightfm_user_features(user_rows: pd.DataFrame) -> list[tuple[str, list[str]]]:
    """Xây dựng user features (giới tính, nhóm tuổi) cho LightFM."""
    if user_rows.empty:
        return []

    tuples: list[tuple[str, list[str]]] = []
    for row in user_rows.itertuples(index=False):
        user_id = str(row.user_id)
        features: list[str] = []

        if hasattr(row, "gender") and pd.notna(row.gender):
            features.append(f"user_gender:{_normalize_token(row.gender)}")

        age_bucket = age_bucket_from_birth_date(getattr(row, "date_of_birth", None))
        if age_bucket is None:
            age_bucket = age_bucket_from_birth_year(getattr(row, "birth_year", None))
        if age_bucket:
            features.append(f"user_age:{age_bucket}")

        if features:
            tuples.append((user_id, features))

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


def user_feature_tuples_for_users(
    engine: Engine,
    allowed_user_ids: Optional[Iterable[str]] = None,
) -> list[tuple[str, list[str]]]:
    """Lấy các tuple user features cho LightFM, có thể lọc theo tập user_id."""
    user_rows = load_user_profile_rows(engine)
    tuples = build_lightfm_user_features(user_rows)

    if allowed_user_ids is None:
        return tuples

    allow_set = {str(value) for value in allowed_user_ids}
    return [entry for entry in tuples if entry[0] in allow_set]
