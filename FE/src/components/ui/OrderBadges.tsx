import type { Order } from "../../types/api";

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants – tránh khai báo trùng lặp ở OrdersPage & OrderDetailPage
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<Order["status"], string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};


export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  UNPAID: "Chưa thanh toán",
};

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

interface OrderStatusBadgeProps {
  status: Order["status"];
}

/**
 * Badge hiển thị trạng thái đơn hàng (PENDING, CONFIRMED, SHIPPING, DELIVERED, CANCELLED).
 * Dùng trong OrdersPage và OrderDetailPage.
 *
 * @example
 * <OrderStatusBadge status={order.status} />
 */
export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

interface PaymentStatusBadgeProps {
  paymentStatus?: string | null;
}

/**
 * Badge hiển thị trạng thái thanh toán (PENDING, PAID, UNPAID).
 * Dùng trong OrdersPage và OrderDetailPage.
 *
 * @example
 * <PaymentStatusBadge paymentStatus={order.paymentStatus} />
 */
export function PaymentStatusBadge({ paymentStatus }: PaymentStatusBadgeProps) {
  const status = paymentStatus ?? "PENDING";
  return (
    <span
      className={`payment-status payment-status-${status.toLowerCase()}`}
    >
      {PAYMENT_STATUS_LABEL[status] ?? "Chưa thanh toán"}
    </span>
  );
}
