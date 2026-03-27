package spring.api.demo.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.ProductViewLog;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ProductViewLogRepository extends JpaRepository<ProductViewLog, UUID> {

    Page<ProductViewLog> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUserIdAndProductId(UUID userId, UUID productId);

    @Query("""
        SELECT pvl FROM ProductViewLog pvl
        JOIN FETCH pvl.product p
        JOIN FETCH p.category
        WHERE pvl.user.id = :userId
        ORDER BY pvl.createdAt DESC
        """)
    List<ProductViewLog> findRecentViewsByUserId(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Cluster source: find products that were co-viewed by users who also viewed the seed product.
     * Returns product IDs ordered by co-view frequency (most co-viewed first).
     */
    @Query("""
        SELECT pvl2.product.id
        FROM ProductViewLog pvl1
        JOIN ProductViewLog pvl2
          ON pvl1.user.id = pvl2.user.id
        WHERE pvl1.product.id = :seedProductId
          AND pvl2.product.id <> :seedProductId
          AND pvl1.createdAt >= :since
          AND pvl2.createdAt >= :since
        GROUP BY pvl2.product.id
        ORDER BY COUNT(pvl2.product.id) DESC
        """)
    List<UUID> findCoViewedProductIds(
            @Param("seedProductId") UUID seedProductId,
            @Param("since") LocalDateTime since,
            Pageable pageable
    );
}
