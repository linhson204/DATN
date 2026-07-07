// ─────────────────────────────────────────────
// Shared types & constants for Dashboard
// ─────────────────────────────────────────────
import type { OrderStatus } from "../../types/api";

export type Tab = "overview" | "products" | "categories" | "orders" | "users";

export type RevenueByStatus = {
  status: OrderStatus;
  count: number;
  total: number;
};

export const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

export const statusBadgeClass: Record<OrderStatus, string> = {
  PENDING: "db-badge db-badge-pending",
  CONFIRMED: "db-badge db-badge-confirmed",
  SHIPPING: "db-badge db-badge-shipping",
  DELIVERED: "db-badge db-badge-delivered",
  CANCELLED: "db-badge db-badge-cancelled",
};

export const statusLegendColor: Record<OrderStatus, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  SHIPPING: "#8b5cf6",
  DELIVERED: "#10b981",
  CANCELLED: "#ef4444",
};
