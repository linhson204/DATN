import { IconWarning } from "./DashboardIcons";

// ─────────────────────────────────────────────
// Reusable Confirm Dialog
// ─────────────────────────────────────────────
export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="db-confirm-overlay">
      <div className="db-confirm-box">
        <div className="db-confirm-icon">
          <IconWarning />
        </div>
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="db-confirm-actions">
          <button
            type="button"
            className="db-btn db-btn-outline"
            onClick={onCancel}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="button"
            className="db-btn db-btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : "Xác nhận xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}
