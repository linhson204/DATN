import "../../styles/global.css";

interface SpinnerProps {
  /** Văn bản hiển thị bên cạnh spinner. Mặc định: "Đang tải..." */
  message?: string;
  /** Class CSS bổ sung cho wrapper, dùng để căn chỉnh trong từng context */
  className?: string;
}

/**
 * Spinner loading dùng chung toàn app.
 *
 * @example
 * // Dùng đơn giản
 * if (isLoading) return <Spinner />;
 *
 * // Tuỳ chỉnh message
 * if (isLoading) return <Spinner message="Đang tải giỏ hàng..." />;
 *
 * // Inline với class wrapper riêng
 * {isLoading && <Spinner message="Đang tải..." className="my-loading-wrapper" />}
 */
export function Spinner({ message = "Đang tải...", className = "" }: SpinnerProps) {
  return (
    <div className={`app-spinner-wrap ${className}`.trim()} role="status" aria-live="polite">
      <div className="app-spinner" aria-hidden="true" />
      {message && <span className="app-spinner-msg">{message}</span>}
    </div>
  );
}
