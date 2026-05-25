import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, OrderItem, PageResponse } from "../types/api";
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

const paymentStatusLabel: Record<string, string> = {
  PENDING: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  UNPAID: "Chưa thanh toán",
};

const paymentStatusIcon: Record<string, string> = {
  PENDING: "💳",
  PAID: "✔",
  UNPAID: "💳",
};

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

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [page]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        <div className="op-loading">
          <div className="op-spinner" />
          <span>Đang tải đơn hàng...</span>
        </div>
      ) : error ? (
        <p className="alert error">{error}</p>
      ) : ordersInPage.length === 0 ? (
        <div className="op-empty">
          <div className="op-empty-icon">🛍️</div>
          <h3>Bạn chưa có đơn hàng nào</h3>
          <p className="placeholder">
            Hãy khám phá bộ sưu tập mới và đặt đơn đầu tiên của bạn.
          </p>
          <Link className="btn btn-primary" to="/products">
            Đi đến trang sản phẩm
          </Link>
        </div>
      ) : (
        <>
          {/* ── Stats bar ── */}
          <div className="op-stats-bar">
            <div className="op-stat-chip">
              <span className="op-stat-icon">🧾</span>
              <div>
                <small>Đơn trong trang</small>
                <strong>{pageOrderCount}</strong>
              </div>
            </div>
            <div className="op-stat-chip">
              <span className="op-stat-icon">👗</span>
              <div>
                <small>Sản phẩm đã đặt</small>
                <strong>{pageItemCount}</strong>
              </div>
            </div>
            <div className="op-stat-chip">
              <span className="op-stat-icon">💳</span>
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
                      <span
                        className={`status status-${order.status.toLowerCase()}`}
                      >
                        {orderStatusIcon[order.status]}&nbsp;
                        {orderStatusLabel[order.status]}
                      </span>
                      <span
                        className={`payment-status payment-status-${order.paymentStatus?.toLowerCase() ?? "pending"}`}
                      >
                        {paymentStatusIcon[order.paymentStatus] ?? "💳"}&nbsp;
                        {paymentStatusLabel[order.paymentStatus] ?? "Chưa thanh toán"}
                      </span>
                    </div>
                  </div>

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
    </section>
  );
}
