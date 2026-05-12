import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { beBaseUrl } from "../api/client";
import { parseApiError } from "../api/helpers";
import { authApi } from "../api/services/authApi";
import { useAuth } from "../context/AuthContext";
import "../styles/AuthPage.css";

type AuthTab = "login" | "register";

/* ── SVG icon helpers ── */
const IconEmail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.63 5.63l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const IconName = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const GoogleIcon = () => (
  <svg className="auth-google-icon" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, login, register } = useAuth();

  const [tab, setTab] = useState<AuthTab>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loginPayload, setLoginPayload] = useState({ email: "", password: "" });
  const [registerPayload, setRegisterPayload] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    phoneNumber: "",
  });

  const [forgotPasswordStep, setForgotPasswordStep] = useState<"none" | "email" | "otp" | "reset">("none");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [countdown, setCountdown] = useState(0);

  // OTP email verification modal (after register)
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["" ,"", "", "", "", ""]);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

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
      setError(parseApiError(rawError).message);
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
      await register({
        username: registerPayload.username.trim(),
        email: registerPayload.email.trim(),
        password: registerPayload.password,
        fullName: registerPayload.fullName.trim() || undefined,
        phoneNumber: registerPayload.phoneNumber.trim() || undefined,
      });
      // Open OTP verification modal
      setOtpEmail(registerPayload.email.trim());
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpError(null);
      setOtpNotice("Mã OTP đã được gửi đến email của bạn.");
      setOtpCountdown(60);
      setShowOtpModal(true);
    } catch (rawError) {
      setError(parseApiError(rawError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    const code = otpDigits.join("");
    if (code.length < 6) return;
    setOtpError(null);
    setIsOtpSubmitting(true);
    try {
      await authApi.verifyOtpEmail(otpEmail, code);
      setShowOtpModal(false);
      setTab("login");
      setLoginPayload((prev) => ({ ...prev, email: otpEmail }));
      setNotice("Đăng ký thành công! Hãy đăng nhập để tiếp tục.");
    } catch (rawError) {
      setOtpError(parseApiError(rawError).message);
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setOtpError(null);
    setOtpNotice(null);
    setIsOtpSubmitting(true);
    try {
      await authApi.sendOtp(otpEmail, "REGISTER");
      setOtpNotice("Mã OTP mới đã được gửi.");
      setOtpCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } catch (rawError) {
      setOtpError(parseApiError(rawError).message);
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    // Auto advance
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    // Auto submit when all filled
    if (digit && newDigits.every((d) => d !== "") && newDigits.join("").length === 6) {
      // Use newDigits directly to avoid stale closure
      void (async () => {
        const code = newDigits.join("");
        setOtpError(null);
        setIsOtpSubmitting(true);
        try {
          await authApi.verifyOtpEmail(otpEmail, code);
          setShowOtpModal(false);
          setTab("login");
          setLoginPayload((prev) => ({ ...prev, email: otpEmail }));
          setNotice("Đăng ký thành công! Hãy đăng nhập để tiếp tục.");
        } catch (rawError) {
          setOtpError(parseApiError(rawError).message);
        } finally {
          setIsOtpSubmitting(false);
        }
      })();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleTabChange = (newTab: AuthTab) => {
    setTab(newTab);
    setError(null);
    setNotice(null);
  };

  const handleSendOtpForgotPassword = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!forgotEmail) return;
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await authApi.sendOtp(forgotEmail, "FORGOT_PASSWORD");
      setNotice("Mã OTP đã được gửi đến email của bạn.");
      setForgotPasswordStep("otp");
      setCountdown(60);
    } catch (rawError) {
      setError(parseApiError(rawError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await authApi.verifyOtpForgotPassword(forgotEmail, forgotOtp);
      setForgotPasswordStep("reset");
    } catch (rawError) {
      setError(parseApiError(rawError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await authApi.resetPassword({
        email: forgotEmail,
        otpCode: forgotOtp,
        newPassword: forgotNewPassword,
      });
      setNotice("Khôi phục mật khẩu thành công. Vui lòng đăng nhập lại.");
      setForgotPasswordStep("none");
      setTab("login");
      setForgotEmail("");
      setForgotOtp("");
      setForgotNewPassword("");
    } catch (rawError) {
      setError(parseApiError(rawError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Already authenticated ── */
  if (isAuthenticated) {
    return (
      <div className="auth-fullscreen">
        <div className="auth-bg">
          <div className="auth-orb" />
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="auth-glass-card" style={{ maxWidth: 420 }}>
            <div className="auth-logged-in">
              <div style={{ fontSize: "3rem" }}>👋</div>
              <h2>Bạn đã đăng nhập!</h2>
              <p>Xin chào <strong>{user?.name}</strong>. Tiếp tục mua sắm nhé.</p>
              <button className="auth-submit-btn" onClick={() => navigate("/products")}>
                Vào trang sản phẩm →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-fullscreen">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-orb" />
      </div>

      {/* Left branding panel */}
      <div className="auth-left">
        <div className="auth-brand" onClick={() => navigate("/")} >
          <div className="auth-brand-icon">ST</div>
          <span className="auth-brand-name">S and T Shop</span>
        </div>

        <div className="auth-tagline">
          <h1>
            Mua sắm thông minh,<br />
            <span>tiết kiệm tối đa</span>
          </h1>
          <p>
            Khám phá hàng ngàn sản phẩm chất lượng với giá tốt nhất.
            Được gợi ý cá nhân hóa chỉ dành riêng cho bạn.
          </p>
        </div>

        <div className="auth-features">
          {[
            "Gợi ý sản phẩm thông minh bằng AI",
            "Thanh toán an toàn và bảo mật",
            "Giao hàng nhanh toàn quốc",
            "Chính sách đổi trả dễ dàng",
          ].map((text) => (
            <div className="auth-feature-item" key={text}>
              <div className="auth-feature-dot" />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-right">
        <div className="auth-glass-card">
          {forgotPasswordStep === "email" && (
            <>
              <h2 className="auth-card-title">Quên mật khẩu 🔒</h2>
              <p className="auth-card-subtitle">Nhập email để nhận mã OTP khôi phục</p>
              {notice && <div className="auth-alert success">{notice}</div>}
              {error && <div className="auth-alert error">{error}</div>}
              <form className="auth-form" onSubmit={handleSendOtpForgotPassword}>
                <div className="auth-field">
                  <label htmlFor="forgot-email">Email</label>
                  <div className="auth-field-wrap">
                    <span className="auth-field-icon"><IconEmail /></span>
                    <input
                      id="forgot-email"
                      className="auth-input"
                      required
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                </div>
                <button disabled={isSubmitting} className="auth-submit-btn" type="submit">
                  {isSubmitting ? "Đang gửi..." : "Gửi mã OTP →"}
                </button>
              </form>
              <div className="auth-divider">Hoặc</div>
              <button
                type="button"
                className="auth-google-btn"
                onClick={() => {
                  setForgotPasswordStep("none");
                  setError(null);
                  setNotice(null);
                }}
              >
                Quay lại đăng nhập
              </button>
            </>
          )}

          {forgotPasswordStep === "otp" && (
            <>
              <h2 className="auth-card-title">Xác thực OTP 📩</h2>
              <p className="auth-card-subtitle">Nhập mã 6 số vừa được gửi đến email</p>
              {notice && <div className="auth-alert success">{notice}</div>}
              {error && <div className="auth-alert error">{error}</div>}
              <form className="auth-form" onSubmit={handleVerifyOtp}>
                <div className="auth-field">
                  <label htmlFor="forgot-otp">Mã OTP</label>
                  <div className="auth-field-wrap">
                    <span className="auth-field-icon"><IconLock /></span>
                    <input
                      id="forgot-otp"
                      className="auth-input"
                      required
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                </div>
                <button disabled={isSubmitting} className="auth-submit-btn" type="submit">
                  {isSubmitting ? "Đang xác thực..." : "Xác thực →"}
                </button>
                
                <div style={{ textAlign: "center", marginTop: "1rem" }}>
                   {countdown > 0 ? (
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>Gửi lại sau {countdown}s</span>
                   ) : (
                      <button 
                         type="button" 
                         style={{ background: "transparent", border: "none", color: "#60b4ff", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600" }}
                         onClick={(e) => void handleSendOtpForgotPassword(e)}
                         disabled={isSubmitting}
                      >
                         Gửi lại mã OTP
                      </button>
                   )}
                </div>
              </form>
            </>
          )}

          {forgotPasswordStep === "reset" && (
            <>
              <h2 className="auth-card-title">Tạo mật khẩu mới 🔑</h2>
              <p className="auth-card-subtitle">Vui lòng tạo mật khẩu mới an toàn</p>
              {notice && <div className="auth-alert success">{notice}</div>}
              {error && <div className="auth-alert error">{error}</div>}
              <form className="auth-form" onSubmit={handleResetPassword}>
                <div className="auth-field">
                  <label htmlFor="forgot-new-password">Mật khẩu mới</label>
                  <div className="auth-field-wrap">
                    <span className="auth-field-icon"><IconLock /></span>
                    <input
                      id="forgot-new-password"
                      className="auth-input"
                      required
                      type="password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                    />
                  </div>
                </div>
                <button disabled={isSubmitting} className="auth-submit-btn" type="submit">
                  {isSubmitting ? "Đang cập nhật..." : "Cập nhật mật khẩu →"}
                </button>
              </form>
            </>
          )}

          {forgotPasswordStep === "none" && (
            <>
              {/* Tab strip */}
              <div className="auth-tab-strip">
            <button
              className={`auth-tab-btn ${tab === "login" ? "active" : ""}`}
              onClick={() => handleTabChange("login")}
              type="button"
            >
              Đăng nhập
            </button>
            <button
              className={`auth-tab-btn ${tab === "register" ? "active" : ""}`}
              onClick={() => handleTabChange("register")}
              type="button"
            >
              Đăng ký
            </button>
          </div>

          {/* Title */}
          {tab === "login" ? (
            <>
              <h2 className="auth-card-title">Chào mừng trở lại 👋</h2>
              <p className="auth-card-subtitle">Đăng nhập để tiếp tục mua sắm</p>
            </>
          ) : (
            <>
              <h2 className="auth-card-title">Tạo tài khoản mới ✨</h2>
              <p className="auth-card-subtitle">Điền thông tin để bắt đầu mua sắm</p>
            </>
          )}

          {/* Alerts */}
          {notice && <div className="auth-alert success">{notice}</div>}
          {error && <div className="auth-alert error">{error}</div>}

          {/* Login form */}
          {tab === "login" ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-field">
                <label htmlFor="login-email">Email</label>
                <div className="auth-field-wrap">
                  <span className="auth-field-icon"><IconEmail /></span>
                  <input
                    id="login-email"
                    className="auth-input"
                    required
                    type="email"
                    value={loginPayload.email}
                    onChange={(e) => setLoginPayload((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="login-password">Mật khẩu</label>
                <div className="auth-field-wrap">
                  <span className="auth-field-icon"><IconLock /></span>
                  <input
                    id="login-password"
                    className="auth-input"
                    required
                    type="password"
                    value={loginPayload.password}
                    onChange={(e) => setLoginPayload((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Tối thiểu 6 ký tự"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button disabled={isSubmitting} className="auth-submit-btn" type="submit">
                {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập →"}
              </button>
              <div style={{ textAlign: "right" }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#60b4ff", fontSize: "0.88rem", cursor: "pointer", padding: "0.3rem 0" }}
                  onClick={() => setForgotPasswordStep("email")}
                >
                  Quên mật khẩu?
                </button>
              </div>
            </form>
          ) : (
            /* Register form */
            <form className="auth-form auth-form--register" onSubmit={handleRegister}>
              <div className="auth-form-row">
                <div className="auth-field">
                  <label htmlFor="reg-username">Tên đăng nhập</label>
                  <div className="auth-field-wrap">
                    <span className="auth-field-icon"><IconUser /></span>
                    <input
                      id="reg-username"
                      className="auth-input"
                      required
                      value={registerPayload.username}
                      onChange={(e) => setRegisterPayload((p) => ({ ...p, username: e.target.value }))}
                      placeholder="user01"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-fullname">Họ và tên</label>
                  <div className="auth-field-wrap">
                    <span className="auth-field-icon"><IconName /></span>
                    <input
                      id="reg-fullname"
                      className="auth-input"
                      value={registerPayload.fullName}
                      onChange={(e) => setRegisterPayload((p) => ({ ...p, fullName: e.target.value }))}
                      placeholder="Nguyễn Văn A"
                      autoComplete="name"
                    />
                  </div>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="reg-email">Email</label>
                <div className="auth-field-wrap">
                  <span className="auth-field-icon"><IconEmail /></span>
                  <input
                    id="reg-email"
                    className="auth-input"
                    required
                    type="email"
                    value={registerPayload.email}
                    onChange={(e) => setRegisterPayload((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-form-row">
                <div className="auth-field">
                  <label htmlFor="reg-password">Mật khẩu</label>
                  <div className="auth-field-wrap">
                    <span className="auth-field-icon"><IconLock /></span>
                    <input
                      id="reg-password"
                      className="auth-input"
                      required
                      type="password"
                      value={registerPayload.password}
                      onChange={(e) => setRegisterPayload((p) => ({ ...p, password: e.target.value }))}
                      placeholder="≥ 6 ký tự"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-phone">Số điện thoại</label>
                  <div className="auth-field-wrap">
                    <span className="auth-field-icon"><IconPhone /></span>
                    <input
                      id="reg-phone"
                      className="auth-input"
                      value={registerPayload.phoneNumber}
                      onChange={(e) => setRegisterPayload((p) => ({ ...p, phoneNumber: e.target.value }))}
                      placeholder="0901234567"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>

              <button disabled={isSubmitting} className="auth-submit-btn" type="submit">
                {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản →"}
              </button>
            </form>
          )}

          {/* Divider + Google */}
          <div className="auth-divider">Hoặc</div>

          <button type="button" className="auth-google-btn" onClick={handleGoogleLogin}>
            <GoogleIcon />
            Tiếp tục bằng Google
          </button>
            </>
          )}
        </div>
      </div>

      {/* OTP Email Verification Modal */}
      {showOtpModal && (
        <div className="otp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowOtpModal(false); }}>
          <div className="otp-modal">
            <div className="otp-modal-icon">📬</div>
            <h2 className="otp-modal-title">Xác thực email</h2>
            <p className="otp-modal-subtitle">
              Nhập mã 6 số đã được gửi đến<br />
              <strong>{otpEmail}</strong>
            </p>

            {otpNotice && <div className="auth-alert success" style={{ marginBottom: "1rem" }}>{otpNotice}</div>}
            {otpError && <div className="auth-alert error" style={{ marginBottom: "1rem" }}>{otpError}</div>}

            <div className="otp-input-row">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  className={`otp-digit-input ${digit ? "filled" : ""}`}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onFocus={(e) => e.target.select()}
                  disabled={isOtpSubmitting}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <div className="otp-countdown">
              {otpCountdown > 0 ? (
                <span>Gửi lại mã sau <strong style={{ color: "#60b4ff" }}>{otpCountdown}s</strong></span>
              ) : (
                <button
                  className="otp-resend-btn"
                  onClick={() => void handleResendEmailOtp()}
                  disabled={isOtpSubmitting}
                >
                  Gửi lại mã OTP
                </button>
              )}
            </div>

            <div className="otp-modal-actions">
              <button
                className="auth-submit-btn"
                style={{ borderRadius: "12px" }}
                onClick={() => void handleVerifyEmailOtp()}
                disabled={isOtpSubmitting || otpDigits.join("").length < 6}
              >
                {isOtpSubmitting ? "Đang xác thực..." : "Xác nhận →"}
              </button>
              <button
                className="otp-cancel-btn"
                onClick={() => setShowOtpModal(false)}
                disabled={isOtpSubmitting}
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
