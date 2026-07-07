from __future__ import annotations

import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from config import settings

logger = logging.getLogger(__name__)


def build_engine(mysql_url: Optional[str] = None) -> Engine:
    """
    Khởi tạo kết nối SQLAlchemy Engine tới MySQL.
    Ưu tiên dùng URL từ tham số truyền vào (cho phép test linh hoạt), 
    nếu không có thì dùng URL từ file cấu hình settings.mysql_url.
    """
    return create_engine(mysql_url or settings.mysql_url, pool_pre_ping=True)


def _view_weight_map() -> dict[str, float]:
    """
    Trả về một dictionary ánh xạ các loại tương tác (view_type) sang trọng số (weight).
    Các giá trị weight này được lấy từ file cấu hình settings.py để đảm bảo tính nhất quán.
    """
    return {
        "QUICK_VIEW": settings.quick_view_weight,
        "DETAIL_VIEW": settings.detail_view_weight,
        "DEEP_VIEW": settings.deep_view_weight,
    }


def extract_view_interactions(engine: Engine, lookback_days: Optional[int] = None) -> pd.DataFrame:
    """
    Trích xuất dữ liệu tương tác xem sản phẩm (product_view_log) từ database.
    
    Tham số:
        engine: SQLAlchemy engine kết nối tới database.
        lookback_days: Số ngày gần đây để lấy dữ liệu (mặc định lấy từ settings).
        
    Trả về:
        DataFrame chứa các cột: user_id, product_id, weight, created_at, signal.
    """
    days = int(lookback_days or settings.view_lookback_days)
    cutoff = datetime.now() - timedelta(days=days)

    query = text(
        """
        SELECT
            user_id,
            product_id,
            view_type,
            created_at
        FROM product_view_log
        WHERE created_at >= :cutoff
        """
    )

    views = pd.read_sql(query, engine, params={"cutoff": cutoff})
    if views.empty:
        return pd.DataFrame(columns=["user_id", "product_id", "weight", "created_at", "signal"])

    views["weight"] = views["view_type"].map(_view_weight_map()).fillna(settings.quick_view_weight)
    views["signal"] = "VIEW"
    return views[["user_id", "product_id", "weight", "created_at", "signal"]]


def extract_order_interactions(engine: Engine, lookback_days: Optional[int] = None) -> pd.DataFrame:
    """
    Trích xuất dữ liệu tương tác đặt hàng (orders) từ database.

    Chiến lược trọng số:
        Sản phẩm đã mua là tín hiệu dương, mạnh hơn view/wishlist/cart.
        Mục đích: model học rằng đây là tương tác có ý định cao.
        Việc không gợi ý lại sản phẩm đã mua được xử lý ở inference-time
        qua exclude_interacted và order_purchased_item_penalty.

    Tham số:
        engine: SQLAlchemy engine kết nối tới database.
        lookback_days: Số ngày gần đây để lấy dữ liệu (mặc định lấy từ settings).

    Trả về:
        DataFrame chứa các cột: user_id, product_id, weight, created_at, signal.
        weight luôn dương cho sản phẩm đã mua.
    """
    days = int(lookback_days or settings.order_lookback_days)
    cutoff = datetime.now() - timedelta(days=days)

    query = text(
        """
        SELECT
            o.user_id,
            oi.product_id,
            oi.quantity,
            o.created_at
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
                WHERE oi.product_id IS NOT NULL
                    AND o.status <> 'CANCELLED'
                    AND o.created_at >= :cutoff
        """
    )

    orders = pd.read_sql(query, engine, params={"cutoff": cutoff})
    if orders.empty:
        return pd.DataFrame(columns=["user_id", "product_id", "weight", "created_at", "signal"])

    quantity = orders["quantity"].fillna(0).astype(float).clip(lower=0)
    # Gán trọng số dương cho sản phẩm đã mua: model học đây là tín hiệu ý định cao.
    # Chỉ giữ các hàng có quantity > 0 (đã thực sự đặt hàng).
    orders["weight"] = quantity.map(lambda value: float(abs(settings.order_purchased_item_penalty)) if value > 0 else 0.0)
    orders = orders[orders["weight"] != 0.0]
    orders["signal"] = "ORDER"
    return orders[["user_id", "product_id", "weight", "created_at", "signal"]]


