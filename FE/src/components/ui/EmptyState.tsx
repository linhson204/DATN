import { Link } from "react-router-dom";

interface EmptyStateProps {
  /** Emoji hoặc ký tự icon hiển thị lớn */
  icon: string;
  /** Tiêu đề chính */
  title: string;
  /** Mô tả phụ bên dưới tiêu đề */
  description: string;
  /** Text nút hành động */
  actionLabel: string;
  /** Đường dẫn khi nhấn nút */
  actionTo: string;
  /** Variant nút: primary (mặc định) hoặc outline */
  actionVariant?: "primary" | "outline";
}

/**
 * Empty state dùng chung cho các trang khi không có dữ liệu.
 * Dùng trong CartPage, WishlistPage, OrdersPage.
 *
 * @example
 * <EmptyState
 *   icon="🛒"
 *   title="Giỏ hàng trống"
 *   description="Hãy thêm sản phẩm vào giỏ hàng để tiến hành thanh toán."
 *   actionLabel="Khám phá sản phẩm"
 *   actionTo="/products"
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionTo,
  actionVariant = "primary",
}: EmptyStateProps) {
  return (
    <div className="empty-state-wrap">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      <Link className={`btn btn-${actionVariant}`} to={actionTo}>
        {actionLabel}
      </Link>
    </div>
  );
}
