"""Popular-items fallback (Sản phẩm phổ biến) dùng cho người dùng cold-start.

Khi một user không có bất kỳ tương tác nào trong mô hình (người dùng mới, khách vãng lai, v.v.),
mô hình LightFM sẽ trả về một danh sách rỗng. Module này cung cấp các danh sách fallback 
(danh sách dự phòng) được tính toán sẵn MỘT LẦN trong quá trình training và lưu thành 
một file JSON nhỏ để API rớt mạng hoặc không cần query database vẫn có kết quả gợi ý.

Các chiến lược fallback (theo thứ tự ưu tiên):
1. Nhóm sản phẩm nổi bật theo giới tính — nếu request có gửi lên target_gender.
2. Sản phẩm xu hướng (Trending) — Sản phẩm có nhiều tương tác nhất trong N ngày gần đây nhất của lịch sử.
3. Sản phẩm top mọi thời đại — Danh sách chung các sản phẩm phổ biến nhất toàn hệ thống.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


class PopularItemsFallback:
    def __init__(self) -> None:
        self.overall: list[str] = []
        self.by_gender: dict[str, list[str]] = {}
        self.trending: list[str] = []

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

        logger.info(
            "Fallback built: overall=%d, trending=%d, genders=%s",
            len(instance.overall),
            len(instance.trending),
            {g: len(v) for g, v in instance.by_gender.items()},
        )
        return instance

    # ------------------------------------------------------------------
    # Recommend
    # ------------------------------------------------------------------

    def recommend(
        self,
        gender: Optional[str] = None,
        top_n: int = 20,
    ) -> tuple[list[str], str]:
        """
        Trả về danh sách (product_ids, tên_chiến_lược).

        Thứ tự ưu tiên các chiến lược:
        1. Phổ biến theo giới tính (nếu *gender* được cung cấp và trong model có dữ liệu)
        2. Trending (Sản phẩm đang lên xu hướng gần đây)
        3. Phổ biến chung (nếu tất cả các chiến lược trên thất bại)
        """
        if gender:
            key = gender.upper()
            if key in self.by_gender:
                return self.by_gender[key][:top_n], f"popular_by_gender:{key}"

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
            "trending": self.trending,
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
        instance.trending = data.get("trending", [])

        logger.info(
            "Fallback loaded from %s: overall=%d, trending=%d, genders=%s",
            input_path,
            len(instance.overall),
            len(instance.trending),
            list(instance.by_gender.keys()),
        )
        return instance
