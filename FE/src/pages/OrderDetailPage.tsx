import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ordersApi, productsApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, Product } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";

const orderStatusLabel: Record<Order["status"], string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

function getOrderCode(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function getProductImage(product: Product): string | null {
  const candidates = [product.imageUrl, ...(product.imageUrls || [])].filter(
    (item): item is string => Boolean(item && item.trim()),
  );

  return candidates[0] ?? null;
}

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [productImagesById, setProductImagesById] = useState<
    Record<string, string | null>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const load = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setIsImageLoading(false);
      setError(null);
      setOrder(null);
      setProductImagesById({});

      try {
        const response = await ordersApi.byId(id);

        if (!isCurrent) {
          return;
        }

        setOrder(response);
        setIsLoading(false);

        const uniqueProductIds = Array.from(
          new Set(
            response.items
              .map((item) => item.productId)
              .filter((productId) => Boolean(productId)),
          ),
        );

        if (uniqueProductIds.length > 0) {
          setIsImageLoading(true);
          const result = await Promise.allSettled(
            uniqueProductIds.map((productId) => productsApi.byId(productId)),
          );

          if (!isCurrent) {
            return;
          }

          const imageMap = result.reduce<Record<string, string | null>>(
            (acc, item, index) => {
              const productId = uniqueProductIds[index];

              if (item.status === "fulfilled") {
                acc[productId] = getProductImage(item.value);
              } else {
                acc[productId] = null;
              }

              return acc;
            },
            {},
          );

          setProductImagesById(imageMap);
        }
      } catch (rawError) {
        if (!isCurrent) {
          return;
        }

        const apiError = parseApiError(rawError);
        setError(apiError.message);
        setIsLoading(false);
      } finally {
        if (!isCurrent) {
          return;
        }

        setIsImageLoading(false);
      }
    };

    void load();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <section className="surface-card order-detail-loading">
        Đang tải chi tiết đơn hàng...
      </section>
    );
  }

  if (error) {
    return <section className="surface-card alert error">{error}</section>;
  }

  if (!order) {
    return <section className="surface-card">Không tìm thấy đơn hàng.</section>;
  }

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="order-detail-page reveal-up">
      <article className="surface-card order-detail-main-card">
        <div className="order-detail-header">
          <div>
            <h2>Đơn hàng #{getOrderCode(order.id)}</h2>
            <p className="order-detail-id">Mã đầy đủ: {order.id}</p>
          </div>
          <span className={`status status-${order.status.toLowerCase()}`}>
            {orderStatusLabel[order.status]}
          </span>
        </div>

        <div className="order-detail-stats">
          <div>
            <small>Ngày tạo</small>
            <p>{formatDateTime(order.createdAt)}</p>
          </div>
          <div>
            <small>Số sản phẩm</small>
            <p>{totalItems}</p>
          </div>
          <div>
            <small>Phí ship</small>
            <p>{formatCurrency(order.shippingFee)}</p>
          </div>
          <div>
            <small>Tổng</small>
            <p className="price">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        <div className="order-items-header">
          <h3>Sản phẩm trong đơn</h3>
          {isImageLoading && <small>Đang tải ảnh sản phẩm...</small>}
        </div>

        <div className="order-item-list">
          {order.items.map((item) => (
            <article className="order-line-card" key={item.orderItemId}>
              <div className="order-line-image">
                {productImagesById[item.productId] ? (
                  <img
                    src={productImagesById[item.productId] || ""}
                    alt={item.productName}
                    loading="lazy"
                  />
                ) : (
                  <span>
                    {item.size}/{item.color}
                  </span>
                )}
              </div>

              <div className="order-line-content">
                <div className="order-line-top">
                  <h4>{item.productName}</h4>
                  <p className="price">{formatCurrency(item.lineTotal)}</p>
                </div>

                <p className="muted">
                  SKU: {item.sku} | {item.size}/{item.color}
                </p>

                <div className="order-line-meta">
                  <span>Số lượng: {item.quantity}</span>
                  <span>Đơn giá: {formatCurrency(item.unitPrice)}</span>
                </div>

                <Link
                  className="order-line-link"
                  to={`/products/${item.productId}`}
                >
                  Xem sản phẩm
                </Link>
              </div>
            </article>
          ))}
        </div>
      </article>

      <aside className="surface-card order-detail-side-card">
        <div className="section-headline">
          <h3>Thông tin giao hàng</h3>
        </div>

        <p>Người nhận: {order.deliveryInfo.recipientName}</p>
        <p>Email: {order.deliveryInfo.email}</p>
        <p>Số điện thoại: {order.deliveryInfo.phoneNumber}</p>
        <p>Địa chỉ: {order.deliveryInfo.address}</p>
        <p>Phương thức: {order.deliveryInfo.deliveryMethod}</p>
        <p>Thời gian: {order.deliveryInfo.deliveryTime}</p>
        <p>Ghi chú: {order.deliveryInfo.deliveryInstructions || "-"}</p>

        <div className="order-detail-side-actions">
          <Link className="btn btn-outline" to="/orders">
            Quay lại danh sách đơn
          </Link>
        </div>
      </aside>
    </section>
  );
}
