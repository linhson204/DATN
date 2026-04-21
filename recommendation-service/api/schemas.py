from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

'''Lược đồ dữ liệu cho API, bao gồm các request và response.'''
class ScoreRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    gender: str | None = Field(None, description="Optional user gender hint (MALE/FEMALE/UNISEX)")
    candidate_product_ids: list[str] = Field(..., min_length=1)

    @field_validator("candidate_product_ids")
    @classmethod
    def validate_candidate_product_ids(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item and item.strip()]
        if not cleaned:
            raise ValueError("candidate_product_ids must contain at least one item")
        return list(dict.fromkeys(cleaned))


class ScoreItem(BaseModel):
    product_id: str
    score: float


class ScoreResponse(BaseModel):
    scores: list[ScoreItem]


class RecommendResponse(BaseModel):
    user_id: str
    strategy: str = Field(
        default="personalized",
        description=(
            "Which strategy produced the results: "
            "'personalized' (LightFM), "
            "'popular_by_gender_age:MALE:25_34', "
            "'popular_by_gender:MALE/FEMALE/UNISEX', "
            "'popular_by_season:Summer/Fall/Winter/Spring', "
            "'trending', or 'popular'."
        ),
    )
    season: str = Field(
        default="",
        description="Mùa hiện tại tại thời điểm gợi ý (Spring/Summer/Fall/Winter).",
    )
    recommendations: list[ScoreItem]


class SimilarItemsResponse(BaseModel):
    product_id: str
    similar_items: list[ScoreItem]