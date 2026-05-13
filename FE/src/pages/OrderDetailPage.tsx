import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ordersApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, OrderItem } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";

const orderStatusLabel: Record<Order["status"], string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

const orderStatusIcon: Record<Order["status"], string> = {
  PENDING: "⏳",
  CONFIRMED: "✅",
  SHIPPING: "🚚",
  DELIVERED: "📦",
  CANCELLED: "✖",
};

function getOrderCode(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function OrderLineCard({ item }: { item: OrderItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="order-line-card">
      <div className="order-line-image">
        {item.imageUrl && !imgError ? (
          <img
            src={item.imageUrl}
            alt={item.productName}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="order-line-img-fallback">
            {item.productName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="order-line-content">
        <div className="order-line-top">
          <h4>{item.productName}</h4>
          <p className="price">{formatCurrency(item.lineTotal)}</p>
        </div>

        <p className="muted">SKU: {item.sku}</p>

        <div className="order-line-meta">
          <span>Màu: {item.color}</span>
          <span>·</span>
          <span>Size: {item.size}</span>
          <span>·</span>
          <span>Số lượng: {item.quantity}</span>
          <span>·</span>
          <span>Đơn giá: {formatCurrency(item.unitPrice)}</span>
        </div>

        <Link className="order-line-link" to={`/products/${item.productId}`}>
          Xem sản phẩm →
        </Link>
      </div>
    </article>
  );
}

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const load = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setOrder(null);

      try {
        const response = await ordersApi.byId(id);
        if (!isCurrent) return;
        setOrder(response);
      } catch (rawError) {
        if (!isCurrent) return;
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <section className="surface-card">
        <div className="op-loading">
          <div className="op-spinner" />
          <span>Đang tải chi tiết đơn hàng...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="surface-card">
        <button
          className="order-detail-back"
          type="button"
          onClick={() => navigate(-1)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Quay lại
        </button>
        <p className="alert error">{error}</p>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="surface-card">
        <button
          className="order-detail-back"
          type="button"
          onClick={() => navigate(-1)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Quay lại
        </button>
        <p>Không tìm thấy đơn hàng.</p>
      </section>
    );
  }

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="order-detail-page reveal-up">
      {/* ── Main card ── */}
      <article className="surface-card order-detail-main-card">
        {/* Back navigation */}
        <button
          className="order-detail-back"
          type="button"
          onClick={() => navigate(-1)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Quay lại danh sách đơn
        </button>

        <div className="order-detail-header">
          <div>
            <h2>Đơn hàng #{getOrderCode(order.id)}</h2>
            <p className="order-detail-id">Mã đầy đủ: {order.id}</p>
          </div>
          <span className={`status status-${order.status.toLowerCase()}`}>
            {orderStatusIcon[order.status]}&nbsp;
            {orderStatusLabel[order.status]}
          </span>
        </div>

        <div className="order-detail-stats">
          <div>
            <small>Ngày đặt</small>
            <p>{formatDateTime(order.createdAt)}</p>
          </div>
          <div>
            <small>Số sản phẩm</small>
            <p>{totalItems}</p>
          </div>
          <div>
            <small>Phí vận chuyển</small>
            <p>{formatCurrency(order.shippingFee)}</p>
          </div>
          <div>
            <small>Tổng thanh toán</small>
            <p className="price">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        <div className="order-items-header">
          <h3>Sản phẩm trong đơn ({order.items.length})</h3>
        </div>

        <div className="order-item-list">
          {order.items.map((item) => (
            <OrderLineCard item={item} key={item.orderItemId} />
          ))}
        </div>
      </article>

      {/* ── Sidebar ── */}
      <aside className="surface-card order-detail-side-card">
        <h3>Thông tin giao hàng</h3>

        <div className="order-detail-info-row">
          <span className="order-detail-info-icon">👤</span>
          <span>
            <strong>Người nhận:</strong>{" "}
            {order.deliveryInfo.recipientName}
          </span>
        </div>
        <div className="order-detail-info-row">
          <span className="order-detail-info-icon">📧</span>
          <span>
            <strong>Email:</strong> {order.deliveryInfo.email}
          </span>
        </div>
        <div className="order-detail-info-row">
          <span className="order-detail-info-icon">📞</span>
          <span>
            <strong>Điện thoại:</strong> {order.deliveryInfo.phoneNumber}
          </span>
        </div>
        <div className="order-detail-info-row">
          <span className="order-detail-info-icon">📍</span>
          <span>
            <strong>Địa chỉ:</strong> {order.deliveryInfo.address}
          </span>
        </div>
        <div className="order-detail-info-row">
          <span className="order-detail-info-icon">🚚</span>
          <span>
            <strong>Phương thức:</strong>{" "}
            {order.deliveryInfo.deliveryMethod}
          </span>
        </div>
        <div className="order-detail-info-row">
          <span className="order-detail-info-icon">🕐</span>
          <span>
            <strong>Thời gian:</strong> {order.deliveryInfo.deliveryTime}
          </span>
        </div>
        {order.deliveryInfo.deliveryInstructions && (
          <div className="order-detail-info-row">
            <span className="order-detail-info-icon">📝</span>
            <span>
              <strong>Ghi chú:</strong>{" "}
              {order.deliveryInfo.deliveryInstructions}
            </span>
          </div>
        )}
      </aside>
    </section>
  );
}
