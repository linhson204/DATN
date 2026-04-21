import { useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { beBaseUrl } from "../api/client";
import { parseApiError } from "../api/helpers";
import { useAuth } from "../context/AuthContext";

type AuthTab = "login" | "register";

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, login, register } = useAuth();

  const [tab, setTab] = useState<AuthTab>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loginPayload, setLoginPayload] = useState({
    email: "",
    password: "",
  });

  const [registerPayload, setRegisterPayload] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    phoneNumber: "",
  });

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname || "/products";
  }, [location.state]);

  const handleGoogleLogin = () => {
    window.location.href = `${beBaseUrl}/oauth2/authorization/google`;
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      await login(loginPayload);
      navigate(redirectPath, { replace: true });
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await register({
        username: registerPayload.username.trim(),
        email: registerPayload.email.trim(),
        password: registerPayload.password,
        fullName: registerPayload.fullName.trim() || undefined,
        phoneNumber: registerPayload.phoneNumber.trim() || undefined,
      });

      setNotice(
        response.message || "Đăng ký thành công. Bạn có thể đăng nhập ngay.",
      );
      setTab("login");
      setLoginPayload((prev) => ({
        ...prev,
        email: registerPayload.email,
      }));
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) {
    return (
      <section className="surface-card auth-card reveal-up">
        <h2>Bạn đã đăng nhập</h2>
        <p>
          Xin chào <strong>{user?.name}</strong>. Chọn khu vực bên dưới để tiếp
          tục mua sắm.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/products")}
        >
          Vào trang sản phẩm
        </button>
      </section>
    );
  }

  return (
    <section className="surface-card auth-card reveal-up">
      <div className="tab-strip">
        <button
          className={`tab-button ${tab === "login" ? "active" : ""}`}
          onClick={() => setTab("login")}
          type="button"
        >
          Đăng nhập
        </button>
        <button
          className={`tab-button ${tab === "register" ? "active" : ""}`}
          onClick={() => setTab("register")}
          type="button"
        >
          Đăng ký
        </button>
      </div>

      {notice && <p className="alert success">{notice}</p>}
      {error && <p className="alert error">{error}</p>}

      {tab === "login" ? (
        <form className="form-grid" onSubmit={handleLogin}>
          <label>
            Email
            <input
              required
              type="email"
              value={loginPayload.email}
              onChange={(event) =>
                setLoginPayload((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              placeholder="user@example.com"
            />
          </label>
          <label>
            Mật khẩu
            <input
              required
              type="password"
              value={loginPayload.password}
              onChange={(event) =>
                setLoginPayload((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              placeholder="Tối thiểu 6 ký tự"
            />
          </label>

          <button
            disabled={isSubmitting}
            className="btn btn-primary"
            type="submit"
          >
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      ) : (
        <form className="form-grid" onSubmit={handleRegister}>
          <label>
            Username
            <input
              required
              value={registerPayload.username}
              onChange={(event) =>
                setRegisterPayload((prev) => ({
                  ...prev,
                  username: event.target.value,
                }))
              }
              placeholder="user01"
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={registerPayload.email}
              onChange={(event) =>
                setRegisterPayload((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              placeholder="user@example.com"
            />
          </label>
          <label>
            Mật khẩu
            <input
              required
              type="password"
              value={registerPayload.password}
              onChange={(event) =>
                setRegisterPayload((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              placeholder="Tối thiểu 6 ký tự"
            />
          </label>
          <label>
            Họ và tên
            <input
              value={registerPayload.fullName}
              onChange={(event) =>
                setRegisterPayload((prev) => ({
                  ...prev,
                  fullName: event.target.value,
                }))
              }
              placeholder="Nguyễn Văn A"
            />
          </label>
          <label>
            Số điện thoại
            <input
              value={registerPayload.phoneNumber}
              onChange={(event) =>
                setRegisterPayload((prev) => ({
                  ...prev,
                  phoneNumber: event.target.value,
                }))
              }
              placeholder="0901234567"
            />
          </label>

          <button
            disabled={isSubmitting}
            className="btn btn-primary"
            type="submit"
          >
            {isSubmitting ? "Đang tạo tài khoản..." : "Đăng ký"}
          </button>
        </form>
      )}

      <div className="section-divider">Hoặc</div>

      <button
        type="button"
        className="btn btn-outline"
        onClick={handleGoogleLogin}
      >
        Đăng nhập bằng Google
      </button>
    </section>
  );
}
