package spring.api.demo.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.Order;
import spring.api.demo.entity.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    @EntityGraph(attributePaths = {"user", "deliveryInfo", "orderItems", "orderItems.variant", "orderItems.variant.product"})
    List<Order> findByUserOrderByCreatedAtDesc(User user);

    @EntityGraph(attributePaths = {"user", "deliveryInfo", "orderItems", "orderItems.variant", "orderItems.variant.product"})
    List<Order> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"user", "deliveryInfo", "orderItems", "orderItems.variant", "orderItems.variant.product"})
    Page<Order> findByUser(User user, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "deliveryInfo", "orderItems", "orderItems.variant", "orderItems.variant.product"})
    Page<Order> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"user", "deliveryInfo", "orderItems", "orderItems.variant", "orderItems.variant.product"})
    Optional<Order> findByIdAndUser(UUID id, User user);
}
