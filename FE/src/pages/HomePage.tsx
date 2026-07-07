import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { productsApi, recommendationApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import { useAuth } from "../context/AuthContext";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";
import { useInterestedProducts } from "../hooks/useInterestedProducts";
import { useTodayBrowsedProducts } from "../hooks/useTodayBrowsedProducts";
import { Spinner } from "../components/ui/Spinner";
import { ProductCard } from "../components/ui/ProductCard";

const HOME_PRODUCT_LIMIT = 30;

function uniqueById(products: Product[]): Product[] {
  const map = new Map<string, Product>();
  products.forEach((product) => {
    map.set(product.id, product);
  });

  return Array.from(map.values());
}

export function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const interestedProducts = useInterestedProducts(user?.id);
  const todayBrowsed = useTodayBrowsedProducts(user?.id);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setError(null);
      setIsLoading(true);
      setRecommendedProducts([]);
      setStrategy(null);

      try {
        if (!isAuthenticated || !user?.id) {
          return;
        }

        const recommendResponse = await recommendationApi.recommendPersonalized(
          user.id,
          HOME_PRODUCT_LIMIT,
          user.gender?.toUpperCase() ?? undefined,
        );

        setStrategy(recommendResponse.strategy);

        if (recommendResponse.product_ids.length === 0) {
          setRecommendedProducts([]);
          return;
        }

        const detailResults = await Promise.allSettled(
          recommendResponse.product_ids.map((productId) =>
            productsApi.byId(productId),
          ),
        );

        const resolved = detailResults
          .filter(
            (result): result is PromiseFulfilledResult<Product> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value)
          .filter((product) => product.status);

        setRecommendedProducts(
          uniqueById(resolved).slice(0, HOME_PRODUCT_LIMIT),
        );
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [isAuthenticated, user?.id]);

  return (
    <section className="home-page reveal-up">
      {/* <section className="home-hero">
        <div className="hero-overlay">
          <h2>Thời trang cho mọi khoảnh khắc</h2>
          <p>
            Khám phá bộ sưu tập mới với phong cách độc đáo chỉ có tại cửa hàng
            chúng tôi.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn hero-btn-primary">
              Mua sắm ngay
            </Link>
          </div>
        </div>
      </section> */}

      <section id="featured-products" className="surface-card featured-shell">
        <div className="featured-top">
          <div className="featured-title-wrap">
            <h2>Sản phẩm gợi ý ngày hôm nay</h2>
          </div>

          <Link to="/products" className="featured-view-all">
            Xem tất cả
          </Link>
        </div>

        {error && <p className="alert error">{error}</p>}

        {!isAuthenticated ? (
          <div className="home-login-cta">
            <p className="placeholder">
              Vui lòng đăng nhập để hệ thống recommendation đề xuất sản phẩm phù
              hợp bạn.
            </p>
            <Link className="btn btn-primary" to="/auth">
              Đăng nhập để xem gợi ý
            </Link>
          </div>
        ) : isLoading ? (
          <Spinner message="Đang tải sản phẩm..." className="home-loading" />
        ) : recommendedProducts.length === 0 ? (
          <p className="placeholder">Chưa có sản phẩm để hiển thị.</p>
        ) : (
          <div className="home-product-grid">
            {recommendedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {interestedProducts.isVisible && (
        <section className="surface-card featured-shell interested-products-shell">
          <div className="featured-top">
            <div className="featured-title-wrap">
              <h2>Sản phẩm bạn đang quan tâm</h2>
            </div>

            <Link to="/products" className="featured-view-all">
              Xem thêm
            </Link>
          </div>

          <p className="featured-subtitle">
            Gợi ý theo hành vi hôm nay.
          </p>

          {interestedProducts.isLoading ? (
            <div className="interested-skeleton-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <article
                  className="interested-skeleton-card"
                  key={`interested-skeleton-${index}`}
                >
                  <div className="interested-skeleton-thumb" />
                  <div className="interested-skeleton-line short" />
                  <div className="interested-skeleton-line" />
                  <div className="interested-skeleton-line medium" />
                </article>
              ))}
            </div>
          ) : interestedProducts.error ? (
            <div className="interested-error-box">
              <p className="alert error">{interestedProducts.error}</p>
              <button
                className="btn btn-outline"
                type="button"
                onClick={interestedProducts.retry}
              >
                Thử lại
              </button>
            </div>
          ) : interestedProducts.isEmpty ? (
            <div className="interested-empty-box">
              <p className="placeholder">
                Hôm nay chưa tìm được sản phẩm tương tự phù hợp. Bạn có thể thử
                xem thêm sản phẩm mới.
              </p>
            </div>
          ) : (
            <div className="home-product-grid interested-product-grid">
              {interestedProducts.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Sản phẩm bạn đã xem hôm nay ── */}
      {isAuthenticated && todayBrowsed.isVisible && (
        <section className="surface-card featured-shell today-browsed-shell">
          <div className="featured-top">
            <div className="featured-title-wrap">
              <h2>Sản phẩm bạn đã xem hôm nay</h2>
            </div>

            <Link to="/products" className="featured-view-all">
              Xem thêm
            </Link>
          </div>

          <p className="featured-subtitle">
            Dựa trên lịch sử tương tác của bạn trong ngày hôm nay.
          </p>

          {todayBrowsed.isLoading ? (
            <div className="interested-skeleton-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <article
                  className="interested-skeleton-card"
                  key={`today-skeleton-${index}`}
                >
                  <div className="interested-skeleton-thumb" />
                  <div className="interested-skeleton-line short" />
                  <div className="interested-skeleton-line" />
                  <div className="interested-skeleton-line medium" />
                </article>
              ))}
            </div>
          ) : todayBrowsed.error ? (
            <div className="interested-error-box">
              <p className="alert error">{todayBrowsed.error}</p>
              <button
                className="btn btn-outline"
                type="button"
                onClick={todayBrowsed.retry}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <div className="home-product-grid today-browsed-grid">
              {todayBrowsed.items.map(({ product, eventType }) => {
                const badgeMap: Record<
                  typeof eventType,
                  { label: string; cls: string }
                > = {
                  ORDER: {
                    label: "Đã mua",
                    cls: "today-browsed-badge today-browsed-badge-order",
                  },
                  CART: {
                    label: "Giỏ hàng",
                    cls: "today-browsed-badge today-browsed-badge-cart",
                  },
                  WISHLIST: {
                    label: "Yêu thích",
                    cls: "today-browsed-badge today-browsed-badge-wishlist",
                  },
                  VIEW: {
                    label: "Đã xem",
                    cls: "today-browsed-badge today-browsed-badge-view",
                  },
                };
                const badge = badgeMap[eventType];

                return (
                  <article
                    className="home-product-card today-browsed-card"
                    key={product.id}
                  >
                    <div className="home-product-thumb today-browsed-thumb">
                      {badge && (
                        <span className={badge.cls} aria-label={badge.label}>
                          {badge.label}
                        </span>
                      )}
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          loading="lazy"
                        />
                      ) : (
                        <span>
                          {product.category?.articleType || "Sản phẩm"}
                        </span>
                      )}
                    </div>

                    <h3>{product.name}</h3>
                    <p className="muted">{product.brand}</p>
                    <p className="price">{formatCurrency(product.salePrice)}</p>

                    <div className="card-actions">
                      <Link
                        className="btn btn-outline"
                        to={`/products/${product.id}`}
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
