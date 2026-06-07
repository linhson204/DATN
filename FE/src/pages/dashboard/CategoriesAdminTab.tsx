import { useMemo, useState } from "react";
import type { ProductCategory } from "../../types/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconCategory, IconDelete, IconEdit, IconPlus } from "./DashboardIcons";

// ─────────────────────────────────────────────
// Category Form Modal
// ─────────────────────────────────────────────
function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: ProductCategory | null;
  onClose: () => void;
  onSaved: (cat: ProductCategory) => void;
}) {
  const isEdit = Boolean(category);
  const [form, setForm] = useState({
    masterCategory: category?.masterCategory ?? "",
    subCategory: category?.subCategory ?? "",
    articleType: category?.articleType ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url =
        isEdit && category
          ? `/v1/product-categories/${category.id}`
          : "/v1/product-categories";
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        throw new Error("Lỗi khi lưu danh mục, vui lòng thử lại.");
      }
      const saved = (await response.json()) as ProductCategory;
      onSaved(saved);
      onClose();
    } catch (raw) {
      setError(raw instanceof Error ? raw.message : "Lỗi không xác định.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="db-modal-overlay" onClick={onClose}>
      <div className="db-modal" onClick={(e) => e.stopPropagation()}>
        <div className="db-modal-header">
          <h3>{isEdit ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}</h3>
          <button
            type="button"
            className="db-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="db-modal-body">
            {error && <div className="db-alert db-alert-error">{error}</div>}
            <div
              className="db-form-grid"
              style={{ gridTemplateColumns: "1fr" }}
            >
              <div className="db-form-group">
                <label className="db-form-label" htmlFor="cat-master">
                  Master Category *
                </label>
                <input
                  id="cat-master"
                  name="masterCategory"
                  className="db-form-input"
                  value={form.masterCategory}
                  onChange={handleChange}
                  required
                  placeholder="VD: Apparel"
                />
              </div>
              <div className="db-form-group">
                <label className="db-form-label" htmlFor="cat-sub">
                  Sub Category *
                </label>
                <input
                  id="cat-sub"
                  name="subCategory"
                  className="db-form-input"
                  value={form.subCategory}
                  onChange={handleChange}
                  required
                  placeholder="VD: Topwear"
                />
              </div>
              <div className="db-form-group">
                <label className="db-form-label" htmlFor="cat-article">
                  Article Type *
                </label>
                <input
                  id="cat-article"
                  name="articleType"
                  className="db-form-input"
                  value={form.articleType}
                  onChange={handleChange}
                  required
                  placeholder="VD: Shirts"
                />
              </div>
            </div>
          </div>
          <div className="db-modal-footer">
            <button
              type="button"
              className="db-btn db-btn-outline"
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="db-btn db-btn-primary"
              disabled={loading}
            >
              {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm danh mục"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Categories (Quản lý danh mục)
// ─────────────────────────────────────────────
export function CategoriesAdminTab({
  categories,
  onCategoriesChange,
}: {
  categories: ProductCategory[];
  onCategoriesChange: (cats: ProductCategory[]) => void;
}) {
  const [modalCat, setModalCat] = useState<ProductCategory | null | "new">(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<ProductCategory | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      search
        ? categories.filter(
            (c) =>
              c.masterCategory
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              c.subCategory.toLowerCase().includes(search.toLowerCase()) ||
              c.articleType.toLowerCase().includes(search.toLowerCase()),
          )
        : categories,
    [categories, search],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/v1/product-categories/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Lỗi khi xóa danh mục.");
      setNotice(`Đã xóa danh mục "${deleteTarget.articleType}".`);
      onCategoriesChange(
        categories.filter((c) => c.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (raw) {
      setError(raw instanceof Error ? raw.message : "Lỗi không xác định.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = (saved: ProductCategory) => {
    const exists = categories.find((c) => c.id === saved.id);
    if (exists) {
      onCategoriesChange(
        categories.map((c) => (c.id === saved.id ? saved : c)),
      );
    } else {
      onCategoriesChange([saved, ...categories]);
    }
    setNotice("Đã lưu danh mục thành công.");
  };

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Xóa danh mục?"
          message={`Bạn có chắc muốn xóa danh mục "${deleteTarget.articleType}"?`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {modalCat !== null && (
        <CategoryModal
          category={modalCat === "new" ? null : modalCat}
          onClose={() => setModalCat(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="dashboard-panel">
        <div className="panel-header">
          <h3>🗂 Danh mục sản phẩm</h3>
          <div className="panel-header-actions">
            <input
              className="db-search"
              placeholder="Tìm danh mục..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="db-btn db-btn-primary"
              onClick={() => setModalCat("new")}
            >
              <IconPlus />
              Thêm mới
            </button>
          </div>
        </div>

        {notice && (
          <div
            className="db-alert db-alert-success"
            style={{ margin: "1rem 1.5rem 0" }}
          >
            {notice}
          </div>
        )}
        {error && (
          <div
            className="db-alert db-alert-error"
            style={{ margin: "1rem 1.5rem 0" }}
          >
            {error}
          </div>
        )}

        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Master Category</th>
                <th>Sub Category</th>
                <th>Article Type</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="db-empty">
                      <IconCategory />
                      Không có danh mục nào.
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((cat, idx) => (
                  <tr key={cat.id}>
                    <td style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
                      {idx + 1}
                    </td>
                    <td>
                      <span
                        className="db-badge"
                        style={{
                          background: "#eff6ff",
                          color: "#1e40af",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        {cat.masterCategory}
                      </span>
                    </td>
                    <td style={{ color: "#475569" }}>{cat.subCategory}</td>
                    <td>
                      <strong>{cat.articleType}</strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          className="db-btn db-btn-icon"
                          title="Chỉnh sửa"
                          onClick={() => setModalCat(cat)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="db-btn db-btn-icon"
                          title="Xóa"
                          style={{
                            color: "#ef4444",
                            borderColor: "#fecaca",
                          }}
                          onClick={() => setDeleteTarget(cat)}
                        >
                          <IconDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="db-pagination" style={{ justifyContent: "flex-end" }}>
          <div className="db-pagination-info">
            {filtered.length} / {categories.length} danh mục
          </div>
        </div>
      </div>
    </>
  );
}
