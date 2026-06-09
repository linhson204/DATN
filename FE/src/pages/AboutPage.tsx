import { Link } from "react-router-dom";
import "../styles/AboutPage.css";

const STATS = [
  { value: "LightFM", label: "AI Engine" },
  { value: "30+", label: "Gợi ý / lần" },
  { value: "2k+", label: "Sản phẩm" },
  { value: "100%", label: "Cá nhân hóa" },
];

const FEATURES = [
  {
    icon: "🤖",
    title: "AI Gợi ý Cá nhân hóa",
    desc: "Hệ thống học máy LightFM phân tích lịch sử tương tác của bạn (xem, thêm giỏ, mua hàng) để gợi ý những sản phẩm phù hợp nhất với gu thẩm mỹ và nhu cầu riêng.",
  },
  {
    icon: "🔍",
    title: "Sản phẩm Tương tự",
    desc: "Khi xem bất kỳ sản phẩm nào, hệ thống tự động tìm kiếm các mặt hàng tương tự dựa trên vector embedding — giúp bạn khám phá thêm những lựa chọn đa dạng cùng phong cách.",
  },
  {
    icon: "📊",
    title: "Cold-start Thông minh",
    desc: "Ngay cả với người dùng mới, hệ thống fallback thông minh sẽ gợi ý sản phẩm phổ biến theo giới tính và xu hướng, đảm bảo trải nghiệm luôn mượt mà từ ngày đầu.",
  },
  {
    icon: "⚡",
    title: "Cập nhật Thời gian thực",
    desc: "Mỗi lần tương tác của bạn đều được ghi nhận tức thì. Hệ thống liên tục tinh chỉnh gợi ý theo hành vi trong ngày — không cần chờ đợi, luôn cập nhật và chính xác.",
  },
];

const CORE_VALUES = [
  {
    icon: "✨",
    title: "Chất lượng",
    desc: "Cam kết mang đến sản phẩm chất lượng cao với nguồn gốc rõ ràng, đạt tiêu chuẩn nghiêm ngặt về vật liệu và gia công.",
  },
  {
    icon: "🎯",
    title: "Cá nhân hóa",
    desc: "Mỗi khách hàng là duy nhất. Chúng tôi ứng dụng AI để đưa đến trải nghiệm mua sắm được thiết kế riêng cho từng cá nhân.",
  },
  {
    icon: "🌱",
    title: "Bền vững",
    desc: "Hướng tới thời trang có trách nhiệm với môi trường, ưu tiên vật liệu thân thiện và quy trình sản xuất xanh.",
  },
];



export function AboutPage() {
  return (
    <div className="about-page reveal-up">

      {/* ── Hero ── */}
      <section className="about-hero">
        <div className="about-hero-overlay">
          <span className="about-hero-eyebrow">Về chúng tôi</span>
          <h2 className="about-hero-title">S and T — Style in Every Thread</h2>
          <p className="about-hero-sub">
            Thương hiệu thời trang Việt Nam ứng dụng trí tuệ nhân tạo để cá nhân hóa trải nghiệm mua sắm của từng khách hàng.
          </p>
          <Link to="/products" className="btn btn-primary about-hero-cta">
            Khám phá Sản phẩm
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="surface-card about-stats-bar">
        {STATS.map((s) => (
          <div key={s.label} className="about-stat-item">
            <span className="about-stat-value">{s.value}</span>
            <span className="about-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── Our Story ── */}
      <section className="surface-card about-story">
        <div className="about-story-text">
          <h3 className="about-section-title">Câu chuyện của chúng tôi</h3>
          <div className="about-title-underline" />
          <p>
            Được thành lập năm 2026 bởi ông Nguyễn Linh Sơn, <strong>S and T</strong> ra đời từ một luận văn tốt nghiệp với tầm nhìn: đưa công nghệ AI vào trải nghiệm mua sắm thời trang.
          </p>
          <p>
            Chúng tôi tin rằng thời trang không chỉ là quần áo — đó là cách bạn thể hiện cá tính và phong cách sống của chính mình. Và với sức mạnh của machine learning, mỗi khách hàng xứng đáng được gợi ý những sản phẩm <em>thực sự phù hợp</em> với họ, chứ không chỉ là danh sách bán chạy nhất.
          </p>
          <p>
            Từ đó, hệ thống gợi ý thông minh dựa trên mô hình <strong>LightFM</strong> ra đời — trái tim công nghệ của S and T.
          </p>
        </div>
        <div className="about-story-visual">
          <div className="about-story-card">
            <div className="about-story-card-icon">🧠</div>
            <div className="about-story-card-label">AI Recommendation</div>
            <div className="about-story-card-sub">LightFM · Matrix Factorization</div>
          </div>
          <div className="about-story-card accent-coral">
            <div className="about-story-card-icon">👗</div>
            <div className="about-story-card-label">2.000+ Sản phẩm</div>
            <div className="about-story-card-sub">Thời trang Nam · Nữ · Unisex</div>
          </div>
        </div>
      </section>

      {/* ── AI Features ── */}
      <section className="about-ai-section">
        <div className="about-section-header">
          <h3 className="about-section-title">Sức mạnh AI Gợi ý</h3>
          <div className="about-title-underline centered" />
          <p className="about-section-desc">
            Trái tim công nghệ của S and T — hệ thống recommendation engine học từ hành vi thực tế của người dùng
          </p>
        </div>
        <div className="about-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="about-feature-card surface-card">
              <span className="about-feature-icon">{f.icon}</span>
              <h4 className="about-feature-title">{f.title}</h4>
              <p className="about-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Core Values ── */}
      <section className="about-values-section">
        <div className="about-section-header">
          <h3 className="about-section-title">Giá trị cốt lõi</h3>
          <div className="about-title-underline centered" />
        </div>
        <div className="about-values-grid">
          {CORE_VALUES.map((v) => (
            <div key={v.title} className="about-value-card surface-card">
              <span className="about-value-icon">{v.icon}</span>
              <h4>{v.title}</h4>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact Info ── */}
      <section className="surface-card about-contact-section">
        <h3 className="about-section-title" style={{ textAlign: "center" }}>Liên hệ với chúng tôi</h3>
        <div className="about-title-underline centered" />
        <div className="about-contact-grid">
          <div className="about-contact-item">
            <span className="about-contact-icon">📧</span>
            <div>
              <strong>Email</strong>
              <a href="mailto:linhson24032004@gmail.com">linhson24032004@gmail.com</a>
            </div>
          </div>
          <div className="about-contact-item">
            <span className="about-contact-icon">📞</span>
            <div>
              <strong>Hotline</strong>
              <a href="tel:0346689326">0346 689 326</a>
            </div>
          </div>
          <div className="about-contact-item">
            <span className="about-contact-icon">📍</span>
            <div>
              <strong>Địa chỉ</strong>
              <span>Hà Nội, Việt Nam</span>
            </div>
          </div>
          <div className="about-contact-item">
            <span className="about-contact-icon">🕒</span>
            <div>
              <strong>Giờ làm việc</strong>
              <span>Thứ 2 – Thứ 7: 8:00 – 20:00</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
