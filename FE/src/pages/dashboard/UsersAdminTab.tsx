import { useEffect, useState, useCallback } from "react";
import { adminApi } from "../../api/services/adminApi";
import type { UserSummary, UserStats } from "../../api/services/adminApi";
import type { PageResponse } from "../../types/api";
import { parseApiError } from "../../api/helpers";
import { IconBarChart } from "./DashboardIcons";
import { UserStatsModal } from "./UserStatsModal";
import { UserDetailPage } from "./UserDetailPage";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const membershipLabel: Record<string, string> = {
  basic: "Cơ bản",
  silver: "Bạc",
  gold: "Vàng",
};

const membershipBadgeClass: Record<string, string> = {
  basic: "db-badge db-badge-inactive",
  silver: "db-badge user-badge-silver",
  gold: "db-badge user-badge-gold",
};

// ─── Pagination component ─────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  totalElements,
  size,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  size: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = page * size + 1;
  const to = Math.min((page + 1) * size, totalElements);

  // Generate page numbers to show (max 7 buttons)
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i);
  } else {
    pages.push(0);
    if (page > 3) pages.push("...");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 4) pages.push("...");
    pages.push(totalPages - 1);
  }

  return (
    <div className="db-pagination">
      <span className="db-pagination-info">
        Hiển thị <strong>{from}–{to}</strong> / <strong>{totalElements}</strong> người dùng
      </span>
      <div className="db-pagination-btns">
        <button
          type="button"
          className="db-page-btn"
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          aria-label="Trang trước"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="db-page-ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`db-page-btn${p === page ? " active" : ""}`}
              onClick={() => onChange(p as number)}
              aria-current={p === page ? "page" : undefined}
            >
              {(p as number) + 1}
            </button>
          ),
        )}
        <button
          type="button"
          className="db-page-btn"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages - 1}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function UsersAdminTab() {
  const [pageData, setPageData] = useState<PageResponse<UserSummary>>({
    items: [],
    page: 0,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Stats modal state
  const [loadingStats, setLoadingStats] = useState<string | null>(null);
  const [activeStats, setActiveStats] = useState<UserStats | null>(null);

  // Detail page state
  const [detailUser, setDetailUser] = useState<UserSummary | null>(null);

  // ── Fetch page ────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listUsers(page, PAGE_SIZE);
      setPageData(data);
      setCurrentPage(page);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(0);
  }, [fetchPage]);

  // ── Search: reset to page 0 on submit ────────────────────────────────────

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    // Note: search filters client-side within current page.
    // For full-text search across all pages, would need a separate BE endpoint.
  };

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (val.trim() === "") {
      setSearch("");
    }
  };

  // ── Open stats modal ──────────────────────────────────────────────────────

  const openStats = useCallback(async (userId: string) => {
    setLoadingStats(userId);
    try {
      const stats = await adminApi.getUserStats(userId);
      setActiveStats(stats);
    } catch (err) {
      alert("Lỗi khi tải thống kê: " + parseApiError(err).message);
    } finally {
      setLoadingStats(null);
    }
  }, []);

  // ── Client-side filter (within current page) ─────────────────────────────

  const filtered = search
    ? pageData.items.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.username?.toLowerCase().includes(q) ||
          u.fullName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      })
    : pageData.items;

  // ── Show detail page ──────────────────────────────────────────────────────

  if (detailUser) {
    return <UserDetailPage user={detailUser} onBack={() => setDetailUser(null)} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="dashboard-panel">
        {/* Panel header */}
        <div className="panel-header">
          <div>
            <h3>Danh sách người dùng</h3>
            {!loading && !error && (
              <span style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem", display: "block" }}>
                Tổng cộng {pageData.totalElements} người dùng · Trang {currentPage + 1} / {pageData.totalPages || 1}
              </span>
            )}
          </div>
          <div className="panel-header-actions">
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.4rem" }}>
              <input
                id="admin-user-search"
                type="search"
                className="db-search"
                placeholder="Lọc trong trang hiện tại..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <button type="submit" className="db-btn db-btn-outline db-btn-sm">
                Lọc
              </button>
            </form>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="db-loading-wrap">
            <div className="db-spinner" />
            <span>Đang tải danh sách người dùng...</span>
          </div>
        ) : error ? (
          <div className="db-error-wrap">
            <span>⚠️ {error}</span>
            <button
              type="button"
              className="db-btn db-btn-sm db-btn-outline"
              onClick={() => void fetchPage(currentPage)}
              style={{ marginLeft: "0.8rem" }}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table" aria-label="Danh sách người dùng">
              <thead>
                <tr>
                  <th style={{ width: "48px" }}>#</th>
                  <th>Họ tên</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Hội viên</th>
                  <th>Trạng thái</th>
                  <th style={{ width: "180px" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: "center", color: "#94a3b8", padding: "2.5rem" }}
                    >
                      {search ? `Không tìm thấy "${search}" trong trang này.` : "Không có người dùng nào."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u, idx) => {
                    const rowNum = currentPage * PAGE_SIZE + idx + 1;
                    return (
                      <tr key={u.id}>
                        <td style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{rowNum}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <div className="user-avatar-mini">
                              {(u.fullName?.[0] ?? u.username?.[0] ?? "?").toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>{u.fullName ?? "—"}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              color: "#64748b",
                              fontFamily: "monospace",
                              fontSize: "0.85rem",
                            }}
                          >
                            @{u.username}
                          </span>
                        </td>
                        <td style={{ color: "#475569", fontSize: "0.875rem" }}>
                          {u.email ?? "—"}
                        </td>
                        <td>
                          <span
                            className={
                              u.role === "ADMIN"
                                ? "db-badge db-badge-confirmed"
                                : "db-badge db-badge-inactive"
                            }
                          >
                            {u.role ?? "customer"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              membershipBadgeClass[u.membershipLevel ?? "basic"] ?? "db-badge"
                            }
                          >
                            {membershipLabel[u.membershipLevel ?? "basic"] ?? u.membershipLevel}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              u.status ? "db-badge db-badge-active" : "db-badge db-badge-inactive"
                            }
                          >
                            {u.status ? "Hoạt động" : "Bị khóa"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              id={`btn-detail-${u.id}`}
                              type="button"
                              className="db-btn db-btn-sm db-btn-primary"
                              onClick={() => setDetailUser(u)}
                              title="Xem chi tiết & gợi ý sản phẩm"
                            >
                              🔍 Chi tiết
                            </button>
                            <button
                              id={`btn-stats-${u.id}`}
                              type="button"
                              className="db-btn db-btn-sm db-btn-outline user-stats-btn"
                              onClick={() => void openStats(u.id)}
                              disabled={loadingStats === u.id}
                              title="Xem thống kê hành vi người dùng"
                            >
                              {loadingStats === u.id ? (
                                <span className="btn-spinner" />
                              ) : (
                                <IconBarChart />
                              )}
                              Thống kê
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && (
          <Pagination
            page={currentPage}
            totalPages={pageData.totalPages}
            totalElements={pageData.totalElements}
            size={PAGE_SIZE}
            onChange={(p) => void fetchPage(p)}
          />
        )}
      </div>

      {/* Stats Modal */}
      {activeStats && (
        <UserStatsModal stats={activeStats} onClose={() => setActiveStats(null)} />
      )}
    </>
  );
}
