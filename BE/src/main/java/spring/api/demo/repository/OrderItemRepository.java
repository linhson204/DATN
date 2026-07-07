package spring.api.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.dto.user.response.CategoryStatItem;
import spring.api.demo.entity.OrderItem;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    /**
     * Admin: tổng số lượng sản phẩm đã đặt của user, gom nhóm theo articleType.
     * Dùng SUM(quantity) để phản ánh đúng số lượng thực tế đặt mua.
     */
    @Query("""
        SELECT new spring.api.demo.dto.user.response.CategoryStatItem(
            oi.product.category.articleType,
            SUM(oi.quantity)
        )
        FROM OrderItem oi
        WHERE oi.order.user.id = :userId
          AND oi.product IS NOT NULL
        GROUP BY oi.product.category.articleType
        ORDER BY SUM(oi.quantity) DESC
        """)
    List<CategoryStatItem> countByArticleTypeForUser(@Param("userId") UUID userId);
}
