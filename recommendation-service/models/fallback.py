"""Popular-items fallback (Sản phẩm phổ biến) dùng cho người dùng cold-start.

Khi một user không có bất kỳ tương tác nào trong mô hình (người dùng mới, khách vãng lai, v.v.),
mô hình LightFM sẽ trả về một danh sách rỗng. Module này cung cấp các danh sách fallback 
(danh sách dự phòng) được tính toán sẵn MỘT LẦN trong quá trình training và lưu thành 
một file JSON nhỏ để API rớt mạng hoặc không cần query database vẫn có kết quả gợi ý.

Các chiến lược fallback (theo thứ tự ưu tiên):
1. Nhóm sản phẩm nổi bật theo giới tính + nhóm tuổi — nếu request có gửi lên gender và age.
2. Nhóm sản phẩm nổi bật theo giới tính — nếu request có gửi lên gender.
3. Sản phẩm xu hướng (Trending) — Sản phẩm có nhiều tương tác nhất trong N ngày gần đây nhất của lịch sử.
4. Sản phẩm top mọi thời đại — Danh sách chung các sản phẩm phổ biến nhất toàn hệ thống.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from data.feature_engineering import (
    age_bucket_from_age,
    age_bucket_from_birth_date,
    age_bucket_from_birth_year,
    load_user_profile_rows,
)
from data.season import ALL_SEASONS, build_item_season_map, get_current_season

logger = logging.getLogger(__name__)


class PopularItemsFallback:
    def __init__(self) -> None:
        self.overall: list[str] = []
        self.by_gender: dict[str, list[str]] = {}
        self.by_gender_age: dict[str, list[str]] = {}
        self.user_profiles: dict[str, dict[str, str]] = {}
        self.trending: list[str] = []
        # Danh sách sản phẩm phổ biến theo mùa, kóa sẵn khi training để phuc vụ cold-start
        self.by_season: dict[str, list[str]] = {}

    # ------------------------------------------------------------------
    # Xây dựng model từ dữ liệu tương tác và metadata sản phẩm
    # ------------------------------------------------------------------

    @classmethod
    def build_from_data(
        cls,
        interactions: pd.DataFrame,
        engine: Engine,
        trending_days: int = 7,
        top_n: int = 50,
    ) -> "PopularItemsFallback":
        """
        Tính toán danh sách sản phẩm phổ biến chung, sản phẩm trending và sản phẩm phổ biến theo giới tính.

        Tham số:
            interactions: DataFrame chứa các tương tác đào tạo (user_id, product_id, weight, created_at).
            engine: SQLAlchemy engine dùng để truy vấn metadata của database (lấy giới tính sản phẩm).
            trending_days: Số ngày gần đây nhất để lấy ra "trending" (mặc định 7 ngày).
            top_n: Kích thước tối đa của mỗi danh sách.
        """
        instance = cls()

        if interactions.empty:
            logger.warning("Interactions empty — fallback will be empty")
            return instance

        df = interactions.copy()
        df["product_id"] = df["product_id"].astype(str)
        df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")

        # --- Overall popular ---
        overall = (
            df.groupby("product_id", as_index=False)["weight"]
            .sum()
            .sort_values("weight", ascending=False)["product_id"]
            .tolist()
        )
        instance.overall = overall[:top_n]

        # --- Trending (recent window) ---
        max_date = df["created_at"].max()
        if pd.notna(max_date):
            cutoff = max_date - pd.Timedelta(days=trending_days)
            recent = df[df["created_at"] >= cutoff]
            if not recent.empty:
                trending = (
                    recent.groupby("product_id", as_index=False)["weight"]
                    .sum()
                    .sort_values("weight", ascending=False)["product_id"]
                    .tolist()
                )
                instance.trending = trending[:top_n]

        if not instance.trending:
            instance.trending = instance.overall[:top_n]

        # --- Popular by gender ---
        try:
            product_gender = pd.read_sql(
                text(
                    """
                    SELECT id AS product_id, target_gender
                    FROM products
                    WHERE status = TRUE AND total_stock > 0
                    """
                ),
                engine,
            )
            product_gender["product_id"] = product_gender["product_id"].astype(str)

            merged = df.merge(product_gender, on="product_id", how="left")

            for gender in ("MALE", "FEMALE", "UNISEX"):
                gender_df = merged[merged["target_gender"] == gender]
                if gender_df.empty:
                    continue
                gender_popular = (
                    gender_df.groupby("product_id", as_index=False)["weight"]
                    .sum()
                    .sort_values("weight", ascending=False)["product_id"]
                    .tolist()
                )
                instance.by_gender[gender] = gender_popular[:top_n]
        except Exception:
            logger.warning("Failed to compute gender-based popular items, skipping", exc_info=True)

        # --- Popular by season ---
        try:
            item_season_map = build_item_season_map(engine)
            if item_season_map:
                # Tạo cột season cho mỗi product trong DataFrame tương tác
                df["_season"] = df["product_id"].map(
                    lambda pid: item_season_map.get(pid, [None])[0]
                )
                for season in ALL_SEASONS:
                    season_df = df[df["_season"] == season]
                    if season_df.empty:
                        continue
                    season_popular = (
                        season_df.groupby("product_id", as_index=False)["weight"]
                        .sum()
                        .sort_values("weight", ascending=False)["product_id"]
                        .tolist()
                    )
                    instance.by_season[season] = season_popular[:top_n]
                df.drop(columns=["_season"], inplace=True)
        except Exception:
            logger.warning("Failed to compute season-based popular items, skipping", exc_info=True)

        # --- Popular by gender + age bucket ---
        try:
            user_profiles = load_user_profile_rows(engine)
            if not user_profiles.empty:
                user_profiles = user_profiles.copy()
                user_profiles["user_id"] = user_profiles["user_id"].astype(str)
                user_profiles["gender_key"] = (
                    user_profiles["gender"].fillna("").astype(str).str.strip().str.upper()
                )
                user_profiles["age_bucket"] = user_profiles.apply(
                    lambda row: age_bucket_from_birth_date(row.get("date_of_birth"))
                    or age_bucket_from_birth_year(row.get("birth_year")),
                    axis=1,
                )

                profile_records = user_profiles[
                    (user_profiles["gender_key"] != "") | user_profiles["age_bucket"].notna()
                ]
                instance.user_profiles = {
                    str(row.user_id): {
                        "gender": str(row.gender_key),
                        "age_bucket": str(row.age_bucket) if pd.notna(row.age_bucket) else "",
                    }
                    for row in profile_records.itertuples(index=False)
                }

                segmentation_profiles = user_profiles[
                    (user_profiles["gender_key"] != "")
                    & user_profiles["age_bucket"].notna()
                ]

                if not segmentation_profiles.empty:
                    merged_profiles = df.merge(
                        segmentation_profiles[["user_id", "gender_key", "age_bucket"]],
                        on="user_id",
                        how="inner",
                    )

                    for (gender_key, age_bucket), segment_df in merged_profiles.groupby(["gender_key", "age_bucket"]):
                        segment_popular = (
                            segment_df.groupby("product_id", as_index=False)["weight"]
                            .sum()
                            .sort_values("weight", ascending=False)["product_id"]
                            .tolist()
                        )
                        key = f"{gender_key}:{age_bucket}"
                        instance.by_gender_age[key] = segment_popular[:top_n]
        except Exception:
            logger.warning("Failed to compute gender+age popular items, skipping", exc_info=True)

        logger.info(
            "Fallback built: overall=%d, trending=%d, genders=%s, gender_age_segments=%d, user_profiles=%d, seasons=%s",
            len(instance.overall),
            len(instance.trending),
            {g: len(v) for g, v in instance.by_gender.items()},
            len(instance.by_gender_age),
            len(instance.user_profiles),
            {s: len(v) for s, v in instance.by_season.items()},
        )
        return instance

    # ------------------------------------------------------------------
    # Recommend
    # ------------------------------------------------------------------

    def recommend(
        self,
        user_id: Optional[str] = None,
        gender: Optional[str] = None,
        age: Optional[int] = None,
        top_n: int = 30,
    ) -> tuple[list[str], str]:
        """
        Trả về danh sách (product_ids, tên_chiến_lược).

        Thứ tự ưu tiên các chiến lược:
        1. Phổ biến theo giới tính + nhóm tuổi (nếu có đủ gender và age)
        2. Phổ biến theo giới tính
        3. Phổ biến theo mùa hiện tại (bổ sung)
        4. Trending (Sản phẩm đang lên xu hướng gần đây)
        5. Phổ biến chung (nếu tất cả các chiến lược trên thất bại)
        """
        resolved_gender = gender.upper() if gender else None
        resolved_age_bucket = age_bucket_from_age(age) if age is not None else None

        if user_id is not None:
            profile = self.user_profiles.get(str(user_id))
            if profile:
                if resolved_gender is None and profile.get("gender"):
                    resolved_gender = profile["gender"]
                if resolved_age_bucket is None and profile.get("age_bucket"):
                    resolved_age_bucket = profile["age_bucket"]

        if resolved_gender and resolved_age_bucket:
            key = f"{resolved_gender}:{resolved_age_bucket}"
            if key in self.by_gender_age:
                return self.by_gender_age[key][:top_n], f"popular_by_gender_age:{key}"

        if resolved_gender:
            if resolved_gender in self.by_gender:
                return self.by_gender[resolved_gender][:top_n], f"popular_by_gender:{resolved_gender}"

        # Chiến lược mới: ưu tiên sản phẩm theo mùa hiện tại
        current_season = get_current_season()
        if current_season in self.by_season:
            return self.by_season[current_season][:top_n], f"popular_by_season:{current_season}"

        if self.trending:
            return self.trending[:top_n], "trending"

        return self.overall[:top_n], "popular"

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: Path | str) -> None:
        output = Path(path)
        output.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "overall": self.overall,
            "by_gender": self.by_gender,
            "by_gender_age": self.by_gender_age,
            "user_profiles": self.user_profiles,
            "trending": self.trending,
            "by_season": self.by_season,
        }
        output.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")
        logger.info("Fallback data saved to %s", output)

    @classmethod
    def load(cls, path: Path | str) -> "PopularItemsFallback":
        input_path = Path(path)
        if not input_path.exists():
            logger.warning("Fallback data not found at %s — using empty fallback", input_path)
            return cls()

        data = json.loads(input_path.read_text(encoding="utf-8"))
        instance = cls()
        instance.overall = data.get("overall", [])
        instance.by_gender = data.get("by_gender", {})
        instance.by_gender_age = data.get("by_gender_age", {})
        instance.user_profiles = data.get("user_profiles", {})
        instance.trending = data.get("trending", [])
        instance.by_season = data.get("by_season", {})

        logger.info(
            "Fallback loaded from %s: overall=%d, trending=%d, genders=%s, seasons=%s",
            input_path,
            len(instance.overall),
            len(instance.trending),
            list(instance.by_gender.keys()),
            list(instance.by_season.keys()),
        )
        return instance
