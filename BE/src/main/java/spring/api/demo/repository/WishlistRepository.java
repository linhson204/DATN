package spring.api.demo.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.dto.user.response.CategoryStatItem;
import spring.api.demo.entity.Product;
import spring.api.demo.entity.User;
import spring.api.demo.entity.Wishlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WishlistRepository extends JpaRepository<Wishlist, UUID> {

    @EntityGraph(attributePaths = {"product", "product.category", "product.material"})
    List<Wishlist> findByUserOrderByCreatedAtDesc(User user);

    @EntityGraph(attributePaths = {"product", "product.category", "product.material"})
    Optional<Wishlist> findByIdAndUser(UUID id, User user);

    @EntityGraph(attributePaths = {"product", "product.category", "product.material"})
    Optional<Wishlist> findByUserAndProduct(User user, Product product);

    void deleteByUser(User user);

    /**
     * Admin: đếm số sản phẩm yêu thích của user, gom nhóm theo articleType.
     */
    @Query("""
        SELECT new spring.api.demo.dto.user.response.CategoryStatItem(
            w.product.category.articleType,
            COUNT(w.id)
        )
        FROM Wishlist w
        WHERE w.user.id = :userId
        GROUP BY w.product.category.articleType
        ORDER BY COUNT(w.id) DESC
        """)
    List<CategoryStatItem> countByArticleTypeForUser(@Param("userId") UUID userId);
}
