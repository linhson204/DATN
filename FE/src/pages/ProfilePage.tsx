import { useState } from "react";
import { Link } from "react-router-dom";
import { parseApiError } from "../api/helpers";
import { useAuth } from "../context/AuthContext";

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setNotice(null);
    setError(null);
    setIsRefreshing(true);

    try {
      await refreshProfile();
      setNotice("Đã cập nhật lại thông tin cá nhân mới nhất.");
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return (
      <section className="surface-card profile-page reveal-up">
        <h2>Thông tin cá nhân</h2>
        <p className="placeholder">Không tìm thấy phiên đăng nhập.</p>
        <Link className="btn btn-primary" to="/auth">
          Đăng nhập lại
        </Link>
      </section>
    );
  }

  return (
    <section className="surface-card profile-page reveal-up">
      <div className="section-headline profile-headline">
        <div>
          <h2>Thông tin cá nhân</h2>
          <p>
            Quản lý thông tin tài khoản và truy cập nhanh các thao tác bảo mật.
          </p>
        </div>

        <button
          className="btn btn-outline"
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Đang tải..." : "Làm mới dữ liệu"}
        </button>
      </div>

      {notice && <p className="alert success">{notice}</p>}
      {error && <p className="alert error">{error}</p>}

      <div className="profile-grid">
        <article className="profile-card">
          <small>Họ và tên</small>
          <p>{user.name || "-"}</p>
        </article>

        <article className="profile-card">
          <small>Email</small>
          <p>{user.email}</p>
        </article>

        <article className="profile-card">
          <small>Vai trò</small>
          <p className="profile-role">{user.role}</p>
        </article>

        <article className="profile-card">
          <small>ID tài khoản</small>
          <p className="profile-id">{user.id}</p>
        </article>
      </div>

      <div className="profile-actions-row">
        <Link className="btn btn-outline" to="/change-password">
          Đổi mật khẩu
        </Link>
        <Link className="btn btn-outline" to="/orders">
          Xem đơn hàng
        </Link>
      </div>
    </section>
  );
}
