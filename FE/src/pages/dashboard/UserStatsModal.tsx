import { useEffect, useRef } from "react";
import type { UserStats, CategoryStatItem } from "../../api/services/adminApi";

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserStatsModalProps {
  stats: UserStats;
  onClose: () => void;
}

// ─── Colour palette for bars ─────────────────────────────────────────────────

const PALETTES = {
  view: ["#3cd3c1", "#22a99b", "#0d9488", "#0f766e", "#134e4a"],
  cart: ["#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12"],
  order: ["#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95"],
  wishlist: ["#ec4899", "#db2777", "#be185d", "#9d174d", "#831843"],
} as const;

type PaletteKey = keyof typeof PALETTES;

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function HorizBarChart({
  items,
  palette,
  emptyMsg,
}: {
  items: CategoryStatItem[];
  palette: PaletteKey;
  emptyMsg: string;
}) {
  if (items.length === 0) {
    return <p className="user-stats-empty">{emptyMsg}</p>;
  }

  const max = Math.max(...items.map((i) => i.count));
  const colors = PALETTES[palette];

  return (
    <div className="user-stats-bars">
      {items.map((item, idx) => {
        const pct = max > 0 ? (item.count / max) * 100 : 0;
        const color = colors[idx % colors.length];
        return (
          <div key={item.articleType} className="user-stats-bar-row">
            <span className="user-stats-bar-label" title={item.articleType}>
              {item.articleType}
            </span>
            <div className="user-stats-bar-track">
              <div
                className="user-stats-bar-fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="user-stats-bar-count">{item.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function StatsSection({
  title,
  items,
  palette,
  emptyMsg,
  accentColor,
}: {
  title: string;
  items: CategoryStatItem[];
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

// ─── Modal ────────────────────────────────────────────────────────────────────

export function UserStatsModal({ stats, onClose }: UserStatsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      className="db-modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Thống kê hành vi của ${stats.fullName ?? stats.username}`}
    >
      <div className="db-modal db-modal-xl">
        {/* Header */}
        <div className="db-modal-header">
          <div>
            <h3>📊 Thống kê dữ liệu người dùng</h3>
            <p className="user-stats-subtitle">
              {stats.fullName ? `${stats.fullName} · ` : ""}
              <span>@{stats.username}</span>
            </p>
          </div>
          <button
            type="button"
            className="db-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="db-modal-body user-stats-body">
          <StatsSection
            title="Lịch sử xem sản phẩm"
            items={stats.viewStats}
            palette="view"
            emptyMsg="Chưa có lịch sử xem sản phẩm."
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
            emptyMsg="Chưa có đơn hàng nào."
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

        {/* Footer */}
        <div className="db-modal-footer">
          <button type="button" className="db-btn db-btn-outline" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