def extract_wishlist_interactions(engine: Engine, lookback_days: Optional[int] = None) -> pd.DataFrame:
    """
    Trích xuất dữ liệu tương tác yêu thích (wishlist) từ database.
    
    Tham số:
        engine: SQLAlchemy engine kết nối tới database.
        lookback_days: Số ngày gần đây để lấy dữ liệu (mặc định lấy từ settings).
        
    Trả về:
        DataFrame chứa các cột: user_id, product_id, weight, created_at, signal.
    """
    days = int(lookback_days or settings.wishlist_lookback_days)
    cutoff = datetime.now() - timedelta(days=days)

    query = text(
        """
        SELECT
            user_id,
            product_id,
            created_at
        FROM wishlist
        WHERE created_at >= :cutoff
        """
    )

    wishlist = pd.read_sql(query, engine, params={"cutoff": cutoff})
    if wishlist.empty:
        return pd.DataFrame(columns=["user_id", "product_id", "weight", "created_at", "signal"])

    wishlist["weight"] = settings.wishlist_weight
    wishlist["signal"] = "WISHLIST"
    return wishlist[["user_id", "product_id", "weight", "created_at", "signal"]]


def extract_cart_interactions(engine: Engine, lookback_days: Optional[int] = None) -> pd.DataFrame:
    """
    Trích xuất dữ liệu tương tác thêm vào giỏ hàng (cart_items) từ database.

    Bảng cart_items sử dụng variant_id thay vì product_id, vì vậy cần JOIN
    với bảng product_variants để ánh xạ sang product_id.

    Tham số:
        engine: SQLAlchemy engine kết nối tới database.
        lookback_days: Số ngày gần đây để lấy dữ liệu (mặc định lấy từ settings).

    Trả về:
        DataFrame chứa các cột: user_id, product_id, weight, created_at, signal.
    """
    days = int(lookback_days or settings.cart_lookback_days)
    cutoff = datetime.now() - timedelta(days=days)

    query = text(
        """
        SELECT
            ci.user_id,
            pv.product_id,
            ci.created_at
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.variant_id
        WHERE ci.created_at >= :cutoff
          AND pv.product_id IS NOT NULL
        """
    )

    cart = pd.read_sql(query, engine, params={"cutoff": cutoff})
    if cart.empty:
        return pd.DataFrame(columns=["user_id", "product_id", "weight", "created_at", "signal"])

    cart["weight"] = settings.cart_weight
    cart["signal"] = "CART"
    return cart[["user_id", "product_id", "weight", "created_at", "signal"]]



