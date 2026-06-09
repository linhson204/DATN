import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ordersApi, reviewsApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, OrderItem, ReviewItem } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";
import { Spinner } from "../components/ui/Spinner";
// import { OrderStatusBadge, PaymentStatusBadge } from "../components/ui/OrderBadges";
import { useAuth } from "../context/AuthContext";
import "../styles/OrderDetailReview.css";

function getOrderCode(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

// ─── Star Picker ────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="odr-star-picker" aria-label="Chọn sao đánh giá">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`odr-star ${n <= (hover || value) ? "filled" : ""}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${n} sao`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Review Form for one product ────────────────────────────────────────────

function ReviewForm({
  item,
  onDone,
}: {
  item: OrderItem;
  onDone: (productId: string, review: ReviewItem) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Vui lòng chọn số sao.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await reviewsApi.create(item.productId, { rating, comment: comment.trim() || undefined });
      onDone(item.productId, result);
    } catch (rawErr) {
      setError(parseApiError(rawErr).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="odr-review-form" onSubmit={handleSubmit}>
      <div className="odr-review-product-name">{item.productName}</div>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        className="odr-review-textarea"
        placeholder="Nhận xét của bạn về sản phẩm (tùy chọn)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
      />
      {error && <p className="odr-review-error">{error}</p>}
      <button
        type="submit"
        className="btn btn-primary odr-review-submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </form>
  );
}

// ─── Review Section ─────────────────────────────────────────────────────────

function ReviewSection({ order, userId }: { order: Order; userId: string }) {
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [doneMap, setDoneMap] = useState<Map<string, ReviewItem>>(new Map());
  const [isChecking, setIsChecking] = useState(true);
  const checkedRef = useRef(false);

  // Unique product ids in this order
  const uniqueProducts = order.items.reduce<{ productId: string; items: OrderItem[] }[]>((acc, item) => {
    const existing = acc.find((g) => g.productId === item.productId);
    if (existing) existing.items.push(item);
    else acc.push({ productId: item.productId, items: [item] });
    return acc;
  }, []);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    // For each unique product, check if current user already has a review
    const checkAll = async () => {
      const alreadyReviewed = new Set<string>();
      await Promise.allSettled(
        uniqueProducts.map(async ({ productId }) => {
          try {
            // Fetch first page of reviews for this product and look for userId
            const page = await reviewsApi.list(productId, 0, 50);
            const userReview = page.items.find((r) => r.userId === userId);
            if (userReview) alreadyReviewed.add(productId);
          } catch {
            // If error, treat as not reviewed
          }
        })
      );
      setReviewedIds(alreadyReviewed);
      setIsChecking(false);
    };

    void checkAll();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const pendingProducts = uniqueProducts.filter(
    ({ productId }) => !reviewedIds.has(productId) && !doneMap.has(productId)
  );

  if (isChecking) {
    return (
      <div className="odr-review-section surface-card">
        <Spinner message="Đang kiểm tra đánh giá..." />
      </div>
    );
  }

  if (pendingProducts.length === 0 && doneMap.size === 0) {
    return (
      <div className="odr-review-section surface-card">
        <div className="odr-review-all-done">
          <span className="odr-review-done-icon">✅</span>
          <p>Bạn đã đánh giá tất cả sản phẩm trong đơn này.</p>
        </div>
      </div>
    );
  }

  const handleDone = (productId: string, review: ReviewItem) => {
    setDoneMap((prev) => new Map(prev).set(productId, review));
  };

  return (
    <div className="odr-review-section surface-card">
      <div className="odr-review-header">
        <span className="odr-review-header-icon">⭐</span>
        <div>
          <h3 className="odr-review-title">Đánh giá sản phẩm</h3>
          <p className="odr-review-subtitle">
            Đơn hàng đã giao thành công — hãy chia sẻ cảm nhận của bạn!
          </p>
        </div>
      </div>

      <div className="odr-review-list">
        {pendingProducts.map(({ productId, items }) => (
          <ReviewForm
            key={productId}
            item={items[0]}
            onDone={handleDone}
          />
        ))}

        {/* Show completed reviews */}
        {Array.from(doneMap.entries()).map(([productId, review]) => {
          const item = order.items.find((i) => i.productId === productId);
          return (
            <div key={productId} className="odr-review-done-item">
              <div className="odr-review-product-name">
                {item?.productName ?? productId}
              </div>
              <div className="odr-review-done-stars">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < review.rating ? "odr-star filled" : "odr-star"}>★</span>
                ))}
              </div>
              {review.comment && <p className="odr-review-done-comment">"{review.comment}"</p>}
              <span className="odr-review-done-badge">✅ Đã gửi đánh giá</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Order Line Card ─────────────────────────────────────────────────────────

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
        <Spinner message="Đang tải chi tiết đơn hàng..." />
      </section>
    );
  }

  if (error) {
    return (
      <section className="surface-card">
        <button className="order-detail-back" type="button" onClick={() => navigate(-1)}>
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
        <button className="order-detail-back" type="button" onClick={() => navigate(-1)}>
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
  const isDelivered = order.status === "DELIVERED";

  return (
    <section className="order-detail-page reveal-up">
      {/* ── Main card ── */}
      <div className="order-detail-main-col">
        <article className="surface-card order-detail-main-card">
          <button
            className="order-detail-back"
            type="button"
            onClick={() => navigate('/orders')}
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
            {/* <div className="order-detail-status-group">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge paymentStatus={order.paymentStatus} />
            </div> */}
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

        {/* ── Review section (chỉ hiện nếu đơn đã giao) ── */}
        {isDelivered && user && (
          <ReviewSection order={order} userId={user.id} />
        )}
      </div>

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
