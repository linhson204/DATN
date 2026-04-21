import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="surface-card auth-card">
      <h2>Không tìm thấy trang</h2>
      <p className="placeholder">Route bạn vừa truy cập không tồn tại.</p>
      <Link to="/products" className="btn btn-primary">
        Quay về danh sách sản phẩm
      </Link>
    </section>
  );
}
