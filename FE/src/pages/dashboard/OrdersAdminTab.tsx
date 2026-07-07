import { useCallback, useEffect, useState } from "react";
import { orderStatuses, ordersApi } from "../../api/services";
import { paymentOrdersStatus, paymentStatusLabel } from "../../api/services/ordersApi";
import { parseApiError } from "../../api/helpers";
import type { Order, OrderStatus, PageResponse, PaymentOrderStatus } from "../../types/api";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { IconOrder } from "./DashboardIcons";
import { statusLabel } from "./dashboardTypes";

// ─────────────────────────────────────────────
// Tab: Orders (Quản lý đơn hàng)
// ─────────────────────────────────────────────
export function OrdersAdminTab() {
  const [pageData, setPageData] = useState<PageResponse<Order>>({
    items: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<Record<string, OrderStatus>>(
    {},
  );
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<Record<string, PaymentOrderStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Server-side filter state ──
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "">("");
  const [userNameInput, setUserNameInput] = useState("");
  const [appliedUserName, setAppliedUserName] = useState("");

  // Debounce: 1s sau khi người dùng ngừng gõ mới apply tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedUserName(userNameInput.trim());
    }, 1000);
    return () => clearTimeout(timer);
  }, [userNameInput]);

  const load = useCallback(
    async (page = 0) => {
      setLoading(true);
      setError(null);
      try {
        const res = await ordersApi.listAdmin(
          page,
          15,
          filterStatus || undefined,
          appliedUserName || undefined,
        );
        setPageData(res);
        const init = Object.fromEntries(
          res.items.map((o) => [o.id, o.status]),
        ) as Record<string, OrderStatus>;
        setDraftStatus(init);
        const initPayment = Object.fromEntries(
          res.items.map((o) => [o.id, (o.paymentStatus || "PENDING") as PaymentOrderStatus]),
        ) as Record<string, PaymentOrderStatus>;
        setDraftPaymentStatus(initPayment);
      } catch (raw) {
        setError(parseApiError(raw).message);
      } finally {
        setLoading(false);
      }
    },
    [filterStatus, appliedUserName],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const handleClearFilters = () => {
    setFilterStatus("");
    setUserNameInput("");
    setAppliedUserName("");
  };

  const saveStatus = async (orderId: string) => {
    const next = draftStatus[orderId];
    if (!next) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ordersApi.updateStatus(orderId, next);
      await load(pageData.page);
      setNotice(`Đã cập nhật trạng thái đơn #${orderId.slice(0, 8)}.`);
    } catch (raw) {
      setError(parseApiError(raw).message);
    } finally {
      setSaving(false);
    }
  };

  const savePaymentStatus = async (orderId: string) => {
    const next = draftPaymentStatus[orderId];
    if (!next) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ordersApi.updatePaymentStatus(orderId, next);
      await load(pageData.page);
      setNotice(`Đã cập nhật thanh toán đơn #${orderId.slice(0, 8)}.`);
    } catch (raw) {
      setError(parseApiError(raw).message);
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilter = filterStatus !== "" || appliedUserName !== "";

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <h3>Quản lý đơn hàng</h3>

        {/* Tất cả filter cùng 1 hàng */}
        <div className="panel-header-actions">
          <input
            className="db-search"
            placeholder="Tên người đặt..."
            value={userNameInput}
            onChange={(e) => setUserNameInput(e.target.value)}
            style={{ width: "200px" }}
          />

          <select
            className="db-status-select"
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as OrderStatus | "")
            }
          >
            <option value="">Tất cả trạng thái</option>
            {orderStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>

          {hasActiveFilter && (
            <button
              type="button"
              className="db-btn db-btn-outline db-btn-sm"
              onClick={handleClearFilters}
              title="Xóa bộ lọc"
            >
              ✕ Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Active filter banner */}
      {hasActiveFilter && (
        <div
          style={{
            padding: "0.6rem 1.5rem",
            background: "#eff6ff",
            borderBottom: "1px solid #bfdbfe",
            fontSize: "0.82rem",
            color: "#1d4ed8",
            display: "flex",
            gap: "0.6rem",
            flexWrap: "wrap",
          }}
        >
          <span>🔍 Đang lọc:</span>
          {filterStatus && (
            <span
              style={{
                background: "#dbeafe",
                padding: "0.1rem 0.5rem",
                borderRadius: "999px",
              }}
            >
              Trạng thái: {statusLabel[filterStatus]}
            </span>
          )}
          {appliedUserName && (
            <span
              style={{
                background: "#dbeafe",
                padding: "0.1rem 0.5rem",
                borderRadius: "999px",
              }}
            >
              Người đặt: "{appliedUserName}"
            </span>
          )}
        </div>
      )}

      {notice && (
        <div
          className="db-alert db-alert-success"
          style={{ margin: "1rem 1.5rem 0" }}
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          className="db-alert db-alert-error"
          style={{ margin: "1rem 1.5rem 0" }}
        >
          {error}
        </div>
      )}

      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Địa chỉ</th>
              <th>Tổng tiền</th>
              <th>Giao hàng</th>
              <th>Thanh toán</th>
              <th>Ngày tạo</th>
              <th>Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>
                  <div className="db-loading">Đang tải đơn hàng...</div>
                </td>
              </tr>
            ) : pageData.items.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="db-empty">
                    <IconOrder />
                    {hasActiveFilter
                      ? "Không tìm thấy đơn hàng phù hợp."
                      : "Không có đơn hàng nào."}
                  </div>
                </td>
              </tr>
            ) : (
              pageData.items.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                      }}
                    >
                      #{order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.82rem" }}>
                      <div style={{ fontWeight: 600 }}>
                        {order.deliveryInfo?.recipientName || "—"}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                        {order.deliveryInfo?.phoneNumber || ""}
                      </div>
                    </div>
                  </td>
                  <td
                    style={{
                      fontSize: "0.78rem",
                      color: "#64748b",
                      maxWidth: "180px",
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {order.deliveryInfo?.address || "—"}
                    </div>
                  </td>
                  <td>
                    <strong>{formatCurrency(order.totalAmount)}</strong>
                  </td>
                  {/* ── Delivery status select ── */}
                  <td>
                    <select
                      className="db-status-select"
                      value={draftStatus[order.id] || order.status}
                      onChange={(e) =>
                        setDraftStatus((prev) => ({
                          ...prev,
                          [order.id]: e.target.value as OrderStatus,
                        }))
                      }
                    >
                      {orderStatuses.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  {/* ── Payment status select ── */}
                  <td>
                    <select
                      className="db-status-select"
                      value={draftPaymentStatus[order.id] || order.paymentStatus || "PENDING"}
                      onChange={(e) =>
                        setDraftPaymentStatus((prev) => ({
                          ...prev,
                          [order.id]: e.target.value as PaymentOrderStatus,
                        }))
                      }
                    >
                      {paymentOrdersStatus.map((s: PaymentOrderStatus) => (
                        <option key={s} value={s}>
                          {paymentStatusLabel[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ color: "#0f0f0fff", fontSize: "0.78rem" }}>
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", flexDirection: "column" }}>
                      <button
                        type="button"
                        className="db-btn db-btn-primary db-btn-sm"
                        disabled={
                          draftStatus[order.id] === order.status || saving
                        }
                        onClick={() => void saveStatus(order.id)}
                        title="Lưu trạng thái giao hàng"
                      >
                        Lưu GH
                      </button>
                      <button
                        type="button"
                        className="db-btn db-btn-outline db-btn-sm"
                        disabled={
                          draftPaymentStatus[order.id] === (order.paymentStatus as PaymentOrderStatus) || saving
                        }
                        onClick={() => void savePaymentStatus(order.id)}
                        title="Lưu trạng thái thanh toán"
                      >
                        Lưu TT
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="db-pagination">
        <div className="db-pagination-info">
          Trang {pageData.page + 1} / {Math.max(pageData.totalPages, 1)} •{" "}
          {pageData.totalElements} đơn hàng
          {hasActiveFilter && " (đã lọc)"}
        </div>
        <div className="db-pagination-btns">
          <button
            className="db-page-btn"
            disabled={!pageData.hasPrevious || loading}
            onClick={() => void load(pageData.page - 1)}
            type="button"
          >
            ‹ Trước
          </button>
          <span className="db-page-btn active" style={{ cursor: "default" }}>
            {pageData.page + 1}
          </span>
          <button
            className="db-page-btn"
            disabled={!pageData.hasNext || loading}
            onClick={() => void load(pageData.page + 1)}
            type="button"
          >
            Sau ›
          </button>
        </div>
      </div>
    </div>
  );
}
