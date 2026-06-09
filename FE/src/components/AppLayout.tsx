import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../context/AuthContext";
import { IconAdmin, IconCart, IconHeart, IconUser } from "./icons/AppIcons";
import { AppFooter } from "./AppFooter";


export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Đăng xuất thành công!");
      navigate("/auth");
    } catch {
      toast.error("Đăng xuất thất bại.");
    }
  };

  const handleBrandKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate("/");
    }
  };

  const navigateFromMenu = (path: string) => {
    setIsAccountOpen(false);
    navigate(path);
  };

  useEffect(() => {
    setIsAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isAccountOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!accountMenuRef.current?.contains(target)) {
        setIsAccountOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountOpen]);

  return (
    <div className="app-shell">
      <header className="app-header reveal-down">
        <div
          className="brand-wrap"
          onClick={() => navigate("/")}
          onKeyDown={handleBrandKeyDown}
          role="button"
          tabIndex={0}
        >
          <div className="brand-logo" aria-hidden="true">
            ST
          </div>
          <div>
            <h1 className="brand-title">S and T</h1>
            <p className="eyebrow">Style in Every Thread</p>
          </div>
        </div>

        <nav className="top-nav">
          <NavLink
            end
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            Trang chủ
          </NavLink>
          <NavLink
            to="/products"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            Sản phẩm
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            Giới thiệu
          </NavLink>
        </nav>

        <div className="header-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate("/wishlist")}
            aria-label="Yêu thích"
          >
            <IconHeart />
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={() => navigate("/cart")}
            aria-label="Giỏ hàng"
          >
            <IconCart />
          </button>

          {user?.role === "admin" && (
            <button
              className="icon-button"
              type="button"
              onClick={() => navigate("/dashboard")}
              aria-label="Quản lý"
              title="Trang quản lý Admin"
              style={{ color: "#ff8655" }}
            >
              <IconAdmin />
            </button>
          )}

          {isAuthenticated ? (
            <div className="account-menu" ref={accountMenuRef}>
              <button
                className="icon-button account-trigger"
                type="button"
                aria-label="Mở menu tài khoản"
                aria-haspopup="menu"
                aria-expanded={isAccountOpen}
                onClick={() => setIsAccountOpen((prev) => !prev)}
              >
                <IconUser />
                <span className="account-trigger-label">
                  {user?.name || "Tài khoản"}
                </span>
              </button>

              {isAccountOpen && (
                <div className="account-dropdown reveal-down" role="menu">
                  <button
                    className="account-dropdown-item"
                    type="button"
                    onClick={() => navigateFromMenu("/profile")}
                  >
                    Thông tin cá nhân
                  </button>
                  <button
                    className="account-dropdown-item"
                    type="button"
                    onClick={() => navigateFromMenu("/change-password")}
                  >
                    Đổi mật khẩu
                  </button>
                  <button
                    className="account-dropdown-item"
                    type="button"
                    onClick={() => navigateFromMenu("/orders")}
                  >
                    Đơn hàng
                  </button>
                  {user?.role === "admin" && (
                    <button
                      className="account-dropdown-item"
                      type="button"
                      onClick={() => navigateFromMenu("/dashboard")}
                      style={{ color: "#ff8655", fontWeight: 700 }}
                    >
                      🛡 Quản lý
                    </button>
                  )}
                  <button
                    className="account-dropdown-item danger"
                    type="button"
                    onClick={() => {
                      setIsAccountOpen(false);
                      void handleLogout();
                    }}
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="icon-button"
              type="button"
              onClick={() => navigate("/auth")}
              aria-label="Tài khoản"
            >
              <IconUser />
            </button>
          )}

          {!isAuthenticated && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate("/auth")}
            >
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      <main className="page-frame">
        <Outlet />
      </main>

      <AppFooter />

      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
        style={{ zIndex: 9999 }}
      />
    </div>
  );
}
