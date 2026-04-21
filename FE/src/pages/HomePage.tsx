import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { productsApi, recommendationApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import { useAuth } from "../context/AuthContext";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";

const HOME_PRODUCT_LIMIT = 20;

function uniqueById(products: Product[]): Product[] {
  const map = new Map<string, Product>();
  products.forEach((product) => {
    map.set(product.id, product);
  });

  return Array.from(map.values());
}

export function HomePage() {
  const { user, isAuthenticated } = useAuth();
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

        const recommendResponse = await recommendationApi.recommendFromPython(
          user.id,
          HOME_PRODUCT_LIMIT,
        );

        setStrategy(recommendResponse.strategy);

        if (recommendResponse.productIds.length === 0) {
          setRecommendedProducts([]);
          return;
        }

        const detailResults = await Promise.allSettled(
          recommendResponse.productIds.map((productId) =>
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
      <section className="home-hero">
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
            <a href="#featured-products" className="btn hero-btn-ghost">
              Xem bộ sưu tập
            </a>
          </div>
        </div>
      </section>

      <section className="home-promos">
        <article className="promo-card promo-blue">
          <h3>Giảm 50% cho đơn hàng đầu tiên</h3>
          <p>Sử dụng mã WELCOME50 để nhận ưu đãi.</p>
        </article>
        <article className="promo-card promo-pink">
          <h3>Flash Sale mỗi thứ sáu</h3>
          <p>Giảm tới 70% cho sản phẩm chọn lọc.</p>
        </article>
        <article className="promo-card promo-green">
          <h3>Miễn phí vận chuyển</h3>
          <p>Cho đơn hàng từ 500.000 VND trên toàn quốc.</p>
        </article>
      </section>

      <section id="featured-products" className="surface-card featured-shell">
        <div className="featured-top">
          <div className="featured-title-wrap">
            <span className="featured-icon" aria-hidden="true">
              🔥
            </span>
            <h2>Sản phẩm nổi bật</h2>
          </div>

          <Link to="/products" className="featured-view-all">
            Xem tất cả
          </Link>
        </div>

        <p className="featured-subtitle">
          {isAuthenticated
            ? strategy
              ? `Sản phẩm gợi ý cho bạn (chiến lược: ${strategy})`
              : "Sản phẩm gợi ý cho bạn"
            : "Đăng nhập để nhận gợi ý cá nhân hóa"}
        </p>

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
          <div className="home-loading">Đang tải sản phẩm...</div>
        ) : recommendedProducts.length === 0 ? (
          <p className="placeholder">Chưa có sản phẩm để hiển thị.</p>
        ) : (
          <div className="home-product-grid">
            {recommendedProducts.map((product) => (
              <article className="home-product-card" key={product.id}>
                <div className="home-product-thumb">
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
            ))}
          </div>
        )}
      </section>

      <section id="about" className="home-info-block">
        <h3>Giới thiệu</h3>
        <p>
          S and T là thương hiệu tập trung vào trải nghiệm thời trang hiện đại,
          đơn giản và dễ phối cho mọi phong cách sống.
        </p>
      </section>

      <section id="contact" className="home-info-block">
        <h3>Liên hệ</h3>
        <p>Email: support@sandt.vn | Hotline: 0909 000 111</p>
      </section>
    </section>
  );
}
