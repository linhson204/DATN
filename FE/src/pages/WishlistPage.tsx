import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { wishlistApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { WishlistItem } from "../types/api";
import { formatCurrency } from "../utils/format";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} tháng trước`;
}

export function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadWishlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const wishlist = await wishlistApi.get();
      setItems(wishlist.items || []);
      setTotalItems(wishlist.totalItems ?? wishlist.items?.length ?? 0);
    } catch (rawError) {
      toast.error(parseApiError(rawError).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  const removeItem = async (item: WishlistItem) => {
    setRemovingId(item.wishlistItemId);
    try {
      await wishlistApi.remove(item.wishlistItemId);
      setItems((prev) => prev.filter((i) => i.wishlistItemId !== item.wishlistItemId));
      setTotalItems((prev) => Math.max(0, prev - 1));
      toast.success(`Đã xóa "${item.productName}" khỏi danh sách yêu thích.`);
    } catch (rawError) {
      toast.error(parseApiError(rawError).message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="wishlist-page reveal-up">
      <div className="surface-card">
        <div className="wishlist-header">
          <div className="wishlist-header-left">
            <h1>
              Danh sách yêu thích
            </h1>
            <p className="wishlist-count">
              {totalItems} sản phẩm
            </p>
          </div>

          <Link to="/products" className="btn btn-outline">
            Tiếp tục mua sắm
          </Link>
        </div>


        {isLoading ? (
          <Spinner message="Đang tải danh sách yêu thích..." className="wishlist-loading" />
        ) : items.length === 0 ? (
          <EmptyState
            icon="♡"
            title="Danh sách yêu thích đang trống"
            description="Hãy khám phá sản phẩm và thêm vào yêu thích để dễ dàng theo dõi."
            actionLabel="Khám phá sản phẩm"
            actionTo="/products"
          />
        ) : (
          <div className="wishlist-grid">
            {items.map((item, index) => {
              const isRemoving = removingId === item.wishlistItemId;
              const hasDiscount = item.originalPrice > item.salePrice;
              const discountPercent = hasDiscount
                ? Math.round(
                    ((item.originalPrice - item.salePrice) /
                      item.originalPrice) *
                      100,
                  )
                : 0;

              return (
                <article
                  className={`wishlist-card ${isRemoving ? "removing" : ""}`}
                  key={item.wishlistItemId}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="wishlist-card-image">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        loading="lazy"
                      />
                    ) : (
                      <span className="wishlist-no-image">
                        {item.articleType || "Sản phẩm"}
                      </span>
                    )}

                    {hasDiscount && (
                      <span className="wishlist-discount-badge">
                        -{discountPercent}%
                      </span>
                    )}

                    <button
                      type="button"
                      className="wishlist-remove-btn"
                      onClick={() => removeItem(item)}
                      disabled={isRemoving}
                      aria-label={`Xóa ${item.productName} khỏi yêu thích`}
                      title="Xóa khỏi yêu thích"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="wishlist-card-body">
                    <span className="wishlist-card-type">
                      {item.articleType}
                    </span>

                    <h3 className="wishlist-card-name">
                      <Link to={`/products/${item.productId}`}>
                        {item.productName}
                      </Link>
                    </h3>

                    <p className="wishlist-card-brand">{item.productBrand}</p>

                    <div className="wishlist-card-price-row">
                      <span className="wishlist-card-sale-price">
                        {formatCurrency(item.salePrice)}
                      </span>
                      {hasDiscount && (
                        <span className="wishlist-card-original-price">
                          {formatCurrency(item.originalPrice)}
                        </span>
                      )}
                    </div>

                    <div className="wishlist-card-footer">
                      <span className="wishlist-card-date">
                        {timeAgo(item.addedAt)}
                      </span>

                      <div className="wishlist-card-actions">
                        <Link
                          to={`/products/${item.productId}`}
                          className="btn btn-primary btn-sm"
                        >
                          Xem sản phẩm
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
