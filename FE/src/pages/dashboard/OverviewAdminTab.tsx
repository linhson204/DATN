import { useMemo } from "react";
import { orderStatuses, ordersApi, productCategoriesApi, productsApi } from "../../api/services";
import type { Order, PageResponse, Product, ProductCategory } from "../../types/api";
import { formatCurrency, formatDateTime } from "../../utils/format";
import {
  IconCategory,
  IconDashboard,
  IconOrder,
  IconProduct,
} from "./DashboardIcons";
import { statusBadgeClass, statusLabel, statusLegendColor, type RevenueByStatus } from "./dashboardTypes";

// ─────────────────────────────────────────────
// Tab: Overview (Tổng quan)
// ─────────────────────────────────────────────
export function OverviewAdminTab({
  orders,
  products,
  categories,
  loadingOrders,
}: {
  orders: PageResponse<Order>;
  products: PageResponse<Product>;
  categories: ProductCategory[];
  loadingOrders: boolean;
}) {
  const revenueByStatus = useMemo<RevenueByStatus[]>(() => {
    const map: Record<string, RevenueByStatus> = {};
    for (const status of orderStatuses) {
      map[status] = { status, count: 0, total: 0 };
    }
    for (const order of orders.items) {
      if (map[order.status]) {
        map[order.status].count += 1;
        if (order.status === "DELIVERED") {
          map[order.status].total += order.totalAmount;
        }
      }
    }
    return Object.values(map);
  }, [orders.items]);

  const totalRevenue = useMemo(
    () =>
      orders.items
        .filter((o) => o.status === "DELIVERED")
        .reduce((s, o) => s + o.totalAmount, 0),
    [orders.items],
  );

  const maxRevenue = useMemo(
    () => Math.max(...revenueByStatus.map((r) => r.total), 1),
    [revenueByStatus],
  );

  return (
    <>
      {/* Stat Cards */}
      <div className="stat-cards-grid">
        <div className="stat-card cyan">
          <div className="stat-card-icon">
            <IconOrder />
          </div>
          <div className="stat-card-label">Tổng đơn hàng</div>
          <div className="stat-card-value">
            {loadingOrders ? "..." : orders.totalElements}
          </div>
          <div className="stat-card-sub">tổng số đơn</div>
        </div>

        <div className="stat-card coral">
          <div className="stat-card-icon">
            <IconProduct />
          </div>
          <div className="stat-card-label">Sản phẩm</div>
          <div className="stat-card-value">{products.totalElements}</div>
          <div className="stat-card-sub">tổng sản phẩm</div>
        </div>

        <div className="stat-card violet">
          <div className="stat-card-icon">
            <IconCategory />
          </div>
          <div className="stat-card-label">Danh mục</div>
          <div className="stat-card-value">{categories.length}</div>
          <div className="stat-card-sub">loại sản phẩm</div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-card-icon">
            <IconDashboard />
          </div>
          <div className="stat-card-label">Doanh thu</div>
          <div className="stat-card-value" style={{ fontSize: "1.3rem" }}>
            {formatCurrency(totalRevenue)}
          </div>
          <div className="stat-card-sub">đơn đã giao</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="revenue-section">
        <h3>📊 Thống kê doanh thu theo trạng thái đơn hàng</h3>
        <div className="revenue-bars">
          {revenueByStatus.map((item) => {
            const heightPct =
              item.total > 0 ? (item.total / maxRevenue) * 100 : 4;
            return (
              <div className="revenue-bar-wrap" key={item.status}>
                <div className="revenue-bar-amount">
                  {item.total > 0 ? formatCurrency(item.total) : "—"}
                </div>
                <div
                  className={`revenue-bar ${item.status.toLowerCase()}`}
                  style={{ height: `${heightPct}%` }}
                  title={`${statusLabel[item.status]}: ${formatCurrency(item.total)}`}
                />
                <div className="revenue-bar-label">
                  {statusLabel[item.status]}
                  <br />
                  <span style={{ color: "#94a3b8" }}>({item.count})</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="revenue-legend">
          {revenueByStatus.map((item) => (
            <div className="legend-item" key={item.status}>
              <div
                className="legend-dot"
                style={{ background: statusLegendColor[item.status] }}
              />
              {statusLabel[item.status]}: {item.count} đơn
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="dashboard-panel">
        <div className="panel-header">
          <h3>Đơn hàng gần đây</h3>
        </div>
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {orders.items.slice(0, 5).map((order) => (
                <tr key={order.id}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                      #{order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td style={{ color: "#475569", fontSize: "0.82rem" }}>
                    {order.deliveryInfo?.recipientName ||
                      order.userId.slice(0, 8)}
                  </td>
                  <td>
                    <strong>{formatCurrency(order.totalAmount)}</strong>
                  </td>
                  <td>
                    <span
                      className={`db-badge db-badge-${order.paymentStatus?.toLowerCase() || "pending"}`}
                    >
                      {order.paymentMethod}
                    </span>
                  </td>
                  <td>
                    <span className={statusBadgeClass[order.status]}>
                      {statusLabel[order.status]}
                    </span>
                  </td>
                  <td style={{ color: "#64748b", fontSize: "0.8rem" }}>
                    {formatDateTime(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.items.length === 0 && (
            <div className="db-empty">Chưa có đơn hàng nào.</div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Preload helper (used by DashboardPage shell)
// ─────────────────────────────────────────────
export async function loadOverviewData() {
  return Promise.all([
    ordersApi.listAdmin(0, 50),
    productsApi.list({ page: 0, size: 1 }),
    productCategoriesApi.list(),
  ]);
}
