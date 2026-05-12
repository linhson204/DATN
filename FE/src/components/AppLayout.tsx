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

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21c-.33 0-.65-.11-.91-.32C5.2 15.86 2 12.97 2 9.5 2 6.46 4.46 4 7.5 4c1.74 0 3.39.81 4.5 2.19C13.11 4.81 14.76 4 16.5 4 19.54 4 22 6.46 22 9.5c0 3.47-3.2 6.36-9.09 11.18-.26.21-.58.32-.91.32z" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.17 13h9.92c.75 0 1.41-.41 1.75-1.03L22 6H6.21l-.94-2H2v2h2l3.6 7.59-1.35 2.45C5.52 17.37 6.48 19 8 19h12v-2H8l1.17-2z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />
    </svg>
  );
}

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
          <a href="/#about" className="nav-link">
            Giới thiệu
          </a>
          <a href="/#contact" className="nav-link">
            Liên hệ
          </a>
          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `nav-link nav-link-admin ${isActive ? "active" : ""}`
              }
            >
              Admin
            </NavLink>
          )}
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
