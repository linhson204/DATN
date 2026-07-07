package spring.api.demo.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import spring.api.demo.dto.user.response.CategoryStatItem;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.CartItem;
import spring.api.demo.entity.ProductVariant;
import spring.api.demo.entity.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, UUID> {

    @EntityGraph(attributePaths = {"variant", "variant.product"})
    List<CartItem> findByUserOrderByCreatedAtDesc(User user);

    @EntityGraph(attributePaths = {"variant", "variant.product"})
    List<CartItem> findByUserAndIsSelectedTrueOrderByCreatedAtDesc(User user);

    @EntityGraph(attributePaths = {"variant", "variant.product"})
    Optional<CartItem> findByUserAndVariant(User user, ProductVariant variant);

    @EntityGraph(attributePaths = {"variant", "variant.product"})
    Optional<CartItem> findByIdAndUser(UUID id, User user);

    @Modifying
    @Query("DELETE FROM CartItem c WHERE c.user = :user")
    void deleteByUser(@Param("user") User user);

    @Modifying
    @Query("DELETE FROM CartItem c WHERE c.user = :user AND c.isSelected = true")
    void deleteByUserAndIsSelectedTrue(@Param("user") User user);

    /**
     * Admin: đếm số sản phẩm trong giỏ hàng của user, gom nhóm theo articleType.
     */
    @Query("""
        SELECT new spring.api.demo.dto.user.response.CategoryStatItem(
            ci.variant.product.category.articleType,
            COUNT(ci.id)
        )
        FROM CartItem ci
        WHERE ci.user.id = :userId
        GROUP BY ci.variant.product.category.articleType
        ORDER BY COUNT(ci.id) DESC
        """)
    List<CategoryStatItem> countByArticleTypeForUser(@Param("userId") UUID userId);
}
