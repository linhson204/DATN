import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cartApi, productsApi, recommendationApi, wishlistApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import { useAuth } from "../context/AuthContext";
import type {
  Product,
  ProductVariant,
  RecommendationCandidate,
} from "../types/api";
import { formatCurrency } from "../utils/format";

type SizeOption = {
  size: string;
  stockQuantity: number;
  hasStock: boolean;
  selectableVariant: ProductVariant | null;
};

type ColorOption = {
  color: string;
  hasStock: boolean;
};

const sizeOrder = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
];

function normalizeLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function compareSize(a: string, b: string): number {
  const aUpper = a.toUpperCase();
  const bUpper = b.toUpperCase();
  const indexA = sizeOrder.indexOf(aUpper);
  const indexB = sizeOrder.indexOf(bUpper);

  if (indexA >= 0 && indexB >= 0) {
    return indexA - indexB;
  }

  if (indexA >= 0) {
    return -1;
  }

  if (indexB >= 0) {
    return 1;
  }

  return aUpper.localeCompare(bUpper);
}

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [candidates, setCandidates] = useState<RecommendationCandidate[]>([]);
  const [recommendedProductsById, setRecommendedProductsById] = useState<
    Record<string, Product>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (id) {
      window.localStorage.setItem("lastViewedProductId", id);
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setActionError(null);
      setCandidates([]);
      setRecommendedProductsById({});

      try {
        const [productResponse, recommendationResponse] = await Promise.all([
          productsApi.byId(id),
          recommendationApi.candidates(id).catch(() => ({
            seedProductId: id,
            totalCandidates: 0,
            candidates: [],
          })),
        ]);

        setProduct(productResponse);
        const candidateList = (recommendationResponse.candidates || []).filter(
          (candidate) => candidate.productId !== id,
        );

        setCandidates(candidateList);

        if (candidateList.length > 0) {
          const candidateIds = Array.from(
            new Set(
              candidateList.slice(0, 8).map((candidate) => candidate.productId),
            ),
          );

          const detailResults = await Promise.allSettled(
            candidateIds.map((candidateId) => productsApi.byId(candidateId)),
          );

          const normalizedById = detailResults
            .filter(
              (result): result is PromiseFulfilledResult<Product> =>
                result.status === "fulfilled",
            )
            .reduce<Record<string, Product>>((acc, result) => {
              acc[result.value.id] = result.value;
              return acc;
            }, {});

          setRecommendedProductsById(normalizedById);
        }

        setSelectedColor(null);
        setSelectedSize(null);
        setQuantity(1);
        setActiveImageIndex(0);
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setLoadError(apiError.message);
      } finally {
        mountedAt.current = Date.now();
        setIsLoading(false);
      }
    };

    void load();
  }, [id]);

  // Kiểm tra sản phẩm có trong wishlist không
  useEffect(() => {
    if (!id || !isAuthenticated) {
      setIsInWishlist(false);
      return;
    }

    const checkWishlist = async () => {
      try {
        const wl = await wishlistApi.get();
        const found = wl.items.some((item) => item.productId === id);
        setIsInWishlist(found);
      } catch {
        // Không cần xử lý lỗi - mặc định không trong wishlist
      }
    };

    void checkWishlist();
  }, [id, isAuthenticated]);

  useEffect(() => {
    return () => {
      if (!id) {
        return;
      }

      const viewedSeconds = Math.floor((Date.now() - mountedAt.current) / 1000);
      if (viewedSeconds <= 6) {
        return;
      }

      void productsApi.logView(id, viewedSeconds).catch(() => {
        // View logging should never block navigation.
      });
    };
  }, [id]);

  const productImages = useMemo(() => {
    if (!product) {
      return [] as string[];
    }

    const source = [...(product.imageUrls || []), product.imageUrl].filter(
      (image): image is string => Boolean(image),
    );

    return Array.from(new Set(source));
  }, [product]);

  const colorOptions = useMemo(() => {
    const map = new Map<string, ColorOption>();

    (product?.variants || []).forEach((variant) => {
      const color = normalizeLabel(variant.color, "Mặc định");
      const hasStock = variant.status && variant.stockQuantity > 0;
      const existing = map.get(color);

      if (!existing) {
        map.set(color, {
          color,
          hasStock,
        });
        return;
      }

      existing.hasStock = existing.hasStock || hasStock;
    });

    return Array.from(map.values());
  }, [product]);

  const sizeOptions = useMemo(() => {
    const map = new Map<string, SizeOption>();
    const source = (product?.variants || []).filter((variant) => {
      if (!selectedColor) {
        return true;
      }

      return normalizeLabel(variant.color, "Mặc định") === selectedColor;
    });

    source.forEach((variant) => {
      const size = normalizeLabel(variant.size, "One Size");
      const stockQuantity = Math.max(variant.stockQuantity || 0, 0);
      const isSelectable = variant.status && stockQuantity > 0;
      const existing = map.get(size);

      if (!existing) {
        map.set(size, {
          size,
          stockQuantity: variant.status ? stockQuantity : 0,
          hasStock: isSelectable,
          selectableVariant: isSelectable ? variant : null,
        });
        return;
      }

      if (variant.status) {
        existing.stockQuantity += stockQuantity;
      }

      existing.hasStock = existing.hasStock || isSelectable;
      if (!existing.selectableVariant && isSelectable) {
        existing.selectableVariant = variant;
      }
    });

    return Array.from(map.values()).sort((a, b) => compareSize(a.size, b.size));
  }, [product, selectedColor]);

  const selectedSizeOption = useMemo(() => {
    if (!selectedSize) {
      return null;
    }

    return sizeOptions.find((option) => option.size === selectedSize) || null;
  }, [selectedSize, sizeOptions]);

  const selectedVariant = useMemo(() => {
    return selectedSizeOption?.selectableVariant || null;
  }, [selectedSizeOption]);

  const selectedStock = useMemo(() => {
    if (selectedSizeOption) {
      return selectedSizeOption.stockQuantity;
    }

    return 0;
  }, [selectedSizeOption]);

  const galleryImages = useMemo(() => {
    return productImages;
  }, [productImages]);

  const currentSalePrice =
    selectedVariant?.salePrice ?? product?.salePrice ?? 0;
  const currentOriginalPrice =
    selectedVariant?.originalPrice ?? product?.originalPrice ?? 0;

  useEffect(() => {
    if (!galleryImages.length) {
      setActiveImageIndex(0);
      return;
    }

    setActiveImageIndex((prev) => (prev >= galleryImages.length ? 0 : prev));
  }, [galleryImages]);

  useEffect(() => {
    if (!colorOptions.length) {
      setSelectedColor(null);
      return;
    }

    setSelectedColor((prev) => {
      if (prev && colorOptions.some((option) => option.color === prev)) {
        return prev;
      }

      const firstAvailable = colorOptions.find((option) => option.hasStock);
      return (firstAvailable || colorOptions[0]).color;
    });
  }, [colorOptions]);

  useEffect(() => {
    if (!sizeOptions.length) {
      setSelectedSize(null);
      return;
    }

    setSelectedSize((prev) => {
      const selected = prev
        ? sizeOptions.find((option) => option.size === prev)
        : null;

      if (selected && selected.hasStock) {
        return selected.size;
      }

      const firstAvailable = sizeOptions.find((option) => option.hasStock);
      return (firstAvailable || sizeOptions[0]).size;
    });
    setQuantity(1);
  }, [sizeOptions]);

  useEffect(() => {
    if (selectedStock <= 0) {
      setQuantity(1);
      return;
    }

    setQuantity((prev) => Math.min(Math.max(prev, 1), selectedStock));
  }, [selectedStock]);

  const addSelectedVariantToCart = async () => {
    setActionError(null);
    setNotice(null);

    if (!selectedVariant || !selectedVariant.status || selectedStock <= 0) {
      setActionError("Variant đã hết hàng, vui lòng chọn size khác.");
      return;
    }

    try {
      await cartApi.add({
        variantId: selectedVariant.id,
        quantity,
      });
      setNotice("Đã thêm sản phẩm vào giỏ hàng.");
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setActionError(apiError.message);
    }
  };

  if (isLoading) {
    return (
      <section className="surface-card">Đang tải chi tiết sản phẩm...</section>
    );
  }

  if (loadError) {
    return <section className="surface-card alert error">{loadError}</section>;
  }

  if (!product) {
    return <section className="surface-card">Không tìm thấy sản phẩm.</section>;
  }

  const activeImage = galleryImages[activeImageIndex] || null;
  const soldCount = product.soldCount ?? 0;
  const ratingCount = product.ratingCount ?? 0;
  const ratingAverage =
    typeof product.ratingAverage === "number" ? product.ratingAverage : 0;
  const hasAnyVariant = (product.variants || []).length > 0;
  const canAddToCart = Boolean(selectedVariant && selectedStock > 0);
  const hasStockStatus = selectedStock > 0;
  const similarCandidates = candidates
    .filter((candidate) => candidate.status)
    .slice(0, 8);

  return (
    <section className="product-detail-page reveal-up">
      <article className="surface-card product-detail-shell">
        <p className="product-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <Link to="/products">Sản phẩm</Link>
          <span>/</span>
          <span>{product.name}</span>
        </p>

        <div className="product-detail-main">
          <div className="product-gallery">
            <div className="product-main-image">
              {activeImage ? (
                <img src={activeImage} alt={product.name} loading="lazy" />
              ) : (
                <div className="product-image-placeholder">Không có ảnh</div>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="product-thumb-row">
                {galleryImages.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-${index}`}
                    type="button"
                    className={`product-thumb ${
                      index === activeImageIndex ? "active" : ""
                    }`}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <img src={imageUrl} alt={`${product.name} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-meta">
            <h1>{product.name}</h1>

            <div className="product-rating-row">
              <p className="product-rating">
                Đánh giá: {ratingAverage.toFixed(1)} / 5 ({ratingCount} đánh
                giá)
              </p>
              <p className="product-sold">Số lượng đã bán: {soldCount}</p>
            </div>

            <div className="product-price-row">
              <p className="detail-sale-price">
                {formatCurrency(currentSalePrice)}
              </p>
              {currentOriginalPrice > currentSalePrice && (
                <p className="detail-original-price">
                  {formatCurrency(currentOriginalPrice)}
                </p>
              )}
            </div>

            <p
              className={`product-stock-status ${
                hasStockStatus ? "in-stock" : "out-stock"
              }`}
            >
              {hasStockStatus
                ? `Còn hàng (Tồn kho: ${selectedStock})`
                : "Hết hàng"}
            </p>

            <p className="product-short-description">
              {product.description ||
                "Chưa có mô tả chi tiết cho sản phẩm này."}
            </p>

            <section className="option-section">
              <h3>Màu sắc</h3>
              {colorOptions.length === 0 ? (
                <p className="placeholder">Không có thông tin màu sắc.</p>
              ) : (
                <div className="option-grid color-grid">
                  {colorOptions.map((option) => (
                    <button
                      key={option.color}
                      type="button"
                      className={`variant-option color-option ${
                        selectedColor === option.color ? "active" : ""
                      } ${option.hasStock ? "" : "disabled"}`}
                      disabled={!option.hasStock}
                      onClick={() => {
                        setSelectedColor(option.color);
                        setQuantity(1);
                      }}
                    >
                      {option.color}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="option-section">
              <h3>Kích thước</h3>
              {!hasAnyVariant ? (
                <p className="placeholder">Sản phẩm chưa có variant.</p>
              ) : (
                <>
                  <div className="option-grid size-grid">
                    {sizeOptions.map((option) => (
                      <button
                        key={option.size}
                        type="button"
                        className={`variant-option size-option ${
                          selectedSize === option.size ? "active" : ""
                        } ${option.hasStock ? "" : "disabled"}`}
                        disabled={!option.hasStock}
                        onClick={() => {
                          setSelectedSize(option.size);
                          setQuantity(1);
                        }}
                      >
                        {option.size}
                      </button>
                    ))}
                  </div>
                  {selectedSize && (
                    <p className="size-stock-note">
                      Tồn kho size {selectedSize}: {selectedStock}
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="option-section">
              <h3>Số lượng</h3>
              <div className="quantity-box">
                <button
                  type="button"
                  className="quantity-btn"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                >
                  -
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  className="quantity-btn"
                  disabled={selectedStock <= 0 || quantity >= selectedStock}
                  onClick={() =>
                    setQuantity((prev) =>
                      selectedStock <= 0
                        ? prev
                        : Math.min(selectedStock, prev + 1),
                    )
                  }
                >
                  +
                </button>
              </div>
            </section>

            <div className="detail-action-row">
              {isAuthenticated ? (
                <button
                  type="button"
                  className="btn btn-primary detail-main-action"
                  onClick={addSelectedVariantToCart}
                  disabled={!canAddToCart}
                >
                  Thêm vào giỏ hàng
                </button>
              ) : (
                <Link className="btn btn-primary detail-main-action" to="/auth">
                  Đăng nhập để mua
                </Link>
              )}
              <button
                type="button"
                className={`btn detail-ghost-action ${isInWishlist ? "btn-wishlist-active" : "btn-outline"}`}
                onClick={async () => {
                  if (!isAuthenticated || wishlistLoading) return;
                  setWishlistLoading(true);
                  setActionError(null);
                  try {
                    if (isInWishlist) {
                      // Lấy wishlist rồi tìm item tương ứng để xóa
                      const wl = await wishlistApi.get();
                      const found = wl.items.find((i) => i.productId === product.id);
                      if (found) {
                        await wishlistApi.remove(found.wishlistItemId);
                      }
                      setIsInWishlist(false);
                      setNotice("Đã xóa khỏi yêu thích.");
                    } else {
                      await wishlistApi.add({ productId: product.id });
                      setIsInWishlist(true);
                      setNotice("Đã thêm vào yêu thích.");
                    }
                  } catch (rawErr) {
                    const apiErr = parseApiError(rawErr);
                    setActionError(apiErr.message);
                  } finally {
                    setWishlistLoading(false);
                  }
                }}
                disabled={!isAuthenticated || wishlistLoading}
              >
                {isInWishlist ? "♥ Đã yêu thích" : "♡ Yêu thích"}
              </button>
            </div>

            {notice && <p className="alert success">{notice}</p>}
            {actionError && <p className="alert error">{actionError}</p>}

            <section className="detail-description-panel">
              <h3>Mô tả sản phẩm</h3>
              <p>{product.description || "Chưa có mô tả."}</p>

              {(Boolean(product.material) || product.attributes.length > 0) && (
                <ul className="product-attribute-list">
                  {product.material && (
                    <li>
                      <strong>Chất liệu:</strong> {product.material.name}
                      {product.material.code
                        ? ` (${product.material.code})`
                        : ""}
                    </li>
                  )}

                  {product.attributes.map((attribute) => (
                    <li
                      key={`${attribute.attributeKey}-${attribute.attributeValue}`}
                    >
                      <strong>{attribute.attributeKey}:</strong>{" "}
                      {attribute.attributeValue}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <section className="detail-similar-panel">
          <div className="section-headline">
            <h3>Sản phẩm tương tự</h3>
            <p>Gợi ý từ endpoint /v1/recommendations/candidates/{id}</p>
          </div>

          {similarCandidates.length === 0 ? (
            <p className="placeholder">Chưa có sản phẩm tương tự.</p>
          ) : (
            <div className="similar-grid">
              {similarCandidates.map((candidate) => {
                const candidateImage =
                  recommendedProductsById[candidate.productId]?.imageUrl ||
                  null;

                return (
                  <article
                    key={candidate.productId}
                    className="list-item-card similar-product-card"
                  >
                    <div className="similar-product-image">
                      {candidateImage ? (
                        <img
                          src={candidateImage}
                          alt={candidate.productName}
                          loading="lazy"
                        />
                      ) : (
                        <span>{candidate.articleType || "Sản phẩm"}</span>
                      )}
                    </div>

                    <h4>{candidate.productName}</h4>
                    <p>
                      {candidate.brand} - {candidate.articleType}
                    </p>
                    <p className="price">
                      {formatCurrency(candidate.salePrice)}
                    </p>
                    <Link
                      to={`/products/${candidate.productId}`}
                      className="btn btn-outline"
                    >
                      Xem sản phẩm
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </article>
    </section>
  );
}
