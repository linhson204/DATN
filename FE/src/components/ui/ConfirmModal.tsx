import { useEffect } from "react";
import { createPortal } from "react-dom";
import "../../styles/ConfirmModal.css";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

/**
 * ConfirmModal: Custom modal popup xác nhận với thiết kế hiện đại (Glassmorphism + Smooth animation).
 * Dùng thay thế cho window.confirm() để giao diện đẹp và đồng nhất.
 * Sử dụng React Portal để luôn hiển thị chính giữa toàn bộ màn hình trình duyệt (viewport).
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận hủy đơn hàng",
  message = "Bạn có chắc chắn muốn hủy đơn hàng này không? Sau khi hủy, trạng thái đơn sẽ chuyển thành Đã hủy và số lượng sản phẩm sẽ được tự động hoàn lại vào kho.",
  confirmLabel = "Có, hủy đơn",
  cancelLabel = "Không, giữ lại",
  isLoading = false,
}: ConfirmModalProps) {
  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="confirm-modal-overlay" onClick={() => !isLoading && onClose()}>
      <div
        className="confirm-modal-card"
        onClick={(e) => e.stopPropagation()} // Ngăn click bên trong card làm đóng modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Header Icon Badge */}
        <div className="confirm-modal-icon-badge">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Content */}
        <div className="confirm-modal-content">
          <h3 id="confirm-modal-title" className="confirm-modal-title">
            {title}
          </h3>
          <p className="confirm-modal-message">{message}</p>
        </div>

        {/* Actions */}
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn btn-muted confirm-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger confirm-btn-submit"
            onClick={() => void onConfirm()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="confirm-spinner" />
                Đang xử lý...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

