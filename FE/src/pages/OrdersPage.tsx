import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, PageResponse } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";

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
    <section className="surface-card reveal-up">
      <div className="section-headline">
        <h2>Lịch sử đơn hàng</h2>
        <p>Theo dõi các đơn hàng đã đặt và trạng thái hiện tại.</p>
      </div>

      {isLoading ? (
        <p className="placeholder">Đang tải đơn hàng...</p>
      ) : error ? (
        <p className="alert error">{error}</p>
      ) : pageData.items.length === 0 ? (
        <p className="placeholder">Bạn chưa có đơn hàng nào.</p>
      ) : (
        <div className="list-stack">
          {pageData.items.map((order) => (
            <article className="list-item-card" key={order.id}>
              <div className="split-row">
                <h3>Order #{order.id.slice(0, 8)}</h3>
                <span className={`status status-${order.status.toLowerCase()}`}>
                  {order.status}
                </span>
              </div>

              <p>Tạo lúc: {formatDateTime(order.createdAt)}</p>
              <p>Tổng tiền: {formatCurrency(order.totalAmount)}</p>
              <p>Phí ship: {formatCurrency(order.shippingFee)}</p>
              <Link className="btn btn-outline" to={`/orders/${order.id}`}>
                Xem chi tiết
              </Link>
            </article>
          ))}
        </div>
      )}

      <footer className="pagination-row">
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
    </section>
  );
}
