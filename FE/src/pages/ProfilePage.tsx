import { useState } from "react";
import { Link } from "react-router-dom";
import { parseApiError } from "../api/helpers";
import { authApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import type { UpdateProfilePayload } from "../types/api";
import "../styles/ProfilePage.css";

// ── Helpers ────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function genderLabel(g: string | null | undefined): string {
  if (!g) return "–";
  const map: Record<string, string> = {
    male: "Nam",
    female: "Nữ",
    other: "Khác",
  };
  return map[g.toLowerCase()] ?? g;
}

type MembershipConfig = {
  label: string;
  icon: string;
  colorClass: string;
};

const MEMBERSHIP: Record<string, MembershipConfig> = {
  basic:    { label: "Thành viên",  icon: "🥉", colorClass: "membership-basic"    },
  silver:   { label: "Bạc",         icon: "🥈", colorClass: "membership-silver"   },
  gold:     { label: "Vàng",        icon: "🥇", colorClass: "membership-gold"     },
  platinum: { label: "Bạch kim",    icon: "💎", colorClass: "membership-platinum" },
};

function getMembership(level: string | null | undefined): MembershipConfig {
  if (!level) return MEMBERSHIP.basic;
  return MEMBERSHIP[level.toLowerCase()] ?? MEMBERSHIP.basic;
}

