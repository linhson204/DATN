import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { ordersApi, reviewsApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, OrderItem, PageResponse } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";
import { Spinner } from "../components/ui/Spinner";
import { OrderStatusBadge, PaymentStatusBadge } from "../components/ui/OrderBadges";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import "../styles/OrdersPage.css";

function getOrderCode(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function ProductThumb({ item }: { item: OrderItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="op-thumb">
      {item.imageUrl && !imgError ? (
        <img
          src={item.imageUrl}
          alt={item.productName}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="op-thumb-fallback">
          {item.productName.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function OrderItemRow({ item }: { item: OrderItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="op-item-row">
      <div className="op-item-img">
        {item.imageUrl && !imgError ? (
          <img
            src={item.imageUrl}
            alt={item.productName}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="op-item-img-fallback">
            {item.productName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="op-item-info">
        <p className="op-item-name">{item.productName}</p>
        <div className="op-item-meta">
          <span>{item.color}</span>
          <span>·</span>
          <span>Size {item.size}</span>
          <span>·</span>
          <span>x{item.quantity}</span>
        </div>
      </div>

      <p className="op-item-price price">{formatCurrency(item.lineTotal)}</p>
    </div>
  );
}

export function OrdersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<Order>>({
    items: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // orderIds that still have at least 1 unreviewed product
  const [pendingReviewIds, setPendingReviewIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-order loading: Map<orderId, 'repay'|'cancel'|null>
  const [orderActions, setOrderActions] = useState<Map<string, string | null>>(new Map());
  // Target order ID for cancel confirmation modal
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const ordersInPage = pageData.items;

  const pageOrderCount = ordersInPage.length;

  const pageItemCount = useMemo(() => {
    return ordersInPage.reduce((total, order) => {
      return total + order.items.reduce((sum, item) => sum + item.quantity, 0);
    }, 0);
  }, [ordersInPage]);

  const pageTotalAmount = useMemo(() => {
    return ordersInPage.reduce((sum, order) => sum + order.totalAmount, 0);
  }, [ordersInPage]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await ordersApi.listMine(page, 10);
        setPageData(response);
        setExpandedIds(new Set());

        // After loading, check which DELIVERED orders still have unreviewed products
        if (user) {
          const deliveredOrders = response.items.filter((o) => o.status === "DELIVERED");
          const pending = new Set<string>();

          await Promise.allSettled(
            deliveredOrders.map(async (order) => {
              // Get unique product ids in this order
              const productIds = [...new Set(order.items.map((i) => i.productId))];
              let hasUnreviewed = false;

              await Promise.allSettled(
                productIds.map(async (productId) => {
                  if (hasUnreviewed) return;
                  try {
                    const reviews = await reviewsApi.list(productId, 0, 50);
                    const userReviewed = reviews.items.some((r) => r.userId === user.id);
                    if (!userReviewed) hasUnreviewed = true;
                  } catch {
                    // Nếu lỗi, coi như chưa review
                    hasUnreviewed = true;
                  }
                })
              );

              if (hasUnreviewed) pending.add(order.id);
            })
          );

          setPendingReviewIds(pending);
        }
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [page, user]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setOrderAction(orderId: string, action: string | null) {
    setOrderActions((prev) => new Map(prev).set(orderId, action));
  }

  async function handleRepay(orderId: string) {
    setOrderAction(orderId, "repay");
    try {
      const updated = await ordersApi.repay(orderId);
      if (updated.paymentUrl) {
        toast.success("Đang chuyển đến trang thanh toán...");
        window.location.href = updated.paymentUrl;
      } else {
        toast.error("Không lấy được link thanh toán, vui lòng thử lại.");
      }
    } catch (rawErr) {
      toast.error(parseApiError(rawErr).message);
    } finally {
      setOrderAction(orderId, null);
    }
  }

  async function executeCancel(orderId: string) {
    setOrderAction(orderId, "cancel");
    try {
      const updated = await ordersApi.cancelOrder(orderId);
      toast.success("Đơn hàng đã được hủy.");
      // Update the order in local state immediately
      setPageData((prev) => ({
        ...prev,
        items: prev.items.map((o) => (o.id === orderId ? updated : o)),
      }));
      setCancelTargetId(null);
    } catch (rawErr) {
      toast.error(parseApiError(rawErr).message);
    } finally {
      setOrderAction(orderId, null);
    }
  }

  return (
    <section className="surface-card orders-page reveal-up">
      {/* ── Header ── */}
      <div className="op-header">
        <div>
          <h2 className="op-title">Lịch sử đơn hàng</h2>

          <p className="op-subtitle">
            Theo dõi tiến trình giao hàng và xem chi tiết từng đơn
          </p>
        </div>
        <Link className="btn btn-outline" to="/products">
          Mua thêm
        </Link>
      </div>

      {/* ── States ── */}
      {isLoading ? (
        <Spinner message="Đang tải đơn hàng..." />
      ) : error ? (
        <p className="alert error">{error}</p>
      ) : ordersInPage.length === 0 ? (
        <EmptyState
          icon="🛍️"
          title="Bạn chưa có đơn hàng nào"
          description="Hãy khám phá bộ sưu tập mới và đặt đơn đầu tiên của bạn."
          actionLabel="Đi đến trang sản phẩm"
          actionTo="/products"
        />
      ) : (
        <>
          {/* ── Stats bar ── */}
          <div className="op-stats-bar">
            <div className="op-stat-chip">
              <div>
                <small>Đơn trong trang</small>
                <strong>{pageOrderCount}</strong>
              </div>
            </div>
            <div className="op-stat-chip">
              <div>
                <small>Sản phẩm đã đặt</small>
                <strong>{pageItemCount}</strong>
              </div>
            </div>
            <div className="op-stat-chip">
              <div>
                <small>Tổng thanh toán</small>
                <strong className="price">{formatCurrency(pageTotalAmount)}</strong>
              </div>
            </div>
          </div>

          {/* ── Orders list ── */}
          <div className="op-list">
            {ordersInPage.map((order) => {
              const isExpanded = expandedIds.has(order.id);
              const previewItems = order.items.slice(0, 4);
              const extraCount = order.items.length - previewItems.length;
              const totalQty = order.items.reduce(
                (s, i) => s + i.quantity,
                0,
              );
              const isDelivered = order.status === "DELIVERED";
              const hasPendingReview = pendingReviewIds.has(order.id);
              const currentAction = orderActions.get(order.id) ?? null;
              const isBusy = currentAction !== null;

              // Show repay + cancel for ZALOPAY/MOMO PENDING orders not yet paid
              const canRepay =
                (order.paymentMethod === "ZALOPAY" || order.paymentMethod === "MOMO") &&
                order.status === "PENDING" &&
                order.paymentStatus === "PENDING";

              // Show cancel-only for COD PENDING, OR repay+cancel for online PENDING
              const canCancel =
                order.status === "PENDING" && order.paymentStatus !== "PAID";

              return (
                <article className="op-card" key={order.id}>
                  {/* Top row */}
                  <div className="op-card-top">
                    <div className="op-card-id-block">
                      <span className="op-code">#{getOrderCode(order.id)}</span>
                      <span className="op-date">
                        {formatDateTime(order.createdAt)}
                      </span>
                    </div>
                    <div className="op-status-group">
                      <OrderStatusBadge status={order.status} />
                      <PaymentStatusBadge paymentStatus={order.paymentStatus} />
                    </div>
                  </div>

                  {/* Unreviewed badge */}
                  {isDelivered && hasPendingReview && (
                    <div className="op-unreviewed-hint">
                      <span className="op-unreviewed-dot" />
                      ⭐ Đơn hàng đã giao — hãy đánh giá sản phẩm của bạn!
                    </div>
                  )}

                  {/* Thumbnail strip */}
                  <div className="op-thumb-strip">
                    {previewItems.map((item) => (
                      <ProductThumb item={item} key={item.orderItemId} />
                    ))}
                    {extraCount > 0 && (
                      <div className="op-thumb op-thumb-more">
                        +{extraCount}
                      </div>
                    )}
                    <div className="op-strip-info">
                      <span>{totalQty} sản phẩm</span>
                      <span className="op-strip-dot">·</span>
                      <span className="price">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded product rows */}
                  {isExpanded && (
                    <div className="op-items-expanded">
                      {order.items.map((item) => (
                        <OrderItemRow item={item} key={item.orderItemId} />
                      ))}

                      {/* Mini metrics */}
                      <div className="op-mini-metrics">
                        <div>
                          <small>Phí vận chuyển</small>
                          <span>{formatCurrency(order.shippingFee)}</span>
                        </div>
                        <div>
                          <small>Tổng thanh toán</small>
                          <span className="price">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Payment action banner ── */}
                  {(canRepay || canCancel) && (
                    <div className="op-payment-banner">
                      <div className="op-payment-banner-text">
                        <span className="op-payment-banner-dot" />
                        {canRepay
                          ? `Chờ thanh toán qua ${order.paymentMethod === "ZALOPAY" ? "ZaloPay" : "MoMo"}`
                          : "Đơn chưa xử lý — bạn có thể hủy"}
                      </div>
                      <div className="op-payment-banner-actions">
                        {canRepay && (
                          <button
                            className="btn op-btn-repay"
                            type="button"
                            disabled={isBusy}
                            id={`op-repay-${order.id}`}
                            onClick={() => void handleRepay(order.id)}
                          >
                            {currentAction === "repay" ? "Đang xử lý..." : "Thanh toán lại"}
                          </button>
                        )}
                        {canCancel && (
                          <button
                            className="btn op-btn-cancel"
                            type="button"
                            disabled={isBusy}
                            id={`op-cancel-${order.id}`}
                            onClick={() => setCancelTargetId(order.id)}
                          >
                            {currentAction === "cancel" ? "Đang hủy..." : "Hủy đơn"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="op-card-actions">
                    <button
                      className="btn btn-muted op-toggle-btn"
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                    >
                      {isExpanded ? "Thu gọn ▲" : "Xem sản phẩm ▼"}
                    </button>
                    <Link
                      className="btn btn-outline"
                      to={`/orders/${order.id}`}
                    >
                      Chi tiết đơn →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {!isLoading && !error && pageData.totalPages > 0 && (
        <footer className="op-pagination">
          <button
            className="btn btn-muted"
            type="button"
            disabled={!pageData.hasPrevious}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            ← Trang trước
          </button>
          <span className="op-page-label">
            Trang {pageData.page + 1} / {Math.max(pageData.totalPages, 1)}
          </span>
          <button
            className="btn btn-muted"
            type="button"
            disabled={!pageData.hasNext}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Trang sau →
          </button>
        </footer>
      )}

      {/* ── Confirm Cancel Modal ── */}
      <ConfirmModal
        isOpen={cancelTargetId !== null}
        onClose={() => {
          if (!cancelTargetId || orderActions.get(cancelTargetId) !== "cancel") {
            setCancelTargetId(null);
          }
        }}
        onConfirm={() => {
          if (cancelTargetId) {
            void executeCancel(cancelTargetId);
          }
        }}
        isLoading={cancelTargetId ? orderActions.get(cancelTargetId) === "cancel" : false}
      />
    </section>
  );
}
