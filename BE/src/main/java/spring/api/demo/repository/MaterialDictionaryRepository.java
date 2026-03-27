package spring.api.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.MaterialDictionary;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MaterialDictionaryRepository extends JpaRepository<MaterialDictionary, UUID> {
    Optional<MaterialDictionary> findByCode(String code);

    boolean existsByCode(String code);

    @Query("""
        SELECT m FROM MaterialDictionary m
        WHERE m.qualityScore BETWEEN :minScore AND :maxScore
          AND m.id <> :excludeId
        """)
    List<MaterialDictionary> findByQualityScoreBetween(
            @Param("minScore") int minScore,
            @Param("maxScore") int maxScore,
            @Param("excludeId") UUID excludeId
    );
}

