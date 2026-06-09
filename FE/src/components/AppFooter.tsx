import { Link } from "react-router-dom";
import "./AppFooter.css";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">

        {/* ── Brand ── */}
        <div className="footer-brand">
          <div className="footer-logo">ST</div>
          <p className="footer-brand-desc">
            Thời trang phong cách — Đẳng cấp cho mọi người.
            <br />
            Ứng dụng AI để cá nhân hóa từng gợi ý sản phẩm.
          </p>
        </div>

        {/* ── Links col 1 ── */}
        <div className="footer-col">
          <h4 className="footer-col-title">Về S and T</h4>
          <ul>
            <li><Link to="/about">Giới thiệu</Link></li>
            <li><Link to="/about#contact">Liên hệ</Link></li>
            <li><Link to="/products">Sản phẩm</Link></li>
          </ul>
        </div>

        {/* ── Links col 2 ── */}
        <div className="footer-col">
          <h4 className="footer-col-title">Hỗ trợ</h4>
          <ul>
            <li><span>Câu hỏi thường gặp</span></li>
            <li><span>Chính sách vận chuyển</span></li>
            <li><span>Chính sách đổi trả</span></li>
            <li><span>Chính sách bảo mật</span></li>
          </ul>
        </div>

        {/* ── Links col 3 ── */}
        <div className="footer-col">
          <h4 className="footer-col-title">Tài khoản</h4>
          <ul>
            <li><Link to="/profile">Thông tin cá nhân</Link></li>
            <li><Link to="/orders">Đơn hàng</Link></li>
            <li><Link to="/wishlist">Yêu thích</Link></li>
            <li><Link to="/cart">Giỏ hàng</Link></li>
          </ul>
        </div>

        {/* ── Newsletter ── */}
        <div className="footer-newsletter">
          <h4 className="footer-col-title">Nhận thông tin mới</h4>
          <p>Nhận thông tin về sản phẩm mới và khuyến mãi hấp dẫn.</p>
          <div className="footer-newsletter-row">
            <input
              type="email"
              placeholder="Email của bạn"
              aria-label="Email đăng ký nhận tin"
            />
            <button type="button" className="btn btn-primary footer-sub-btn">
              Đăng ký
            </button>
          </div>
          <div className="footer-socials">
            {/* Facebook */}
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="footer-social-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            {/* Instagram */}
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="footer-social-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            {/* TikTok */}
            <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok" className="footer-social-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z" />
              </svg>
            </a>
            {/* YouTube */}
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="footer-social-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
              </svg>
            </a>
          </div>
        </div>

      </div>

      <div className="footer-bottom">
        <span>© 2026 S and T. Bảo lưu mọi quyền.</span>
        <span>Powered by AI Recommendation Engine · LightFM</span>
      </div>
    </footer>
  );
}
