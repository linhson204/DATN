package spring.api.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.Product;

import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    @Override
    @EntityGraph(attributePaths = {"category", "attributes"})
    Page<Product> findAll(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"category", "attributes"})
    java.util.Optional<Product> findById(UUID id);

        @EntityGraph(attributePaths = {"category", "attributes"})
        @Query("""
            SELECT p
            FROM Product p
            JOIN p.category c
            WHERE (:name IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :name, '%')))
              AND (:categoryCode IS NULL OR LOWER(c.code) = LOWER(:categoryCode))
              AND (:minPrice IS NULL OR p.salePrice >= :minPrice)
              AND (:maxPrice IS NULL OR p.salePrice <= :maxPrice)
            """)
        Page<Product> search(
            @Param("name") String name,
            @Param("categoryCode") String categoryCode,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            Pageable pageable
        );
}