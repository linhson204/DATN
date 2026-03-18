package spring.api.demo.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
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

    void deleteByUser(User user);

    void deleteByUserAndIsSelectedTrue(User user);
}
