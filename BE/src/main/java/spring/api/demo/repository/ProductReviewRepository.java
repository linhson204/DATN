package spring.api.demo.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.ProductReview;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductReviewRepository extends JpaRepository<ProductReview, UUID> {

    /** Lấy tất cả reviews của một sản phẩm, mới nhất trước. */
    @Query("SELECT r FROM ProductReview r JOIN FETCH r.user WHERE r.product.id = :productId ORDER BY r.createdAt DESC")
    Page<ProductReview> findByProductId(@Param("productId") UUID productId, Pageable pageable);

    /** Kiểm tra người dùng đã review sản phẩm chưa. */
    Optional<ProductReview> findByProductIdAndUserId(UUID productId, UUID userId);

    /** Tính điểm trung bình rating của sản phẩm. */
    @Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.product.id = :productId")
    Double findAverageRatingByProductId(@Param("productId") UUID productId);

    /** Đếm tổng số review của sản phẩm. */
    long countByProductId(UUID productId);

    /** Đếm số lượng review theo từng mức sao (1–5). */
    @Query("SELECT r.rating, COUNT(r) FROM ProductReview r WHERE r.product.id = :productId GROUP BY r.rating")
    java.util.List<Object[]> countByProductIdGroupByRating(@Param("productId") UUID productId);

    /** Kiểm tra người dùng đã mua (đơn DELIVERED) sản phẩm này chưa. */
    @Query("""
        SELECT COUNT(oi) > 0
        FROM OrderItem oi
        JOIN oi.order o
        WHERE oi.product.id = :productId
          AND o.user.id      = :userId
          AND o.status       = 'DELIVERED'
        """)
    boolean hasUserPurchasedProduct(@Param("productId") UUID productId, @Param("userId") UUID userId);
}
