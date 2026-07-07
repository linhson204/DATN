import { useEffect, useRef, useState, useCallback } from "react";
import { adminApi } from "../../api/services/adminApi";
import type { UserStats, UserRecommendations } from "../../api/services/adminApi";
import type { UserSummary } from "../../api/services/adminApi";
import { parseApiError } from "../../api/helpers";

// ─── Colour palettes ──────────────────────────────────────────────────────────

const PALETTES = {
  view:     ["#3cd3c1", "#22a99b", "#0d9488", "#0f766e", "#134e4a"],
  cart:     ["#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12"],
  order:    ["#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95"],
  wishlist: ["#ec4899", "#db2777", "#be185d", "#9d174d", "#831843"],
} as const;
type PaletteKey = keyof typeof PALETTES;

const STRATEGY_LABEL: Record<string, string> = {
  lightfm:      "LightFM (Collaborative Filtering)",
  content_based:"Content-Based Filtering",
  popularity:   "Popularity-Based",
  hybrid:       "Hybrid",
};

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function HorizBarChart({
  items, palette, emptyMsg,
}: {
  items: { articleType: string; count: number }[];
  palette: PaletteKey;
  emptyMsg: string;
}) {
  if (items.length === 0) return <p className="user-stats-empty">{emptyMsg}</p>;
  const max = Math.max(...items.map((i) => i.count));
  const colors = PALETTES[palette];
  return (
    <div className="user-stats-bars">
      {items.map((item, idx) => {
        const pct = max > 0 ? (item.count / max) * 100 : 0;
        return (
          <div key={item.articleType} className="user-stats-bar-row">
            <span className="user-stats-bar-label" title={item.articleType}>
              {item.articleType}
            </span>
            <div className="user-stats-bar-track">
              <div
                className="user-stats-bar-fill"
                style={{ width: `${pct}%`, background: colors[idx % colors.length] }}
              />
            </div>
            <span className="user-stats-bar-count">{item.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatsSection({
  title, items, palette, emptyMsg, accentColor,
}: {
  title: string;
  items: { articleType: string; count: number }[];
  palette: PaletteKey;
  emptyMsg: string;
  accentColor: string;
}) {
  return (
    <div className="user-stats-section">
      <div className="user-stats-section-header" style={{ borderLeftColor: accentColor }}>
        <h4>{title}</h4>
        <span className="user-stats-section-total">
          {items.reduce((s, i) => s + i.count, 0)} lượt
        </span>
      </div>
      <HorizBarChart items={items} palette={palette} emptyMsg={emptyMsg} />
    </div>
  );
}

// ─── Format currency ──────────────────────────────────────────────────────────

function fmtVnd(n: number) {
  return n.toLocaleString("vi-VN") + "₫";
}

// ─── Recommended product card ─────────────────────────────────────────────────

function RecommendedCard({
  product,
}: {
  product: {
    id: string;
    name: string;
    brand: string;
    imageUrl: string | null;
    salePrice: number;
    originalPrice: number;
    category: { articleType: string };
    targetGender: string;
    totalStock: number;
    status: boolean;
  };
}) {
  const discount =
    product.originalPrice > product.salePrice
      ? Math.round(
          ((product.originalPrice - product.salePrice) / product.originalPrice) * 100,
        )
      : 0;

  return (
    <div className="ud-rec-card">
      <div className="ud-rec-img-wrap">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="ud-rec-img" />
        ) : (
          <div className="ud-rec-img-placeholder">
            <span>👕</span>
          </div>
        )}
        {discount > 0 && (
          <span className="ud-rec-discount">-{discount}%</span>
        )}
        {!product.status && (
          <span className="ud-rec-oos">Hết hàng</span>
        )}
      </div>
      <div className="ud-rec-body">
        <p className="ud-rec-brand">{product.brand}</p>
        <p className="ud-rec-name" title={product.name}>{product.name}</p>
        <p className="ud-rec-type">{product.category.articleType}</p>
        <div className="ud-rec-price-row">
          <span className="ud-rec-sale">{fmtVnd(product.salePrice)}</span>
          {discount > 0 && (
            <span className="ud-rec-original">{fmtVnd(product.originalPrice)}</span>
          )}
        </div>
        <p className="ud-rec-stock">
          {product.totalStock > 0 ? `Còn ${product.totalStock} sp` : "Hết hàng"}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface Props {
  user: UserSummary;
  onBack: () => void;
}

export function UserDetailPage({ user, onBack }: Props) {
  const [stats, setStats]               = useState<UserStats | null>(null);
  const [recs, setRecs]                 = useState<UserRecommendations | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecs, setLoadingRecs]   = useState(true);
  const [errorStats, setErrorStats]     = useState<string | null>(null);
  const [errorRecs, setErrorRecs]       = useState<string | null>(null);
  const [topN, setTopN]                 = useState(12);
  const abortRef                        = useRef<AbortController | null>(null);

  // ── Fetch stats ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingStats(true);
    setErrorStats(null);
    adminApi
      .getUserStats(user.id)
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err) => { if (!cancelled) setErrorStats(parseApiError(err).message); })
      .finally(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, [user.id]);

  // ── Fetch recommendations ────────────────────────────────────────────────
  const fetchRecs = useCallback(
    (n: number) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoadingRecs(true);
      setErrorRecs(null);
      adminApi
        .getUserRecommendations(user.id, n)
        .then((data) => setRecs(data))
        .catch((err) => setErrorRecs(parseApiError(err).message))
        .finally(() => setLoadingRecs(false));
    },
    [user.id],
  );

  useEffect(() => {
    fetchRecs(topN);
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const handleTopNChange = (n: number) => {
    setTopN(n);
    fetchRecs(n);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const displayName = user.fullName || user.username;
  const initials    = (user.fullName?.[0] ?? user.username?.[0] ?? "?").toUpperCase();

  return (
    <div className="ud-root">
      {/* ── Back bar ── */}
      <div className="ud-back-bar">
        <button type="button" className="ud-back-btn" onClick={onBack}>
          ← Quay lại danh sách
        </button>
      </div>

      {/* ── User hero ── */}
      <div className="ud-hero">
        <div className="ud-hero-avatar">{initials}</div>
        <div className="ud-hero-info">
          <h2 className="ud-hero-name">{displayName}</h2>
          <p className="ud-hero-username">@{user.username}</p>
          <div className="ud-hero-meta">
            {user.email && <span>{user.email}</span>}
            <span
              className={
                user.status ? "db-badge db-badge-active" : "db-badge db-badge-inactive"
              }
            >
              {user.status ? "Hoạt động" : "Bị khóa"}
            </span>
            <span className="db-badge db-badge-inactive">
              {user.membershipLevel ?? "basic"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Behaviour stats ── */}
      <section className="ud-section">
        <div className="ud-section-title">
          <h3>Thống kê hành vi người dùng</h3>
          <span className="ud-section-sub">Phân loại theo articleType</span>
        </div>

        {loadingStats ? (
          <div className="db-loading-wrap">
            <div className="db-spinner" />
            <span>Đang tải thống kê…</span>
          </div>
        ) : errorStats ? (
          <div className="db-error-wrap">⚠️ {errorStats}</div>
        ) : stats ? (
          <div className="user-stats-body">
            <StatsSection
              title="Lịch sử xem sản phẩm"
              items={stats.viewStats}
              palette="view"
              emptyMsg="Chưa có lịch sử xem."
              accentColor="#3cd3c1"
            />
            <StatsSection
              title="Giỏ hàng"
              items={stats.cartStats}
              palette="cart"
              emptyMsg="Giỏ hàng đang trống."
              accentColor="#f97316"
            />
            <StatsSection
              title="Sản phẩm đã đặt"
              items={stats.orderStats}
              palette="order"
              emptyMsg="Chưa có đơn hàng."
              accentColor="#8b5cf6"
            />
            <StatsSection
              title="Wishlist"
              items={stats.wishlistStats}
              palette="wishlist"
              emptyMsg="Wishlist đang trống."
              accentColor="#ec4899"
            />
          </div>
        ) : null}
      </section>

      {/* ── Recommendations ── */}
      <section className="ud-section">
        <div className="ud-section-title">
          <h3>Sản phẩm gợi ý</h3>
          <span className="ud-section-sub">
            {recs?.strategy
              ? `Chiến lược: ${STRATEGY_LABEL[recs.strategy] ?? recs.strategy}`
              : "Hệ gợi ý cá nhân hóa"}
          </span>
          <div className="ud-topn-ctrl">
            <label htmlFor="ud-topn-select" className="ud-topn-label">Hiển thị:</label>
            <select
              id="ud-topn-select"
              className="db-status-select"
              value={topN}
              onChange={(e) => handleTopNChange(Number(e.target.value))}
              disabled={loadingRecs}
            >
              {[6, 12, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n} sản phẩm</option>
              ))}
            </select>
            <button
              type="button"
              className="db-btn db-btn-sm db-btn-outline"
              onClick={() => fetchRecs(topN)}
              disabled={loadingRecs}
              title="Tải lại gợi ý"
            >
              {loadingRecs ? <span className="btn-spinner" /> : "↺ Tải lại"}
            </button>
          </div>
        </div>

        {/* Strategy badge */}
        {recs?.strategy && (
          <div className="ud-strategy-badge">
            <span className="ud-strategy-dot" />
            {STRATEGY_LABEL[recs.strategy] ?? recs.strategy}
          </div>
        )}

        {loadingRecs ? (
          <div className="db-loading-wrap">
            <div className="db-spinner" />
            <span>Đang tải gợi ý từ hệ thống…</span>
          </div>
        ) : errorRecs ? (
          <div className="db-error-wrap">⚠️ {errorRecs}</div>
        ) : recs && recs.products.length === 0 ? (
          <div className="ud-empty-recs">
            <div className="ud-empty-recs-icon">🔍</div>
            <p>Chưa có sản phẩm gợi ý cho người dùng này.</p>
            <p className="ud-empty-recs-sub">
              Người dùng cần có thêm hành vi (xem, mua, thích sản phẩm) để hệ thống đưa ra gợi ý.
            </p>
          </div>
        ) : (
          <div className="ud-rec-grid">
            {recs?.products.map((p, i) => (
              <RecommendedCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
