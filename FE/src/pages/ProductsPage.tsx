import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { cartApi, productCategoriesApi, productsApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import { useAuth } from "../context/AuthContext";
import type { PageResponse, Product, ProductListQuery } from "../types/api";
import { formatCurrency } from "../utils/format";
import { recordProductInteraction } from "../utils/productInteractions";

const defaultQuery: ProductListQuery = {
  page: 0,
  size: 20,
  sortBy: "createdAt",
  sortDir: "desc",
};

export function ProductsPage() {
  const { user, isAuthenticated } = useAuth();

  const [query, setQuery] = useState<ProductListQuery>(defaultQuery);
  const [draftName, setDraftName] = useState("");
  const [draftMinPrice, setDraftMinPrice] = useState("");
  const [draftMaxPrice, setDraftMaxPrice] = useState("");
  const [masterCategories, setMasterCategories] = useState<string[]>([]);
  const [subCategoriesByMaster, setSubCategoriesByMaster] = useState<
    Record<string, string[]>
  >({});
  const [expandedMasterCategory, setExpandedMasterCategory] = useState<
    string | null
  >(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [loadingSubCategoryOf, setLoadingSubCategoryOf] = useState<
    string | null
  >(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const loadedSubCategoriesRef = useRef<Set<string>>(new Set());

  const [pageData, setPageData] = useState<PageResponse<Product>>({
    items: [],
    page: 0,
    size: Number(defaultQuery.size),
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await productsApi.list(query);
        setPageData(response);
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [query]);

  const loadSubCategories = useCallback(async (masterCategory: string) => {
    const normalizedMasterCategory = masterCategory.trim();
    if (!normalizedMasterCategory) {
      return;
    }

    if (loadedSubCategoriesRef.current.has(normalizedMasterCategory)) {
      return;
    }

    loadedSubCategoriesRef.current.add(normalizedMasterCategory);
    setLoadingSubCategoryOf(normalizedMasterCategory);

    try {
      const subCategories = await productCategoriesApi.listSubCategories(
        normalizedMasterCategory,
      );

      setSubCategoriesByMaster((prev) => ({
        ...prev,
        [normalizedMasterCategory]: subCategories,
      }));
    } catch (rawError) {
      loadedSubCategoriesRef.current.delete(normalizedMasterCategory);
      const apiError = parseApiError(rawError);
      setCategoryError(apiError.message);
      setSubCategoriesByMaster((prev) => ({
        ...prev,
        [normalizedMasterCategory]: [],
      }));
    } finally {
      setLoadingSubCategoryOf((prev) =>
        prev === normalizedMasterCategory ? null : prev,
      );
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMasterCategories = async () => {
      setIsLoadingCategories(true);
      setCategoryError(null);

      try {
        const categories = await productCategoriesApi.listMasterCategories();
        if (!isMounted) {
          return;
        }

        setMasterCategories(categories);

        if (categories.length > 0) {
          setExpandedMasterCategory(categories[0]);
          void loadSubCategories(categories[0]);
        }
      } catch (rawError) {
        if (!isMounted) {
          return;
        }

        const apiError = parseApiError(rawError);
        setCategoryError(apiError.message);
        setMasterCategories([]);
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    };

    void loadMasterCategories();

    return () => {
      isMounted = false;
    };
  }, [loadSubCategories]);

  const activeFilterCount = useMemo(() => {
    return [
      query.name,
      query.minPrice,
      query.maxPrice,
      query.subCategory,
    ].filter(Boolean).length;
  }, [query.maxPrice, query.minPrice, query.name, query.subCategory]);

  const applyFilters = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const normalizedName = draftName.trim();
    const minPriceValue = draftMinPrice.trim();
    const maxPriceValue = draftMaxPrice.trim();
    const parsedMinPrice = minPriceValue ? Number(minPriceValue) : undefined;
    const parsedMaxPrice = maxPriceValue ? Number(maxPriceValue) : undefined;

    const hasInvalidMinPrice =
      minPriceValue.length > 0 &&
      (!Number.isFinite(parsedMinPrice) || (parsedMinPrice ?? 0) < 0);

    const hasInvalidMaxPrice =
      maxPriceValue.length > 0 &&
      (!Number.isFinite(parsedMaxPrice) || (parsedMaxPrice ?? 0) < 0);

    if (hasInvalidMinPrice || hasInvalidMaxPrice) {
      setError("Khoảng giá không hợp lệ, vui lòng nhập lại.");
      return;
    }

    if (
      parsedMinPrice !== undefined &&
      parsedMaxPrice !== undefined &&
      parsedMinPrice > parsedMaxPrice
    ) {
      setError("Giá tối thiểu không được lớn hơn giá tối đa.");
      return;
    }

    setError(null);

    setQuery((prev) => ({
      ...prev,
      page: 0,
      name: normalizedName || undefined,
      minPrice: parsedMinPrice,
      maxPrice: parsedMaxPrice,
    }));
  };

  const clearFilters = () => {
    setDraftName("");
    setDraftMinPrice("");
    setDraftMaxPrice("");
    setError(null);

    setQuery((prev) => ({
      ...prev,
      page: 0,
      name: undefined,
      masterCategory: undefined,
      subCategory: undefined,
      minPrice: undefined,
      maxPrice: undefined,
    }));
  };

  const toggleMasterCategory = (masterCategory: string) => {
    setExpandedMasterCategory((prev) =>
      prev === masterCategory ? null : masterCategory,
    );
    void loadSubCategories(masterCategory);
  };

  const selectMasterCategory = (masterCategory: string) => {
    setExpandedMasterCategory(masterCategory);
    void loadSubCategories(masterCategory);
  };

  const selectSubCategory = (masterCategory: string, subCategory: string) => {
    setQuery((prev) => ({
      ...prev,
      page: 0,
      masterCategory,
      subCategory,
    }));
  };

  const selectedCategoryLabel =
    query.subCategory || query.masterCategory || "Tất cả sản phẩm";

  const addFirstVariantToCart = async (product: Product) => {
    setNotice(null);
    setError(null);

    const availableVariant = product.variants.find(
      (variant) => variant.status && variant.stockQuantity > 0,
    );

    if (!availableVariant) {
      setNotice("Sản phẩm này đang hết variant khả dụng.");
      return;
    }

    try {
      await cartApi.add({
        variantId: availableVariant.id,
        quantity: 1,
      });
      recordProductInteraction({
        userId: user?.id,
        productId: product.id,
        eventType: "CART",
      });
      setNotice(`Đã thêm ${product.name} vào giỏ hàng.`);
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    }
  };

  return (
    <section className="products-page reveal-up">
      <aside className="surface-card products-filter-panel">
        <div className="products-filter-head">
          <h2>Bộ lọc sản phẩm</h2>
          <button
            className="btn btn-muted"
            type="button"
            onClick={clearFilters}
          >
            Xóa lọc
          </button>
        </div>

        <section className="products-filter-section">
          <div className="products-filter-title-row">
            <h3>Danh mục sản phẩm</h3>
          </div>

          <button
            type="button"
            className={`category-root-button ${
              !query.masterCategory ? "active" : ""
            }`}
            onClick={() =>
              setQuery((prev) => ({
                ...prev,
                page: 0,
                masterCategory: undefined,
                subCategory: undefined,
              }))
            }
          >
            Tất cả danh mục
          </button>

          {isLoadingCategories ? (
            <p className="placeholder">Đang tải danh mục...</p>
          ) : masterCategories.length === 0 ? (
            <p className="placeholder">Không có dữ liệu danh mục.</p>
          ) : (
            <ul className="master-category-list">
              {masterCategories.map((masterCategory) => {
                const isExpanded = expandedMasterCategory === masterCategory;
                const isSelectedMaster =
                  query.masterCategory === masterCategory;
                const subCategories =
                  subCategoriesByMaster[masterCategory] ?? [];

                return (
                  <li key={masterCategory} className="master-category-item">
                    <div className="master-category-row">
                      <button
                        type="button"
                        className={`master-category-button ${
                          isSelectedMaster ? "active" : ""
                        }`}
                        onClick={() => selectMasterCategory(masterCategory)}
                      >
                        {masterCategory}
                      </button>

                      <button
                        type="button"
                        className={`master-category-expand ${
                          isExpanded ? "open" : ""
                        }`}
                        onClick={() => toggleMasterCategory(masterCategory)}
                        aria-label={`Mở danh mục con của ${masterCategory}`}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    </div>

                    {isExpanded && (
                      <ul className="sub-category-list">
                        {loadingSubCategoryOf === masterCategory &&
                        subCategories.length === 0 ? (
                          <li className="placeholder">
                            Đang tải danh mục con...
                          </li>
                        ) : subCategories.length === 0 ? (
                          <li className="placeholder">
                            Không có danh mục con.
                          </li>
                        ) : (
                          subCategories.map((subCategory) => (
                            <li key={`${masterCategory}-${subCategory}`}>
                              <button
                                type="button"
                                className={`sub-category-button ${
                                  query.subCategory === subCategory &&
                                  isSelectedMaster
                                    ? "active"
                                    : ""
                                }`}
                                onClick={() =>
                                  selectSubCategory(masterCategory, subCategory)
                                }
                              >
                                {subCategory}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {categoryError && <p className="alert error">{categoryError}</p>}
        </section>

        <form className="products-filter-section" onSubmit={applyFilters}>
          <h3>Khoảng giá</h3>

          <div className="price-range-grid">
            <label>
              Từ
              <input
                type="number"
                min={0}
                placeholder="0"
                value={draftMinPrice}
                onChange={(event) => setDraftMinPrice(event.target.value)}
              />
            </label>

            <label>
              Đến
              <input
                type="number"
                min={0}
                placeholder="5000000"
                value={draftMaxPrice}
                onChange={(event) => setDraftMaxPrice(event.target.value)}
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            Áp dụng khoảng giá
          </button>
        </form>
      </aside>

      <article className="surface-card products-main-panel">
        <div className="section-headline">
          <h2>{selectedCategoryLabel}</h2>
          <p>
            Khám phá bộ sưu tập sản phẩm mới nhất với chất lượng và giá cả hợp
            lý.
          </p>
        </div>

        <form className="products-main-toolbar" onSubmit={applyFilters}>
          <div className="product-search-box">
            <input
              placeholder="Tìm kiếm sản phẩm..."
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />

            <button type="submit" className="product-search-button">
              🔍
            </button>
          </div>

          <label className="compact-field">
            <span>Sắp xếp theo</span>
            <select
              value={query.sortBy ?? "createdAt"}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  page: 0,
                  sortBy: event.target.value as ProductListQuery["sortBy"],
                }))
              }
            >
              <option value="updatedAt">updatedAt</option>
              <option value="createdAt">createdAt</option>
              <option value="name">name</option>
              <option value="salePrice">salePrice</option>
              <option value="originalPrice">originalPrice</option>
              <option value="totalStock">totalStock</option>
            </select>
          </label>

          <label className="compact-field">
            <span>Thứ tự</span>
            <select
              value={query.sortDir ?? "desc"}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  page: 0,
                  sortDir: event.target.value as "asc" | "desc",
                }))
              }
            >
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </label>

          <button type="submit" className="btn btn-muted">
            Lọc ({activeFilterCount})
          </button>
        </form>

        {notice && <p className="alert success">{notice}</p>}
        {error && <p className="alert error">{error}</p>}

        {isLoading ? (
          <p className="placeholder">Đang tải danh sách sản phẩm...</p>
        ) : pageData.items.length === 0 ? (
          <p className="placeholder">Không có sản phẩm nào khớp điều kiện.</p>
        ) : (
          <div className="product-grid">
            {pageData.items.map((product, index) => (
              <article
                className="product-card"
                key={product.id}
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="product-card-image">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <span>{product.category?.articleType || "Sản phẩm"}</span>
                  )}
                </div>

                <div className="product-card-header">
                  <h3>{product.name}</h3>
                  <span className="tag">{product.targetGender}</span>
                </div>

                <p className="muted">
                  {product.brand} - {product.category?.articleType || "N/A"}
                </p>
                <p className="price">{formatCurrency(product.salePrice)}</p>
                <p className="muted">Tồn kho: {product.totalStock}</p>

                <div className="card-actions">
                  <Link
                    className="btn btn-outline"
                    to={`/products/${product.id}`}
                  >
                    Chi tiết
                  </Link>

                  {isAuthenticated && (
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => addFirstVariantToCart(product)}
                    >
                      Thêm vào giỏ
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="pagination-row">
          <button
            className="btn btn-muted"
            disabled={!pageData.hasPrevious}
            onClick={() =>
              setQuery((prev) => ({
                ...prev,
                page: Math.max(0, (prev.page ?? 0) - 1),
              }))
            }
            type="button"
          >
            Trang trước
          </button>

          <p>
            Trang {pageData.page + 1} / {Math.max(pageData.totalPages, 1)} -
            Tổng {pageData.totalElements} sản phẩm
          </p>

          <button
            className="btn btn-muted"
            disabled={!pageData.hasNext}
            onClick={() =>
              setQuery((prev) => ({ ...prev, page: (prev.page ?? 0) + 1 }))
            }
            type="button"
          >
            Trang sau
          </button>
        </footer>
      </article>
    </section>
  );
}
