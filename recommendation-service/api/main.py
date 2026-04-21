from __future__ import annotations

import logging
import os

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.dependencies import get_fallback, get_item_cf, get_recommender, reload_all
from api.schemas import (
    RecommendResponse,
    ScoreItem,
    ScoreRequest,
    ScoreResponse,
    SimilarItemsResponse,
)
from config import settings
from data.season import get_current_season
from models.collaborative_filtering import ItemCollaborativeFiltering
from models.fallback import PopularItemsFallback
from models.lightfm_model import LightFMRecommender

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Recommendation Scoring Service",
    version="0.2.0",
    description="FastAPI service for scoring, personalized recommendations, and similar items.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)


# ======================================================================
# Health
# ======================================================================


@app.get("/health")
def health() -> dict[str, str]:
    """
    API Health Check.
    Dùng để kiểm tra xem server có đang hoạt động hay không.
    Thường được các hệ thống load balancer hoặc k8s gọi để monitor.
    """
    return {"status": "ok"}


# ======================================================================
# POST /score — re-rank candidates sent by the BE
# ======================================================================


@app.post("/score", response_model=ScoreResponse)
def score_candidates(
    payload: ScoreRequest,
    recommender: LightFMRecommender = Depends(get_recommender),
) -> ScoreResponse:
    """
    Chấm điểm (Score) danh sách các ứng viên sản phẩm cho một user.
    Hàm này nhận vào một user_id và một danh sách candidate_product_ids.
    Nó sử dụng mô hình LightFM để tính điểm phù hợp của từng sản phẩm cho user, 
    giúp Backend (BE) có thể re-rank lại kết quả trước khi trả về cho client.
    """
    try:
        scored = recommender.score_candidates(
            payload.user_id,
            payload.candidate_product_ids,
            user_gender=payload.gender,
            season_boost_weight=settings.season_boost_weight if settings.enable_season_boost else 0.0,
            gender_match_boost_weight=(
                settings.gender_match_boost_weight if settings.enable_gender_match_boost else 0.0
            ),
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info(
        "POST /score user_id=%s candidates=%d scored=%d",
        payload.user_id,
        len(payload.candidate_product_ids),
        len(scored),
    )
    return ScoreResponse(
        scores=[ScoreItem(product_id=product_id, score=score) for product_id, score in scored]
    )


# ======================================================================
# GET /recommend/{user_id} — personalized or cold-start fallback
# ======================================================================


@app.get("/recommend/{user_id}", response_model=RecommendResponse)
def recommend_for_user(
    user_id: str,
    top_n: int = Query(20, ge=1, le=100),
    gender: str | None = Query(None, description="User gender hint for cold-start fallback (MALE/FEMALE/UNISEX)"),
    age: int | None = Query(None, ge=0, le=120, description="User age hint for cold-start fallback"),
    recommender: LightFMRecommender = Depends(get_recommender),
    fallback: PopularItemsFallback = Depends(get_fallback),
) -> RecommendResponse:
    """
    Lấy danh sách sản phẩm gợi ý cá nhân hóa cho một user (Personalized Recommendations).
    
    Quy trình hoạt động:
    1. Cố gắng dùng LightFM để gợi ý cá nhân hóa dựa trên lịch sử tương tác của user.
    2. Nếu user là mới (chưa có lịch sử) -> gọi fallback (cold-start).
    3. Fallback ưu tiên theo giới tính + độ tuổi (nếu có), sau đó theo giới tính,
        rồi đến trending hoặc top phổ biến toàn hệ thống.
    """
    strategy = "personalized"
    recommendations: list[tuple[str, float]] = []
    current_season = get_current_season()
    boost_weight = settings.season_boost_weight if settings.enable_season_boost else 0.0

    # --- Try personalized recommendations first ---
    try:
        recommendations = recommender.recommend_for_user(
            user_id,
            top_n=top_n,
            user_gender=gender,
            season_boost_weight=boost_weight,
            gender_match_boost_weight=(
                settings.gender_match_boost_weight if settings.enable_gender_match_boost else 0.0
            ),
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # --- Cold-start fallback ---
    if not recommendations:
        fallback_ids, strategy = fallback.recommend(user_id=user_id, gender=gender, age=age, top_n=top_n)
        # Assign decaying scores so ordering is preserved
        count = len(fallback_ids)
        recommendations = [
            (pid, round(1.0 - (i / max(count, 1)), 4))
            for i, pid in enumerate(fallback_ids)
        ]
        logger.info(
            "GET /recommend/%s cold-start fallback strategy=%s season=%s returned %d items",
            user_id,
            strategy,
            current_season,
            len(recommendations),
        )
    else:
        logger.info(
            "GET /recommend/%s personalized season=%s returned %d items",
            user_id,
            current_season,
            len(recommendations),
        )

    return RecommendResponse(
        user_id=user_id,
        strategy=strategy,
        season=current_season,
        recommendations=[
            ScoreItem(product_id=product_id, score=score)
            for product_id, score in recommendations
        ],
    )


# ======================================================================
# GET /similar/{product_id} — item-based similar products
# ======================================================================


@app.get("/similar/{product_id}", response_model=SimilarItemsResponse)
def similar_items(
    product_id: str,
    top_n: int = Query(10, ge=1, le=50),
    item_cf: ItemCollaborativeFiltering = Depends(get_item_cf),
) -> SimilarItemsResponse:
    """
    Tìm các sản phẩm tương tự với một sản phẩm cho trước (Item-to-Item Collaborative Filtering).
    Dựa vào ma trận tương tác (user-item), tính ra độ tương đồng cosine (cosine similarity) 
    giữa các item để xem những user xem sản phẩm này thường xem những sản phẩm nào khác.
    Rất hữu ích khi dùng hiển thị ở mục "Sản phẩm tương tự" ở trang chi tiết sản phẩm.
    """
    try:
        similar = item_cf.recommend(product_id, top_n=top_n)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not similar:
        logger.warning("GET /similar/%s returned 0 results (unknown product)", product_id)
    else:
        logger.info("GET /similar/%s returned %d results", product_id, len(similar))

    return SimilarItemsResponse(
        product_id=product_id,
        similar_items=[
            ScoreItem(product_id=pid, score=score)
            for pid, score in similar
        ],
    )


# ======================================================================
# POST /admin/reload — hot-reload all artifacts
# ======================================================================


@app.post("/admin/reload")
def admin_reload() -> dict[str, str]:
    """
    API Admin: Hot-reload lại tất cả các model/artifact trên RAM từ file ổ cứng (disk)
    mà không cần phải khởi động lại (restart) quá trình uvicorn server.
    Nên được gọi ra sau khi pipeline training (train.py) chạy xong để cập nhật dữ liệu mới.
    """
    try:
        artifacts = reload_all()
        recommender = artifacts["recommender"]
        item_cf = artifacts["item_cf"]

        user_count = len(recommender.user_id_map)
        item_count = len(recommender.item_id_map)
        cf_items = len(item_cf.item_to_index)

        logger.info(
            "All artifacts reloaded: LightFM(%d users, %d items), ItemCF(%d items)",
            user_count,
            item_count,
            cf_items,
        )
        return {
            "status": "reloaded",
            "lightfm_users": str(user_count),
            "lightfm_items": str(item_count),
            "item_cf_items": str(cf_items),
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to reload artifacts")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ======================================================================
# Entry point
# ======================================================================


def run_server() -> None:
    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", "8000"))
    reload_enabled = os.getenv("API_RELOAD", "false").strip().lower() in {"1", "true", "yes", "on"}

    uvicorn.run("api.main:app", host=host, port=port, reload=reload_enabled)


if __name__ == "__main__":
    run_server()