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
import java.util.List;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    @Override
    @EntityGraph(attributePaths = {"category", "attributes", "material"})
    Page<Product> findAll(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"category", "attributes", "material"})
    java.util.Optional<Product> findById(UUID id);

        @EntityGraph(attributePaths = {"category", "attributes", "material"})
        @Query("""
            SELECT p
            FROM Product p
            JOIN p.category c
            WHERE (:name IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :name, '%')))
              AND (:articleType IS NULL OR LOWER(c.articleType) = LOWER(:articleType))
              AND (:minPrice IS NULL OR p.salePrice >= :minPrice)
              AND (:maxPrice IS NULL OR p.salePrice <= :maxPrice)
            """)
        Page<Product> search(
            @Param("name") String name,
            @Param("articleType") String articleType,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            Pageable pageable
        );

    // ── Candidate Generation Queries ──

    @Query("""
        SELECT p FROM Product p
        LEFT JOIN FETCH p.category
        LEFT JOIN FETCH p.material
        WHERE p.brand = :brand
          AND p.id <> :excludeId
          AND p.status = true
          AND p.totalStock > 0
        ORDER BY p.salePrice ASC
        """)
    List<Product> findCandidatesByBrand(
            @Param("brand") String brand,
            @Param("excludeId") UUID excludeId,
            Pageable pageable
    );

    @Query("""
        SELECT p FROM Product p
        LEFT JOIN FETCH p.category
        LEFT JOIN FETCH p.material
        WHERE p.category.id = :categoryId
          AND p.id <> :excludeId
          AND p.status = true
          AND p.totalStock > 0
        ORDER BY p.salePrice ASC
        """)
    List<Product> findCandidatesByCategoryId(
            @Param("categoryId") UUID categoryId,
            @Param("excludeId") UUID excludeId,
            Pageable pageable
    );

    @Query("""
        SELECT p FROM Product p
        LEFT JOIN FETCH p.category
        LEFT JOIN FETCH p.material
        WHERE p.salePrice BETWEEN :minPrice AND :maxPrice
          AND p.id <> :excludeId
          AND p.status = true
          AND p.totalStock > 0
        ORDER BY ABS(p.salePrice - :seedPrice) ASC
        """)
    List<Product> findCandidatesByPriceRange(
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("seedPrice") BigDecimal seedPrice,
            @Param("excludeId") UUID excludeId,
            Pageable pageable
    );

    @Query("""
        SELECT p FROM Product p
        LEFT JOIN FETCH p.category
        LEFT JOIN FETCH p.material
        WHERE p.material.id IN :materialIds
          AND p.id <> :excludeId
          AND p.status = true
          AND p.totalStock > 0
        ORDER BY p.salePrice ASC
        """)
    List<Product> findCandidatesByMaterialIds(
            @Param("materialIds") List<UUID> materialIds,
            @Param("excludeId") UUID excludeId,
            Pageable pageable
    );

    @Query("""
        SELECT p FROM Product p
        LEFT JOIN FETCH p.category
        LEFT JOIN FETCH p.material
        WHERE p.id IN :productIds
          AND p.status = true
          AND p.totalStock > 0
        """)
    List<Product> findAllByIdIn(@Param("productIds") List<UUID> productIds);
}