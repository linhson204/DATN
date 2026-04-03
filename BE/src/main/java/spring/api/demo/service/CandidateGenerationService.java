package spring.api.demo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.config.RecommendationConfig;
import spring.api.demo.dto.recommendation.CandidateDTO;
import spring.api.demo.dto.recommendation.CandidateResponse;
import spring.api.demo.entity.MaterialDictionary;
import spring.api.demo.entity.Product;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.MaterialDictionaryRepository;
import spring.api.demo.repository.ProductRepository;
import spring.api.demo.repository.ProductViewLogRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CandidateGenerationService {

    private static final Logger log = LoggerFactory.getLogger(CandidateGenerationService.class);

    private static final String SOURCE_CLUSTER = "CLUSTER";
    private static final String SOURCE_SAME_BRAND = "SAME_BRAND";
    private static final String SOURCE_SAME_CATEGORY = "SAME_CATEGORY";
    private static final String SOURCE_SIMILAR_PRICE = "SIMILAR_PRICE";
    private static final String SOURCE_COMPATIBLE_MATERIAL = "COMPATIBLE_MATERIAL";

    private final ProductRepository productRepository;
    private final ProductViewLogRepository productViewLogRepository;
    private final MaterialDictionaryRepository materialDictionaryRepository;
    private final RecommendationConfig config;

    public CandidateGenerationService(
            ProductRepository productRepository,
            ProductViewLogRepository productViewLogRepository,
            MaterialDictionaryRepository materialDictionaryRepository,
            RecommendationConfig config
    ) {
        this.productRepository = productRepository;
        this.productViewLogRepository = productViewLogRepository;
        this.materialDictionaryRepository = materialDictionaryRepository;
        this.config = config;
    }

    @Transactional(readOnly = true)
    public CandidateResponse generateCandidates(UUID seedProductId) {
        Product seed = productRepository.findById(seedProductId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));

        PageRequest limit = PageRequest.of(0, config.getCandidatesPerSource());
        Map<UUID, CandidateDTO> candidateMap = new LinkedHashMap<>();

        // ── Source 1: Cluster (co-viewed) ──
        gatherClusterCandidates(seed, limit, candidateMap);

        // ── Source 2: Same Brand ──
        gatherSameBrandCandidates(seed, limit, candidateMap);

        // ── Source 3: Same Category ──
        gatherSameCategoryCandidates(seed, limit, candidateMap);

        // ── Source 4: Similar Price ──
        gatherSimilarPriceCandidates(seed, limit, candidateMap);

        // ── Source 5: Compatible Material ──
        gatherCompatibleMaterialCandidates(seed, limit, candidateMap);

        log.info("Seed product [{}]: gathered {} raw candidates before filtering",
                seedProductId, candidateMap.size());

        // ── Hard Filter ──
        List<CandidateDTO> filtered = applyHardFilters(candidateMap, seed);

        log.info("Seed product [{}]: {} candidates after hard filtering",
                seedProductId, filtered.size());

        // ── Top N ──
        List<CandidateDTO> topN = limitTopN(filtered);

        return CandidateResponse.builder()
                .seedProductId(seedProductId)
                .totalCandidates(topN.size())
                .candidates(topN)
                .build();
    }

    // ────────────────────────── Source Gatherers ──────────────────────────

    private void gatherClusterCandidates(Product seed, PageRequest limit,
                                         Map<UUID, CandidateDTO> candidateMap) {
        LocalDateTime since = LocalDateTime.now().minusDays(config.getClusterLookbackDays());
        List<UUID> coViewedIds = productViewLogRepository.findCoViewedProductIds(
                seed.getId(), since, limit
        );

        if (coViewedIds.isEmpty()) {
            return;
        }

        List<Product> coViewedProducts = productRepository.findAllByIdIn(coViewedIds);
        for (Product p : coViewedProducts) {
            mergeCandidate(candidateMap, p, SOURCE_CLUSTER);
        }
    }

    private void gatherSameBrandCandidates(Product seed, PageRequest limit,
                                           Map<UUID, CandidateDTO> candidateMap) {
        if (seed.getBrand() == null || seed.getBrand().isBlank()) {
            return;
        }

        List<Product> products = productRepository.findCandidatesByBrand(
                seed.getBrand(), seed.getId(), limit
        );
        for (Product p : products) {
            mergeCandidate(candidateMap, p, SOURCE_SAME_BRAND);
        }
    }

    private void gatherSameCategoryCandidates(Product seed, PageRequest limit,
                                              Map<UUID, CandidateDTO> candidateMap) {
        List<Product> products = productRepository.findCandidatesByCategoryId(
                seed.getCategory().getId(), seed.getId(), limit
        );
        for (Product p : products) {
            mergeCandidate(candidateMap, p, SOURCE_SAME_CATEGORY);
        }
    }

    private void gatherSimilarPriceCandidates(Product seed, PageRequest limit,
                                              Map<UUID, CandidateDTO> candidateMap) {
        BigDecimal seedPrice = seed.getSalePrice();
        BigDecimal rangePercent = BigDecimal.valueOf(config.getPriceRangePercent())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal delta = seedPrice.multiply(rangePercent);
        BigDecimal minPrice = seedPrice.subtract(delta);
        BigDecimal maxPrice = seedPrice.add(delta);

        List<Product> products = productRepository.findCandidatesByPriceRange(
                minPrice, maxPrice, seedPrice, seed.getId(), limit
        );
        for (Product p : products) {
            mergeCandidate(candidateMap, p, SOURCE_SIMILAR_PRICE);
        }
    }

    private void gatherCompatibleMaterialCandidates(Product seed, PageRequest limit,
                                                    Map<UUID, CandidateDTO> candidateMap) {
        if (seed.getMaterial() == null) {
            return;
        }

        int seedQuality = seed.getMaterial().getQualityScore();
        int tolerance = config.getMaterialScoreTolerance();
        int minScore = Math.max(0, seedQuality - tolerance);
        int maxScore = Math.min(100, seedQuality + tolerance);

        List<MaterialDictionary> compatibleMaterials =
                materialDictionaryRepository.findByQualityScoreBetween(
                        minScore, maxScore, seed.getMaterial().getId()
                );

        if (compatibleMaterials.isEmpty()) {
            return;
        }

        List<UUID> materialIds = compatibleMaterials.stream()
                .map(MaterialDictionary::getId)
                .collect(Collectors.toList());

        List<Product> products = productRepository.findCandidatesByMaterialIds(
                materialIds, seed.getId(), limit
        );
        for (Product p : products) {
            mergeCandidate(candidateMap, p, SOURCE_COMPATIBLE_MATERIAL);
        }
    }

    // ────────────────────────── Merge & Filter ──────────────────────────

    private void mergeCandidate(Map<UUID, CandidateDTO> candidateMap, Product product, String source) {
        candidateMap.compute(product.getId(), (id, existing) -> {
            if (existing != null) {
                existing.getSources().add(source);
                return existing;
            }
            return toCandidateDTO(product, source);
        });
    }

    private CandidateDTO toCandidateDTO(Product product, String source) {
        LinkedHashSet<String> sources = new LinkedHashSet<>();
        sources.add(source);

        return CandidateDTO.builder()
                .productId(product.getId())
                .productName(product.getName())
                .brand(product.getBrand())
            .articleType(product.getCategory() != null ? product.getCategory().getArticleType() : null)
                .targetGender(product.getTargetGender())
                .salePrice(product.getSalePrice())
                .materialCode(product.getMaterial() != null ? product.getMaterial().getCode() : null)
                .materialQualityScore(product.getMaterial() != null ? product.getMaterial().getQualityScore() : null)
                .totalStock(product.getTotalStock())
                .status(product.getStatus())
                .sources(sources)
                .build();
    }

    /**
     * Hard filter:
     * 1. status = true (active)
     * 2. totalStock > 0 (in stock)
     * 3. targetGender compatible with seed (male -> male/unisex, female -> female/unisex)
     * 4. materialQualityScore >= seed's materialQualityScore (không kém chất liệu)
     */
    private List<CandidateDTO> applyHardFilters(Map<UUID, CandidateDTO> candidateMap, Product seed) {
        Integer seedQuality = (seed.getMaterial() != null) ? seed.getMaterial().getQualityScore() : null;

        return candidateMap.values().stream()
                .filter(c -> Boolean.TRUE.equals(c.getStatus()))
                .filter(c -> c.getTotalStock() != null && c.getTotalStock() > 0)
                .filter(c -> isGenderCompatible(seed, c))
                .filter(c -> {
                    // If seed has no material, skip material quality filter
                    if (seedQuality == null) {
                        return true;
                    }
                    // If candidate has no material, keep it (don't penalize)
                    if (c.getMaterialQualityScore() == null) {
                        return true;
                    }
                    // Candidate's material quality must not be worse than seed's
                    return c.getMaterialQualityScore() >= seedQuality;
                })
                .collect(Collectors.toList());
    }

    private boolean isGenderCompatible(Product seed, CandidateDTO candidate) {
        if (seed == null || seed.getTargetGender() == null) {
            return true;
        }

        Product.TargetGender seedGender = seed.getTargetGender();
        Product.TargetGender candidateGender = candidate.getTargetGender();

        if (candidateGender == null || seedGender == Product.TargetGender.UNISEX) {
            return true;
        }

        if (seedGender == Product.TargetGender.MALE) {
            return candidateGender == Product.TargetGender.MALE
                    || candidateGender == Product.TargetGender.UNISEX;
        }

        if (seedGender == Product.TargetGender.FEMALE) {
            return candidateGender == Product.TargetGender.FEMALE
                    || candidateGender == Product.TargetGender.UNISEX;
        }

        return true;
    }

    /**
     * Sort by number of sources (desc: more sources = stronger signal),
     * then limit to maxTotalCandidates.
     */
    private List<CandidateDTO> limitTopN(List<CandidateDTO> candidates) {
        return candidates.stream()
                .sorted(Comparator.comparingInt((CandidateDTO c) -> c.getSources().size()).reversed())
                .limit(config.getMaxTotalCandidates())
                .collect(Collectors.toCollection(ArrayList::new));
    }
}
