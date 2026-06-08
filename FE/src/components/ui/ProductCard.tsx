import { Link } from "react-router-dom";
import type { Product } from "../../types/api";
import { formatCurrency } from "../../utils/format";

interface ProductCardProps {
  product: Product;
  /** Class CSS bổ sung cho article wrapper (VD: "today-browsed-card") */
  className?: string;
  /** Animation delay (ms) – dùng cho stagger effect trong grid */
  animationDelay?: number;
  /** Nội dung render thêm phía dưới giá (badge, extra action, v.v.) */
  children?: React.ReactNode;
  /** Callback khi nhấn nút "Thêm vào giỏ". Nếu không truyền thì nút bị ẩn */
  onAddToCart?: (product: Product) => void;
  /** Nếu true thì hiển thị cả tổng tồn kho */
  showStock?: boolean;
  /** Label nút xem chi tiết. Mặc định: "Xem chi tiết" */
  detailLabel?: string;
}

/**
 * Card sản phẩm dùng chung – hiển thị ảnh, tên, brand, giá và action.
 * Dùng trong HomePage, ProductsPage (thay thế home-product-card / product-card).
 *
 * @example
 * <ProductCard product={product} animationDelay={index * 45} />
 * <ProductCard product={product} onAddToCart={openCartModal} showStock />
 */
export function ProductCard({
  product,
  className = "",
  animationDelay,
  children,
  onAddToCart,
  showStock = false,
  detailLabel = "Xem chi tiết",
}: ProductCardProps) {
  const wrapperStyle = animationDelay !== undefined
    ? { animationDelay: `${animationDelay}ms` }
    : undefined;

  return (
    <article
      className={`product-card ${className}`.trim()}
      style={wrapperStyle}
    >
      {/* Thumbnail */}
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

      {/* Info */}
      <div className="product-card-header">
        <h3>{product.name}</h3>
        {product.targetGender && (
          <span className="tag">{product.targetGender}</span>
        )}
      </div>

      <p className="muted">
        {product.brand}
        {product.category?.articleType ? ` - ${product.category.articleType}` : ""}
      </p>

      <p className="price">{formatCurrency(product.salePrice)}</p>

      {/* Rating row */}
      {(() => {
        const avg = product.averageRating ?? product.ratingAverage ?? null;
        const count = product.totalReviews ?? product.ratingCount ?? 0;
        const hasRating = avg != null && avg > 0;
        return (
          <div className="product-card-rating">
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                style={{
                  color: hasRating && s <= Math.round(avg!) ? "#f5a623" : "#ccc",
                  fontSize: "0.85rem",
                }}
              >
                ★
              </span>
            ))}
            {hasRating ? (
              <span className="product-card-rating-text">
                {avg!.toFixed(1)} ({count})
              </span>
            ) : (
              <span className="product-card-rating-text" style={{ color: "#aaa" }}>
                Chưa có đánh giá
              </span>
            )}
          </div>
        );
      })()}

      {showStock && (
        <p className="muted">Tồn kho: {product.totalStock}</p>
      )}

      {/* Slot cho nội dung tuỳ chỉnh (badge, v.v.) */}
      {children}

      {/* Actions */}
      <div className="card-actions" style={{ display: "flex", flexDirection: "row", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link className="btn btn-outline" to={`/products/${product.id}`} style={{ flex: 1, fontSize: "0.78rem", padding: "0.45rem 0.6rem" }}>
          {detailLabel}
        </Link>

        {onAddToCart && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => onAddToCart(product)}
            style={{ flex: 1, fontSize: "0.78rem", padding: "0.45rem 0.6rem" }}
          >
            Thêm vào giỏ
          </button>
        )}
      </div>
    </article>
  );
}
