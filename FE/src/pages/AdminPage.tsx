import { useEffect, useMemo, useState } from "react";
import { orderStatuses, ordersApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, OrderStatus, PageResponse } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";

export function AdminPage() {
  const [pageData, setPageData] = useState<PageResponse<Order>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<Record<string, OrderStatus>>(
    {},
  );

  const loadOrders = async (page = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await ordersApi.listAdmin(page, 20);
      setPageData(response);
      const initialStatus = Object.fromEntries(
        response.items.map((order) => [order.id, order.status]),
      ) as Record<string, OrderStatus>;
      setDraftStatus(initialStatus);
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders(0);
  }, []);

  const canSaveOrder = useMemo(() => {
    return (order: Order) =>
      draftStatus[order.id] && draftStatus[order.id] !== order.status;
  }, [draftStatus]);

  const saveStatus = async (orderId: string) => {
    const nextStatus = draftStatus[orderId];
    if (!nextStatus) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await ordersApi.updateStatus(orderId, nextStatus);
      await loadOrders(pageData.page);
      setNotice(`Đã cập nhật trạng thái order ${orderId.slice(0, 8)}.`);
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="surface-card reveal-up">
      <div className="section-headline">
        <h2>Quản lý đơn hàng</h2>
        <p>
          Khu vực dành cho role admin: xem danh sách /v1/orders/admin và cập
          nhật status qua /v1/orders/{"{"}id{"}"}/status.
        </p>
      </div>

      {notice && <p className="alert success">{notice}</p>}
      {error && <p className="alert error">{error}</p>}

      {isLoading ? (
        <p className="placeholder">Đang tải danh sách order admin...</p>
      ) : pageData.items.length === 0 ? (
        <p className="placeholder">Chưa có order nào.</p>
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

              <p>User: {order.userId}</p>
              <p>Tạo lúc: {formatDateTime(order.createdAt)}</p>
              <p>Tổng tiền: {formatCurrency(order.totalAmount)}</p>

              <div className="card-actions">
                <select
                  value={draftStatus[order.id] || order.status}
                  onChange={(event) =>
                    setDraftStatus((prev) => ({
                      ...prev,
                      [order.id]: event.target.value as OrderStatus,
                    }))
                  }
                >
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canSaveOrder(order) || isSaving}
                  onClick={() => void saveStatus(order.id)}
                >
                  Lưu status
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="pagination-row">
        <button
          className="btn btn-muted"
          disabled={!pageData.hasPrevious || isLoading}
          onClick={() => void loadOrders(Math.max(0, pageData.page - 1))}
          type="button"
        >
          Trang trước
        </button>

        <p>
          Trang {pageData.page + 1} / {Math.max(pageData.totalPages, 1)}
        </p>

        <button
          className="btn btn-muted"
          disabled={!pageData.hasNext || isLoading}
          onClick={() => void loadOrders(pageData.page + 1)}
          type="button"
        >
          Trang sau
        </button>
      </footer>
    </section>
  );
}