def combine_interactions(
    views: pd.DataFrame,
    orders: pd.DataFrame,
    wishlist: Optional[pd.DataFrame] = None,
    cart: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Kết hợp dữ liệu từ nhiều nguồn (views, orders, wishlist, cart) thành một DataFrame duy nhất.


    Chiến lược ORDER VETO:
        Sau khi tổng hợp tất cả tín hiệu, nếu một cặp (user_id, product_id) có tín hiệu ORDER,
        weight cuối cùng sẽ được ép thành một mức dương ổn định để phản ánh purchase intent.

        Lý do: nếu purchase chỉ bị cộng thêm như một interaction bình thường, nó có thể bị
        làm loãng bởi nhiều view nhỏ; ép về một mức dương cố định giúp purchase luôn là
        tín hiệu mạnh nhất của cùng một item.
    """
    frames = [views, orders]
    if wishlist is not None and not wishlist.empty:
        frames.append(wishlist)
    if cart is not None and not cart.empty:
        frames.append(cart)

    combined = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if combined.empty:
        return pd.DataFrame(columns=["user_id", "product_id", "weight", "created_at"])

    combined["user_id"] = combined["user_id"].astype(str)
    combined["product_id"] = combined["product_id"].astype(str)
    combined["created_at"] = pd.to_datetime(combined["created_at"], errors="coerce")

    combined = combined.dropna(subset=["user_id", "product_id", "created_at", "weight"])

    # Xác định tập (user_id, product_id) đã có tín hiệu ORDER trước khi aggregate
    purchased_pairs: set[tuple[str, str]] = set()
    if "signal" in combined.columns:
        order_mask = combined["signal"].astype(str).str.upper() == "ORDER"
        purchased_pairs = set(
            zip(combined.loc[order_mask, "user_id"], combined.loc[order_mask, "product_id"])
        )

    aggregated = (
        combined.groupby(["user_id", "product_id"], as_index=False)
        .agg(weight=("weight", "sum"), created_at=("created_at", "max"))
        .sort_values("created_at")
        .reset_index(drop=True)
    )

    weight_cap = settings.max_interaction_weight
    # Clip upper để tránh outlier dương.
    aggregated["weight"] = aggregated["weight"].clip(upper=weight_cap)

    # ORDER override: ép toàn bộ cặp đã mua về một mức dương ổn định.
    if purchased_pairs:
        purchased_weight = float(abs(settings.order_purchased_item_penalty))
        veto_mask = aggregated.apply(
            lambda row: (row["user_id"], row["product_id"]) in purchased_pairs, axis=1
        )
        aggregated.loc[veto_mask, "weight"] = purchased_weight
        logger.info(
            "ORDER override applied: %d purchased pairs forced to weight=%.1f",
            int(veto_mask.sum()),
            purchased_weight,
        )

    logger.info(
        "Combined interactions: %d rows, weight range [%.2f, %.2f] (cap=%.1f)",
        len(aggregated),
        aggregated["weight"].min() if not aggregated.empty else 0,
        aggregated["weight"].max() if not aggregated.empty else 0,
        weight_cap,
    )

    return aggregated


def extract_interactions(engine: Engine) -> pd.DataFrame:
    """
    Hàm chính để trích xuất toàn bộ dữ liệu tương tác từ database.
    Luôn bao gồm: views, orders, wishlist.
    
    Trả về:
        DataFrame chứa toàn bộ dữ liệu tương tác đã được tổng hợp và làm sạch.
    """
    views = extract_view_interactions(engine)
    logger.info("Extracted %d view interactions", len(views))

    orders = extract_order_interactions(engine)
    logger.info("Extracted %d order interactions", len(orders))

    wishlist = None
    try:
        wishlist = extract_wishlist_interactions(engine)
        logger.info("Extracted %d wishlist interactions", len(wishlist))
    except Exception:
        logger.warning("Failed to extract wishlist interactions, skipping")

    cart = None
    try:
        cart = extract_cart_interactions(engine)
        logger.info("Extracted %d cart interactions", len(cart))
    except Exception:
        logger.warning("Failed to extract cart interactions, skipping")

    interactions = combine_interactions(views=views, orders=orders, wishlist=wishlist, cart=cart)
    return interactions


def save_interactions(interactions: pd.DataFrame, output_path: Optional[Path] = None) -> Path:
    """
    Lưu DataFrame chứa dữ liệu tương tác ra file CSV.
    
    Tham số:
        interactions: DataFrame chứa dữ liệu tương tác.
        output_path: Đường dẫn tới file CSV output (tùy chọn, nếu không có sẽ lấy từ settings).
        
    Trả về:
        Path object trỏ tới file CSV đã được lưu.
    """
    output = Path(output_path or settings.interactions_output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    interactions.to_csv(output, index=False)
    return output


def main() -> None:
    """
    Hàm main để chạy script từ dòng lệnh.
    Thực hiện các bước: build engine -> extract interactions -> save interactions.
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Extract interactions from MySQL and save as CSV.")
    parser.add_argument("--mysql-url", dest="mysql_url", default=None)
    parser.add_argument("--output", dest="output", default=None)
    args = parser.parse_args()

    engine = build_engine(args.mysql_url)
    interactions = extract_interactions(engine)
    output_path = save_interactions(interactions, args.output)

    print(f"Saved {len(interactions)} interactions to {output_path}")


if __name__ == "__main__":
    main()