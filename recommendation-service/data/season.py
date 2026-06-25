"""Tiện ích liên quan đến mùa (Season) cho hệ thống gợi ý sản phẩm.

Module này cung cấp:
1. Xác định mùa hiện tại dựa trên tháng.
2. Truy vấn season từ bảng product_attributes trong database.
3. Tính hệ số boost/giảm điểm cho sản phẩm theo mùa tại inference-time.

Quy tắc mùa (theo lịch Việt Nam):
    - Xuân (Spring): tháng 2 → 4
    - Hè (Summer):   tháng 4 → 8
    - Thu (Fall):     tháng 8 → 11
    - Đông (Winter):  tháng 11 → 2
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Các giá trị mùa chuẩn hóa
SPRING = "Spring"
SUMMER = "Summer"
FALL = "Fall"
WINTER = "Winter"

ALL_SEASONS = {SPRING, SUMMER, FALL, WINTER}


def _normalize_season_token(season: str) -> str:
    """Chuẩn hóa giá trị mùa thành token lowercase cho LightFM feature."""
    return season.strip().lower()


def get_current_season(month: Optional[int] = None) -> str:
    """Xác định mùa hiện tại dựa trên tháng.

    Quy tắc:
        - Tháng 2, 3, 4  → Spring (Xuân)
        - Tháng 5, 6, 7  → Summer (Hè)  (tháng 4 là giao mùa, tháng 5 bắt đầu hè rõ)
        - Tháng 8, 9, 10 → Fall (Thu)
        - Tháng 11, 12, 1 → Winter (Đông)


    """
    if month is None:
        month = datetime.now().month

    if month in (2, 3):
        return SPRING
    elif month in (4, 5, 6, 7):
        return SUMMER
    elif month in (8, 9, 10):
        return FALL
    else:  # 11, 12, 1
        return WINTER


def get_adjacent_seasons(season: str) -> set[str]:
    """Trả về mùa KẾ TIẾP (sắp tới) của mùa hiện tại — chỉ một chiều đi lên.

    Quy tắc: Xuân → Hè → Thu → Đông → Xuân (vòng tròn).

    Sản phẩm thuộc mùa kế tiếp → giữ nguyên điểm (không trừ, vì sắp vào mùa).
    Sản phẩm thuộc mùa đã qua → bị trừ điểm bình thường (trái mùa).

    Ví dụ đang là Summer:
        - Fall  → giao mùa lên (giữ nguyên)
        - Spring → mùa cũ (trừ điểm)       
    """
    next_season = {
        SPRING: SUMMER,
        SUMMER: FALL,
        FALL:   WINTER,
        WINTER: SPRING,
    }
    upcoming = next_season.get(season)
    return {upcoming} if upcoming else set()


def load_item_seasons(engine: Engine) -> pd.DataFrame:
    """Truy vấn season của từng sản phẩm từ bảng product_attributes.

    Trả về:
        DataFrame với cột: product_id, season
        Mỗi sản phẩm có thể có nhiều hàng nếu có nhiều season
        (tuy nhiên thực tế mỗi sản phẩm thường chỉ có 1 giá trị season).
    """
    query = text(
        """
        SELECT
            pa.product_id,
            pa.attribute_value AS season
        FROM product_attributes pa
        WHERE pa.attribute_key = 'season'
        """
    )
    try:
        df = pd.read_sql(query, engine)
        df["product_id"] = df["product_id"].astype(str)
        df["season"] = df["season"].str.strip()
        logger.info("Loaded seasons for %d product-season rows", len(df))
        return df
    except Exception:
        logger.warning("Failed to load item seasons from product_attributes", exc_info=True)
        return pd.DataFrame(columns=["product_id", "season"])


def build_item_season_map(engine: Engine) -> dict[str, list[str]]:
    """Xây dựng mapping product_id → danh sách mùa từ database.

    Trả về:
        Dict dạng {"product_id": ["Summer"], "product_id_2": ["Spring", "Fall"]}
    """
    df = load_item_seasons(engine)
    if df.empty:
        return {}

    season_map: dict[str, list[str]] = {}
    for row in df.itertuples(index=False):
        pid = str(row.product_id)
        season = str(row.season)
        if season in ALL_SEASONS:
            season_map.setdefault(pid, []).append(season)
        else:
            logger.debug("Unknown season value '%s' for product %s, skipping", season, pid)

    logger.info("Built season map: %d products with season info", len(season_map))
    return season_map


def compute_season_boost(
    item_seasons: list[str],
    current_season: str,
    boost_weight: float = 0.3,
) -> float:
    """Tính hệ số nhân (multiplier) cho điểm gợi ý dựa trên mùa.

    Quy tắc:
        - Sản phẩm đúng mùa hiện tại: boost lên (1 + boost_weight)
        - Sản phẩm thuộc mùa liền kề:  giữ nguyên (1.0)
        - Sản phẩm trái mùa hoàn toàn: giảm xuống (1 - boost_weight)
        - Sản phẩm không có thông tin mùa: giữ nguyên (1.0)

    Tham số:
        item_seasons: Danh sách mùa của sản phẩm (VD: ["Summer"])
        current_season: Mùa hiện tại (VD: "Summer")
        boost_weight: Trọng số boost (0-1), mặc định 0.3

    Trả về:
        Hệ số nhân (float), ví dụ 1.3 (boost), 1.0 (giữ nguyên), 0.7 (giảm)
    """
    if not item_seasons:
        # Sản phẩm không có thông tin mùa → không ảnh hưởng
        return 1.0

    # Kiểm tra sản phẩm có đúng mùa hiện tại không
    if current_season in item_seasons:
        return 1.0 + boost_weight

    # Kiểm tra sản phẩm thuộc mùa liền kề (giao mùa)
    adjacent = get_adjacent_seasons(current_season)
    if any(s in adjacent for s in item_seasons):
        return 1.0

    # Sản phẩm trái mùa hoàn toàn
    return 1.0 - boost_weight
