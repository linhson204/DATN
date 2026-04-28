import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Vui lòng nhập đầy đủ các trường.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setNotice(
      "Hiện backend chưa có endpoint đổi mật khẩu trực tiếp cho người dùng đã đăng nhập. Bạn có thể dùng tính năng Quên mật khẩu ở trang đăng nhập để cập nhật mật khẩu.",
    );

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <section className="surface-card password-page reveal-up">
      <div className="section-headline">
        <h2>Đổi mật khẩu</h2>
        <p>Bảo mật tài khoản của bạn bằng mật khẩu mạnh và cập nhật định kỳ.</p>
      </div>

      {error && <p className="alert error">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

      <form className="password-form" onSubmit={handleSubmit}>
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        <label>
          Mật khẩu mới
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>

        <label>
          Xác nhận mật khẩu mới
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>

        <div className="password-actions">
          <button className="btn btn-primary" type="submit">
            Xác nhận
          </button>

          <Link className="btn btn-outline" to="/auth">
            Quên mật khẩu
          </Link>
        </div>
      </form>
    </section>
  );
}
