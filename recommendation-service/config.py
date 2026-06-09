from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent

"""
Định nghĩa cấu hình ứng dụng sử dụng Pydantic để quản lý các biến môi trường và 
cấu hình mặc định. Các trường cấu hình bao gồm thông tin kết nối cơ sở dữ liệu, 
đường dẫn lưu trữ mô hình và dữ liệu, các tham số liên quan đến việc tạo tín hiệu tương 
tác, cũng như các siêu tham số cho mô hình LightFM. Cấu hình này giúp tách biệt 
logic ứng dụng khỏi các giá trị cấu hình, làm cho mã nguồn dễ bảo trì và linh hoạt 
hơn khi triển khai trên các môi trường khác nhau.
"""
class Settings(BaseSettings):
    # Cấu hình ứng dụng cho hệ thống đề xuất sản phẩm sử dụng LightFM.  
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Cấu hình kết nối cơ sở dữ liệu MySQL.
    mysql_url: str = Field(
        default="mysql+pymysql://root:password@localhost:3306/test",
        alias="MYSQL_URL",
    )

    # Đường dẫn lưu trữ dữ liệu tương tác và mô hình đã huấn luyện.
    interactions_output_path: Path = Field(
        default=BASE_DIR / "data" / "interactions.csv",
        alias="INTERACTIONS_OUTPUT_PATH",
    )

    # Đường dẫn lưu trữ các tệp liên quan đến mô hình và dữ liệu đã xử lý.
    artifact_dir: Path = Field(default=BASE_DIR / "models" / "saved", alias="ARTIFACT_DIR")
    model_path: Path = Field(default=BASE_DIR / "models" / "saved" / "lightfm_model.joblib", alias="MODEL_PATH")
    dataset_path: Path = Field(default=BASE_DIR / "models" / "saved" / "dataset.pkl", alias="DATASET_PATH")
    
    # Đường dẫn lưu trữ dữ liệu fallback khi không có đủ tương tác để huấn luyện mô hình.
    fallback_data_path: Path = Field(
        default=BASE_DIR / "models" / "saved" / "fallback.json",
        alias="FALLBACK_DATA_PATH",
    )

    # Đường dẫn lưu trữ các tệp đặc trưng người dùng và sản phẩm đã được xử lý.
    item_features_path: Path = Field(
        default=BASE_DIR / "models" / "saved" / "item_features.joblib",
        alias="ITEM_FEATURES_PATH",
    )
    user_map_path: Path = Field(default=BASE_DIR / "models" / "saved" / "user_id_map.json", alias="USER_MAP_PATH")
    item_map_path: Path = Field(default=BASE_DIR / "models" / "saved" / "item_id_map.json", alias="ITEM_MAP_PATH")

   # Các tham số liên quan đến việc tạo tín hiệu tương tác từ dữ liệu lịch sử.
    view_lookback_days: int = Field(default=900, alias="VIEW_LOOKBACK_DAYS")
    order_lookback_days: int = Field(default=1800, alias="ORDER_LOOKBACK_DAYS")
    wishlist_lookback_days: int = Field(default=1800, alias="WISHLIST_LOOKBACK_DAYS")
    # Tín hiệu đánh giá sao — luôn bật, cửa sổ thời gian giống order
    review_lookback_days: int = Field(default=1800, alias="REVIEW_LOOKBACK_DAYS")
    
    # Các trọng số được sử dụng để tính toán tín hiệu tương tác từ các hành động 
    # khác nhau của người dùng.
    quick_view_weight: float = Field(default=0.25, alias="QUICK_VIEW_WEIGHT")
    detail_view_weight: float = Field(default=0.5, alias="DETAIL_VIEW_WEIGHT")
    deep_view_weight: float = Field(default=0.75, alias="DEEP_VIEW_WEIGHT")
    wishlist_weight: float = Field(default=1.5, alias="WISHLIST_WEIGHT")
    order_weight_scale: float = Field(default=3.0, alias="ORDER_WEIGHT_SCALE")
    max_interaction_weight: float = Field(default=20.0, alias="MAX_INTERACTION_WEIGHT")

    '''Các tham số liên quan đến việc tạo tín hiệu tương tác dựa trên các sản phẩm 
    được xem cùng nhau (co-view).'''
    fallback_trending_days: int = Field(default=7, alias="FALLBACK_TRENDING_DAYS")
    fallback_top_n: int = Field(default=50, alias="FALLBACK_TOP_N")

    '''Tham số liên quan đến việc chia dữ liệu thành tập huấn luyện và tập kiểm tra.'''
    split_holdout_days: int = Field(default=30, alias="SPLIT_HOLDOUT_DAYS")

    '''Các siêu tham số cho mô hình LightFM.'''
    lightfm_no_components: int = Field(default=64, alias="LIGHTFM_NO_COMPONENTS")
    lightfm_loss: str = Field(default="warp", alias="LIGHTFM_LOSS")
    lightfm_learning_rate: float = Field(default=0.05, alias="LIGHTFM_LEARNING_RATE")
    lightfm_epochs: int = Field(default=50, alias="LIGHTFM_EPOCHS")
    lightfm_num_threads: int = Field(default=4, alias="LIGHTFM_NUM_THREADS")
    lightfm_item_alpha: float = Field(default=1e-4, alias="LIGHTFM_ITEM_ALPHA")
    lightfm_user_alpha: float = Field(default=1e-4, alias="LIGHTFM_USER_ALPHA")
    lightfm_random_state: int = Field(default=42, alias="LIGHTFM_RANDOM_STATE")

    '''Cấu hình tính năng boost theo mùa (Season Boosting) tại inference-time.'''
    enable_season_boost: bool = Field(default=True, alias="ENABLE_SEASON_BOOST")
    season_boost_weight: float = Field(default=0.75, alias="SEASON_BOOST_WEIGHT")

    '''Cấu hình tăng điểm theo mức độ khớp giới tính giữa user và sản phẩm.'''
    enable_gender_match_boost: bool = Field(default=True, alias="ENABLE_GENDER_MATCH_BOOST")
    gender_match_boost_weight: float = Field(default=0.75, alias="GENDER_MATCH_BOOST_WEIGHT")

    # Cấu hình CORS cho frontend gọi API từ trình duyệt.
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:4200",
            "http://127.0.0.1:4200",
        ],
        alias="CORS_ALLOW_ORIGINS",
    )
    cors_allow_credentials: bool = Field(default=True, alias="CORS_ALLOW_CREDENTIALS")
    cors_allow_methods: list[str] = Field(default_factory=lambda: ["*"], alias="CORS_ALLOW_METHODS")
    cors_allow_headers: list[str] = Field(default_factory=lambda: ["*"], alias="CORS_ALLOW_HEADERS")

    @field_validator("cors_allow_origins", "cors_allow_methods", "cors_allow_headers", mode="before")
    @classmethod
    def _parse_cors_csv(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


settings = Settings()