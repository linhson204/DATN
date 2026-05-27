from __future__ import annotations

import logging
from functools import lru_cache

from config import settings
from models.fallback import PopularItemsFallback
from models.lightfm_model import LightFMRecommender

logger = logging.getLogger(__name__)


# ======================================================================
# LightFM recommender (main model)
# ======================================================================


@lru_cache(maxsize=1)
def _load_recommender() -> LightFMRecommender:
    """
    Hàm load mô hình LightFM từ file (artifact) trên ổ cứng vào RAM.
    Dùng @lru_cache vòng đời bằng 1 để caching, đảm bảo thao tác đọc file 
    và khởi tạo model nặng nhọc chỉ chạy ĐÚNG 1 LẦN khi server khởi động.
    """
    if not settings.model_path.exists():
        raise FileNotFoundError(
            "Model artifact not found. Run training/train.py to generate models/saved artifacts."
        )
    logger.info("Loading LightFM artifacts from %s", settings.artifact_dir)
    return LightFMRecommender.load_artifacts(
        artifact_dir=settings.artifact_dir,
        num_threads=settings.lightfm_num_threads,
    )


def get_recommender() -> LightFMRecommender:
    """
    FastAPI dependency — trả về instance của LightFM recommender đã được load & cache.
    Hàm này được inject thẳng vào tham số của các API endpoint.
    """
    return _load_recommender()


# ======================================================================
# Cold-start fallback
# ======================================================================


@lru_cache(maxsize=1)
def _load_fallback() -> PopularItemsFallback:
    """
    Load dữ liệu Cold-Start (những sản phẩm hot trending) cho người dùng mới.
    Đọc từ file JSON fallback_data_path. Nếu file này không tồn tại, hàm sẽ cố gắng 
    tự generate tự động từ file interactions.csv để API không bao giờ bị trả về rỗng.
    """
    path = settings.fallback_data_path

    if path.exists():
        logger.info("Loading fallback data from %s", path)
        return PopularItemsFallback.load(path)

    # fallback.json missing — auto-generate from interactions CSV
    logger.warning(
        "fallback.json not found at %s — attempting to auto-generate from interactions...", path
    )
    try:
        import pandas as pd
        from data.data_pipeline import build_engine

        interactions_path = settings.interactions_output_path
        if not interactions_path.exists():
            logger.error(
                "interactions.csv not found at %s — returning empty fallback", interactions_path
            )
            return PopularItemsFallback()

        df = pd.read_csv(interactions_path)
        engine = build_engine()
        fallback = PopularItemsFallback.build_from_data(
            interactions=df,
            engine=engine,
            trending_days=settings.fallback_trending_days,
            top_n=settings.fallback_top_n,
        )
        fallback.save(path)
        logger.info("Auto-generated fallback.json saved to %s", path)
        return fallback
    except Exception:
        logger.exception("Failed to auto-generate fallback — returning empty fallback")
        return PopularItemsFallback()


def get_fallback() -> PopularItemsFallback:
    """FastAPI dependency — returns the cached fallback provider."""
    return _load_fallback()


# ======================================================================
# Reload all
# ======================================================================


def reload_all() -> dict[str, object]:
    """
    Hàm ép server xóa (clear) toàn bộ cache đang giữ (LightFM, Fallback).
    Sau đó tải lại dữ liệu phiên bản mới nhất từ trên ổ cứng vào bộ nhớ (RAM).
    Rất hữu dụng khi có model mới train xong, Admin gọi hàm này để cập nhật nóng online.
    """
    _load_recommender.cache_clear()
    _load_fallback.cache_clear()

    logger.info("All caches cleared, reloading...")
    recommender = _load_recommender()
    fallback = _load_fallback()

    return {
        "recommender": recommender,
        "fallback": fallback,
    }