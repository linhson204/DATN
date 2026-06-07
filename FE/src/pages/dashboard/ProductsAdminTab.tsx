import { useCallback, useEffect, useState } from "react";
import { productsApi } from "../../api/services";
import type { CreateProductPayload } from "../../api/services/productsApi";
import { parseApiError } from "../../api/helpers";
import type { PageResponse, Product, ProductCategory } from "../../types/api";
import { formatCurrency } from "../../utils/format";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  IconDelete,
  IconEdit,
  IconPlus,
  IconProduct,
} from "./DashboardIcons";

// ─────────────────────────────────────────────
// Product Form Modal
// ─────────────────────────────────────────────
function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: ProductCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState<CreateProductPayload>({
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    categoryId: product?.category?.id ?? "",
    targetGender: product?.targetGender ?? "unisex",
    description: product?.description ?? "",
    imageUrl: product?.imageUrl ?? "",
    status: product?.status ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked =
      type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : undefined;
    setForm((prev: CreateProductPayload) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEdit && product) {
        await productsApi.update(product.id, form);
      } else {
        await productsApi.create(form);
      }
      onSaved();
      onClose();
    } catch (raw) {
      setError(parseApiError(raw).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="db-modal-overlay" onClick={onClose}>
      <div
        className="db-modal db-modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="db-modal-header">
          <h3>{isEdit ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h3>
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
            <div className="db-form-grid">
              <div className="db-form-group">
                <label className="db-form-label" htmlFor="prod-name">
                  Tên sản phẩm *
                </label>
                <input
                  id="prod-name"
                  name="name"
                  className="db-form-input"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="VD: Áo thun basic"
                />
              </div>

              <div className="db-form-group">
                <label className="db-form-label" htmlFor="prod-brand">
                  Thương hiệu *
                </label>
                <input
                  id="prod-brand"
                  name="brand"
                  className="db-form-input"
                  value={form.brand}
                  onChange={handleChange}
                  required
                  placeholder="VD: Nike"
                />
              </div>

              <div className="db-form-group">
                <label className="db-form-label" htmlFor="prod-category">
                  Danh mục
                </label>
                <select
                  id="prod-category"
                  name="categoryId"
                  className="db-form-select"
                  value={form.categoryId}
                  onChange={handleChange}
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.masterCategory} › {c.subCategory} › {c.articleType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="db-form-group">
                <label className="db-form-label" htmlFor="prod-gender">
                  Giới tính
                </label>
                <select
                  id="prod-gender"
                  name="targetGender"
                  className="db-form-select"
                  value={form.targetGender}
                  onChange={handleChange}
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="unisex">Unisex</option>
                </select>
              </div>

              <div className="db-form-group full">
                <label className="db-form-label" htmlFor="prod-image">
                  URL ảnh
                </label>
                <input
                  id="prod-image"
                  name="imageUrl"
                  className="db-form-input"
                  value={form.imageUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                />
              </div>

              <div className="db-form-group full">
                <label className="db-form-label" htmlFor="prod-desc">
                  Mô tả
                </label>
                <textarea
                  id="prod-desc"
                  name="description"
                  className="db-form-textarea"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Mô tả chi tiết sản phẩm..."
                />
              </div>

              <div className="db-form-group">
                <label
                  className="db-form-label"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="status"
                    checked={form.status}
                    onChange={handleChange}
                    style={{ width: "16px", height: "16px", cursor: "pointer", margin: 0 }}
                  />
                  Kích hoạt sản phẩm
                </label>
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
              {loading
                ? "Đang lưu..."
                : isEdit
                  ? "Cập nhật"
                  : "Thêm sản phẩm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Products (Quản lý sản phẩm)
// ─────────────────────────────────────────────
export function ProductsAdminTab({
  categories,
}: {
  categories: ProductCategory[];
}) {
  const [pageData, setPageData] = useState<PageResponse<Product>>({
    items: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [modalProduct, setModalProduct] = useState<Product | null | "new">(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (page = 0) => {
      setLoading(true);
      setError(null);
      try {
        const res = await productsApi.list({
          page,
          size: 10,
          name: search || undefined,
          sortBy: "createdAt",
          sortDir: "desc",
        });
        setPageData(res);
      } catch (raw) {
        setError(parseApiError(raw).message);
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await productsApi.remove(deleteTarget.id);
      setNotice(`Đã xóa sản phẩm "${deleteTarget.name}".`);
      setDeleteTarget(null);
      void load(pageData.page);
    } catch (raw) {
      setError(parseApiError(raw).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Xóa sản phẩm?"
          message={`Bạn có chắc muốn xóa "${deleteTarget.name}"? Hành động này không thể hoàn tác.`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {modalProduct !== null && (
        <ProductModal
          product={modalProduct === "new" ? null : modalProduct}
          categories={categories}
          onClose={() => setModalProduct(null)}
          onSaved={() => void load(pageData.page)}
        />
      )}

      <div className="dashboard-panel">
        <div className="panel-header">
          <h3>📦 Danh sách sản phẩm</h3>
          <div className="panel-header-actions">
            <form
              onSubmit={handleSearch}
              style={{ display: "flex", gap: "0.4rem" }}
            >
              <input
                className="db-search"
                placeholder="Tìm tên sản phẩm..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                type="submit"
                className="db-btn db-btn-outline db-btn-sm"
              >
                Tìm
              </button>
            </form>
            <button
              type="button"
              className="db-btn db-btn-primary"
              onClick={() => setModalProduct("new")}
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
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giới tính</th>
                <th>Giá bán</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="db-loading">Đang tải...</div>
                  </td>
                </tr>
              ) : pageData.items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="db-empty">
                      <IconProduct />
                      Không có sản phẩm nào.
                    </div>
                  </td>
                </tr>
              ) : (
                pageData.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="db-product-info">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="db-product-thumb"
                          />
                        ) : (
                          <div className="db-product-thumb-placeholder">
                            No img
                          </div>
                        )}
                        <div className="db-product-info-text">
                          <div className="db-product-name">{product.name}</div>
                          <div className="db-product-brand">
                            {product.brand}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "#475569" }}>
                      {product.category?.articleType || "—"}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {product.targetGender === "male"
                        ? "Nam"
                        : product.targetGender === "female"
                          ? "Nữ"
                          : "Unisex"}
                    </td>
                    <td>
                      <strong>{formatCurrency(product.salePrice)}</strong>
                    </td>
                    <td
                      style={{
                        color:
                          product.totalStock === 0 ? "#ef4444" : "#1e293b",
                      }}
                    >
                      {product.totalStock}
                    </td>
                    <td>
                      <span
                        className={
                          product.status
                            ? "db-badge db-badge-active"
                            : "db-badge db-badge-inactive"
                        }
                      >
                        {product.status ? "Đang bán" : "Ẩn"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          className="db-btn db-btn-icon"
                          title="Chỉnh sửa"
                          onClick={() => setModalProduct(product)}
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
                          onClick={() => setDeleteTarget(product)}
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

        <div className="db-pagination">
          <div className="db-pagination-info">
            Hiển thị{" "}
            {pageData.items.length > 0
              ? `${pageData.page * pageData.size + 1}–${pageData.page * pageData.size + pageData.items.length}`
              : "0"}{" "}
            / {pageData.totalElements} sản phẩm
          </div>
          <div className="db-pagination-btns">
            <button
              className="db-page-btn"
              disabled={!pageData.hasPrevious || loading}
              onClick={() => void load(pageData.page - 1)}
              type="button"
            >
              ‹
            </button>
            <span className="db-page-btn active" style={{ cursor: "default" }}>
              {pageData.page + 1}
            </span>
            <button
              className="db-page-btn"
              disabled={!pageData.hasNext || loading}
              onClick={() => void load(pageData.page + 1)}
              type="button"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
