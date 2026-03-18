package spring.api.demo.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.ProductVariant;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {

    @Override
    @EntityGraph(attributePaths = {"product"})
    Optional<ProductVariant> findById(UUID id);
}