// ── Component ──────────────────────────────────────────────────

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Edit mode state ──
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<UpdateProfilePayload>({});

  const handleRefresh = async () => {
    setNotice(null);
    setError(null);
    setIsRefreshing(true);
    try {
      await refreshProfile();
      setNotice("Đã cập nhật thông tin cá nhân mới nhất.");
    } catch (rawError) {
      setError(parseApiError(rawError).message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const startEdit = () => {
    if (!user) return;
    setEditForm({
      fullName: user.name ?? "",
      gender: user.gender ?? "",
      birthYear: user.birthYear ?? undefined,
      phoneNumber: user.phone ?? "",
      address: user.address ?? "",
    });
    setNotice(null);
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      // Chỉ gửi các trường có giá trị (partial update)
      const payload: UpdateProfilePayload = {};
      if (editForm.fullName !== undefined && editForm.fullName.trim() !== "") payload.fullName = editForm.fullName.trim();
      if (editForm.gender !== undefined && editForm.gender !== "") payload.gender = editForm.gender;
      if (editForm.birthYear !== undefined) payload.birthYear = editForm.birthYear;
      if (editForm.phoneNumber !== undefined) payload.phoneNumber = editForm.phoneNumber.trim();
      if (editForm.address !== undefined) payload.address = editForm.address.trim();

      await authApi.updateMe(payload);
      await refreshProfile();
      setNotice("Cập nhật thông tin thành công! ✅");
      setIsEditing(false);
      setEditForm({});
    } catch (rawError) {
      setError(parseApiError(rawError).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <section className="surface-card profile-page reveal-up">
        <h2>Thông tin cá nhân</h2>
        <p className="placeholder">Không tìm thấy phiên đăng nhập.</p>
        <Link className="btn btn-primary" to="/auth">
          Đăng nhập lại
        </Link>
      </section>
    );
  }

  const membership = getMembership(user.membershipLevel);
  const initials = (user.name || user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <section className="profile-page reveal-up">
      {/* ── Hero / Avatar row ── */}
      <div className="profile-hero surface-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">{initials}</div>
          <span className={`profile-membership-badge ${membership.colorClass}`}>
            {membership.icon} {membership.label}
          </span>
        </div>

        <div className="profile-hero-info">
          <h1 className="profile-name">{user.name || "–"}</h1>
          <p className="profile-username muted">@{user.username ?? user.email}</p>

          <div className="profile-status-row">
            <span className={`profile-role-pill ${user.role === "ADMIN" ? "role-admin" : "role-customer"}`}>
              {user.role === "ADMIN" ? "Admin" : " Khách hàng"}
            </span>
            {user.isActive != null && (
              <span className={`profile-active-pill ${user.isActive ? "active-yes" : "active-no"}`}>
                {user.isActive ? "Đang hoạt động" : " Bị khóa"}
              </span>
            )}
          </div>
        </div>

        <button
          className="btn btn-outline profile-refresh-btn"
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? "⏳ Đang tải..." : "🔄 Làm mới"}
        </button>
      </div>

      {notice && <p className="alert success">{notice}</p>}
      {error && <p className="alert error">{error}</p>}

      {/* ── Stats cards (bỏ Số dư ví) ── */}
      <div className="profile-stats-row profile-stats-row--2col">
        <div className="profile-stat-card">
          <div>
            <p className="profile-stat-value">{formatCurrency(user.totalSpent)}</p>
            <small>Tổng chi tiêu</small>
          </div>
        </div>
        <div className="profile-stat-card">
          <div>
            <p className="profile-stat-value">{user.point?.toLocaleString("vi-VN") ?? "–"}</p>
            <small>Điểm tích lũy</small>
          </div>
        </div>
      </div>

      {/* ── Info sections ── */}
      {isEditing ? (
        /* ── Edit Form ── */
        <div className="surface-card profile-edit-section">
          <h3 className="profile-section-title">Chỉnh sửa thông tin</h3>
          <form className="profile-edit-form" onSubmit={handleSave}>
            <div className="profile-edit-grid">
              <div className="profile-edit-field">
                <label htmlFor="pe-name">Họ và tên</label>
                <input
                  id="pe-name"
                  type="text"
                  maxLength={255}
                  placeholder="Nguyễn Văn A"
                  value={editForm.fullName ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                />
              </div>

              <div className="profile-edit-field">
                <label htmlFor="pe-phone">Số điện thoại</label>
                <input
                  id="pe-phone"
                  type="tel"
                  maxLength={20}
                  placeholder="0901 234 567"
                  value={editForm.phoneNumber ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                />
              </div>

              <div className="profile-edit-field">
                <label htmlFor="pe-gender">Giới tính</label>
                <select
                  id="pe-gender"
                  value={editForm.gender ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                >
                  <option value="">-- Chọn giới tính --</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div className="profile-edit-field">
                <label htmlFor="pe-birth">Năm sinh</label>
                <input
                  id="pe-birth"
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  placeholder="1998"
                  value={editForm.birthYear ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      birthYear: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>

              <div className="profile-edit-field profile-edit-field--full">
                <label htmlFor="pe-address">Địa chỉ</label>
                <textarea
                  id="pe-address"
                  rows={2}
                  placeholder="123 Đường ABC, TP.HCM"
                  value={editForm.address ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
            </div>

            <div className="profile-edit-actions">
              <button className="btn btn-primary" type="submit" disabled={isSaving}>
                {isSaving ? "⏳ Đang lưu..." : "💾 Lưu thay đổi"}
              </button>
              <button className="btn btn-outline" type="button" onClick={cancelEdit} disabled={isSaving}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ── View Mode ── */
        <div className="profile-sections-grid">

          {/* Thông tin cơ bản */}
          <div className="surface-card profile-info-section">
            <h3 className="profile-section-title">Thông tin cơ bản</h3>
            <dl className="profile-dl">
              <div className="profile-dl-row">
                <dt>Họ và tên</dt>
                <dd>{user.name || "–"}</dd>
              </div>
              <div className="profile-dl-row">
                <dt>Tên đăng nhập</dt>
                <dd>{user.username || "–"}</dd>
              </div>
              <div className="profile-dl-row">
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="profile-dl-row">
                <dt>Giới tính</dt>
                <dd>{genderLabel(user.gender)}</dd>
              </div>
              <div className="profile-dl-row">
                <dt>Năm sinh</dt>
                <dd>{user.birthYear ?? "–"}</dd>
              </div>
            </dl>
          </div>

          {/* Liên hệ */}
          <div className="surface-card profile-info-section">
            <h3 className="profile-section-title">Liên hệ &amp; Địa chỉ</h3>
            <dl className="profile-dl">
              <div className="profile-dl-row">
                <dt>Số điện thoại</dt>
                <dd>{user.phone || "Chưa cập nhật"}</dd>
              </div>
              <div className="profile-dl-row">
                <dt>Địa chỉ</dt>
                <dd>{user.address || "Chưa cập nhật"}</dd>
              </div>
            </dl>
          </div>

          {/* Tài khoản */}
          <div className="surface-card profile-info-section">
            <h3 className="profile-section-title"> Tài khoản</h3>
            <dl className="profile-dl">
              <div className="profile-dl-row">
                <dt>Vai trò</dt>
                <dd>{user.role || "–"}</dd>
              </div>
              <div className="profile-dl-row">
                <dt>Hạng thành viên</dt>
                <dd>
                  <span className={`membership-inline ${membership.colorClass}`}>
                    {membership.icon} {membership.label}
                  </span>
                </dd>
              </div>
              <div className="profile-dl-row">
                <dt>Ngày tham gia</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
              <div className="profile-dl-row">
                <dt>ID tài khoản</dt>
                <dd className="profile-id-text">{user.id}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="profile-actions-row surface-card">
        {!isEditing && (
          <button className="btn btn-primary profile-action-btn" type="button" onClick={startEdit}>
          Sửa thông tin
          </button>
        )}
        <Link className="btn btn-outline profile-action-btn" to="/change-password">
         Đổi mật khẩu
        </Link>
        <Link className="btn btn-outline profile-action-btn" to="/orders">
          Đơn hàng của tôi
        </Link>
        <Link className="btn btn-outline profile-action-btn" to="/wishlist">
          Sản phẩm yêu thích
        </Link>
      </div>
    </section>
  );
}
