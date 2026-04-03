package spring.api.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.ProductCategory;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {
    Optional<ProductCategory> findByArticleTypeIgnoreCaseAndStatusTrue(String articleType);

    @Query("""
        SELECT DISTINCT c.masterCategory
        FROM ProductCategory c
        WHERE c.status = true
        ORDER BY c.masterCategory
        """)
    List<String> findDistinctActiveMasterCategories();

    @Query("""
        SELECT DISTINCT c.subCategory
        FROM ProductCategory c
        WHERE c.status = true
          AND LOWER(c.masterCategory) = LOWER(:masterCategory)
        ORDER BY c.subCategory
        """)
    List<String> findDistinctActiveSubCategoriesByMasterCategory(@Param("masterCategory") String masterCategory);

    @Query("""
        SELECT c.articleType
        FROM ProductCategory c
        WHERE c.status = true
          AND LOWER(c.subCategory) = LOWER(:subCategory)
        ORDER BY c.articleType
        """)
    List<String> findActiveArticleTypesBySubCategory(@Param("subCategory") String subCategory);
}
