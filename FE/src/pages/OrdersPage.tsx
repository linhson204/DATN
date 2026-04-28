import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, PageResponse } from "../types/api";
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
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [page]);

  return (
    <section className="surface-card orders-page reveal-up">
      <div className="section-headline orders-page-header">
        <div>
          <h2>Lịch sử đơn hàng</h2>
          <p>
            Theo dõi tiến trình giao hàng và xem nhanh sản phẩm trong từng đơn.
          </p>
        </div>
        <Link className="btn btn-outline" to="/products">
          Mua thêm sản phẩm
        </Link>
      </div>

      {isLoading ? (
        <div className="orders-loading-state">
          <div className="orders-loading-dot" />
          <p className="placeholder">Đang tải đơn hàng...</p>
        </div>
      ) : error ? (
        <p className="alert error">{error}</p>
      ) : ordersInPage.length === 0 ? (
        <div className="orders-empty-state">
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
          <div className="orders-overview-grid">
            <article className="orders-overview-card">
              <small>Đơn hàng trong trang</small>
              <p>{pageOrderCount}</p>
            </article>
            <article className="orders-overview-card">
              <small>Sản phẩm đã đặt</small>
              <p>{pageItemCount}</p>
            </article>
            <article className="orders-overview-card">
              <small>Tổng thanh toán</small>
              <p>{formatCurrency(pageTotalAmount)}</p>
            </article>
          </div>

          <div className="orders-list-grid">
            {ordersInPage.map((order) => {
              const itemCount = order.items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              );
              const previewItems = order.items.slice(0, 3);

              return (
                <article className="orders-item-card" key={order.id}>
                  <div className="orders-item-top">
                    <div>
                      <h3>Đơn #{getOrderCode(order.id)}</h3>
                      <p className="orders-item-date">
                        Đặt lúc {formatDateTime(order.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`status status-${order.status.toLowerCase()}`}
                    >
                      {orderStatusLabel[order.status]}
                    </span>
                  </div>

                  <div className="orders-metrics-grid">
                    <div>
                      <small>Số lượng sản phẩm</small>
                      <p>{itemCount}</p>
                    </div>
                    <div>
                      <small>Phí vận chuyển</small>
                      <p>{formatCurrency(order.shippingFee)}</p>
                    </div>
                    <div>
                      <small>Thanh toán</small>
                      <p className="price">
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="orders-preview-row">
                    {previewItems.map((item) => (
                      <span
                        className="orders-preview-pill"
                        key={item.orderItemId}
                      >
                        {item.productName} x{item.quantity}
                      </span>
                    ))}

                    {order.items.length > previewItems.length && (
                      <span className="orders-preview-more">
                        +{order.items.length - previewItems.length} sản phẩm
                        khác
                      </span>
                    )}
                  </div>

                  <div className="orders-item-actions">
                    <Link
                      className="btn btn-outline"
                      to={`/orders/${order.id}`}
                    >
                      Xem chi tiết đơn
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {!isLoading && !error && pageData.totalPages > 0 && (
        <footer className="pagination-row orders-pagination-row">
          <button
            className="btn btn-muted"
            type="button"
            disabled={!pageData.hasPrevious}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            Trang trước
          </button>

          <p>
            Trang {pageData.page + 1} / {Math.max(pageData.totalPages, 1)}
          </p>

          <button
            className="btn btn-muted"
            type="button"
            disabled={!pageData.hasNext}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Trang sau
          </button>
        </footer>
      )}
    </section>
  );
}
