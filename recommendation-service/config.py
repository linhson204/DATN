from pathlib import Path

from pydantic import Field
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
    '''Cấu hình ứng dụng cho hệ thống đề xuất sản phẩm sử dụng LightFM.'''
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    '''Cấu hình kết nối cơ sở dữ liệu MySQL.'''
    mysql_url: str = Field(
        default="mysql+pymysql://root:password@localhost:3306/test",
        alias="MYSQL_URL",
    )

    '''Đường dẫn lưu trữ dữ liệu tương tác và mô hình đã huấn luyện.'''
    interactions_output_path: Path = Field(
        default=BASE_DIR / "data" / "interactions.csv",
        alias="INTERACTIONS_OUTPUT_PATH",
    )

    '''Đường dẫn lưu trữ các tệp liên quan đến mô hình và dữ liệu đã xử lý.'''
    artifact_dir: Path = Field(default=BASE_DIR / "models" / "saved", alias="ARTIFACT_DIR")
    model_path: Path = Field(default=BASE_DIR / "models" / "saved" / "lightfm_model.joblib", alias="MODEL_PATH")
    dataset_path: Path = Field(default=BASE_DIR / "models" / "saved" / "dataset.pkl", alias="DATASET_PATH")
    
    '''Đường dẫn lưu trữ mô hình đề xuất sản phẩm dựa trên tương tác giữa
      các sản phẩm (Item-based Collaborative Filtering).'''
    similar_items_model_path: Path = Field(
        default=BASE_DIR / "models" / "saved" / "item_cf.joblib",
        alias="SIMILAR_ITEMS_MODEL_PATH",
    )

    '''Đường dẫn lưu trữ dữ liệu fallback khi không có đủ tương tác để huấn luyện mô hình.'''
    fallback_data_path: Path = Field(
        default=BASE_DIR / "models" / "saved" / "fallback.json",
        alias="FALLBACK_DATA_PATH",
    )

    '''Đường dẫn lưu trữ các tệp đặc trưng người dùng và sản phẩm đã được xử lý.'''
    item_features_path: Path = Field(
        default=BASE_DIR / "models" / "saved" / "item_features.joblib",
        alias="ITEM_FEATURES_PATH",
    )
    user_map_path: Path = Field(default=BASE_DIR / "models" / "saved" / "user_id_map.json", alias="USER_MAP_PATH")
    item_map_path: Path = Field(default=BASE_DIR / "models" / "saved" / "item_id_map.json", alias="ITEM_MAP_PATH")

    '''Các tham số liên quan đến việc tạo tín hiệu tương tác từ dữ liệu lịch sử.'''
    view_lookback_days: int = Field(default=90, alias="VIEW_LOOKBACK_DAYS")
    order_lookback_days: int = Field(default=180, alias="ORDER_LOOKBACK_DAYS")
    wishlist_lookback_days: int = Field(default=180, alias="WISHLIST_LOOKBACK_DAYS")
    include_wishlist_signal: bool = Field(default=False, alias="INCLUDE_WISHLIST_SIGNAL")

    coview_lookback_days: int = Field(default=30, alias="COVIEW_LOOKBACK_DAYS")
    coview_session_minutes: int = Field(default=30, alias="COVIEW_SESSION_MINUTES")

    '''Các trọng số được sử dụng để tính toán tín hiệu tương tác từ các hành động 
    khác nhau của người dùng.'''
    quick_view_weight: float = Field(default=1.0, alias="QUICK_VIEW_WEIGHT")
    detail_view_weight: float = Field(default=2.0, alias="DETAIL_VIEW_WEIGHT")
    deep_view_weight: float = Field(default=3.0, alias="DEEP_VIEW_WEIGHT")
    wishlist_weight: float = Field(default=3.0, alias="WISHLIST_WEIGHT")
    order_weight_scale: float = Field(default=5.0, alias="ORDER_WEIGHT_SCALE")
    max_interaction_weight: float = Field(default=15.0, alias="MAX_INTERACTION_WEIGHT")

    '''Các tham số liên quan đến việc tạo tín hiệu tương tác dựa trên các sản phẩm 
    được xem cùng nhau (co-view).'''
    coview_weight: float = Field(default=1.0, alias="COVIEW_WEIGHT")
    fallback_trending_days: int = Field(default=7, alias="FALLBACK_TRENDING_DAYS")
    fallback_top_n: int = Field(default=50, alias="FALLBACK_TOP_N")

    '''Tham số liên quan đến việc chia dữ liệu thành tập huấn luyện và tập kiểm tra.'''
    split_holdout_days: int = Field(default=10, alias="SPLIT_HOLDOUT_DAYS")

    '''Các siêu tham số cho mô hình LightFM.'''
    lightfm_no_components: int = Field(default=64, alias="LIGHTFM_NO_COMPONENTS")
    lightfm_loss: str = Field(default="warp", alias="LIGHTFM_LOSS")
    lightfm_learning_rate: float = Field(default=0.05, alias="LIGHTFM_LEARNING_RATE")
    lightfm_epochs: int = Field(default=30, alias="LIGHTFM_EPOCHS")
    lightfm_num_threads: int = Field(default=4, alias="LIGHTFM_NUM_THREADS")
    lightfm_item_alpha: float = Field(default=1e-6, alias="LIGHTFM_ITEM_ALPHA")
    lightfm_user_alpha: float = Field(default=1e-6, alias="LIGHTFM_USER_ALPHA")


settings = Settings()