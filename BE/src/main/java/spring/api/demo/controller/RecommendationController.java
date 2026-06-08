package spring.api.demo.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.recommendation.CandidateResponse;
import spring.api.demo.dto.recommendation.PersonalizedRecommendResponse;
import spring.api.demo.dto.recommendation.SimilarProductResponse;
import spring.api.demo.service.CandidateGenerationService;
import spring.api.demo.service.PythonRecommendationClient;
import spring.api.demo.service.PythonRecommendationClient.PythonRecommendResult;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/recommendations")
public class RecommendationController {

    private static final Logger log = LoggerFactory.getLogger(RecommendationController.class);

    private static final int DEFAULT_TOP_N_PERSONALIZED = 30;
    private static final int DEFAULT_TOP_N_SIMILAR = 10;

    private final CandidateGenerationService candidateGenerationService;
    private final PythonRecommendationClient pythonClient;

    public RecommendationController(
            CandidateGenerationService candidateGenerationService,
            PythonRecommendationClient pythonClient
    ) {
        this.candidateGenerationService = candidateGenerationService;
        this.pythonClient = pythonClient;
    }


    @GetMapping("/candidates/{productId}")
    public ResponseEntity<CandidateResponse> getCandidates(@PathVariable UUID productId) {
        CandidateResponse response = candidateGenerationService.generateCandidates(productId);
        return ResponseEntity.ok(response);
    }



    @GetMapping("/personalized/{userId}")
    public ResponseEntity<PersonalizedRecommendResponse> getPersonalized(
            @PathVariable String userId,
            @RequestParam(defaultValue = "30") int topN,
            @RequestParam(required = false) String gender
    ) {
        PythonRecommendResult result = pythonClient.getPersonalized(userId, topN, gender);

        if (result != null) {
            return ResponseEntity.ok(PersonalizedRecommendResponse.builder()
                    .userId(userId)
                    .strategy(result.strategy())
                    .productIds(result.productIds())
                    .fromAiModel(true)
                    .build());
        }

        // ── Fallback: Python service không khả dụng ──
        log.warn("[Recommendations] Python service không khả dụng cho user={}, trả về danh sách rỗng", userId);
        return ResponseEntity.ok(PersonalizedRecommendResponse.builder()
                .userId(userId)
                .strategy("unavailable")
                .productIds(List.of())
                .fromAiModel(false)
                .build());
    }


    @GetMapping("/similar/{productId}")
    public ResponseEntity<SimilarProductResponse> getSimilar(@PathVariable String productId) {
        PythonRecommendationClient.SimilarResult result = pythonClient.getSimilar(productId);

        if (result != null) {
            // Prepend sản phẩm gốc vào đầu danh sách với score=1.0
            // → tổng = 1 (gốc) + 5 (tương tự) = 6 items
            List<SimilarProductResponse.SimilarItem> allItems = new ArrayList<>();
            allItems.add(SimilarProductResponse.SimilarItem.builder()
                    .productId(productId)
                    .score(1.0)
                    .build());
            allItems.addAll(result.similarities());

            return ResponseEntity.ok(SimilarProductResponse.builder()
                    .productId(productId)
                    .strategy(result.strategy())
                    .similarities(allItems)
                    .fromAiModel(true)
                    .build());
        }

        // ── Fallback: Python service không khả dụng ──
        log.warn("[Recommendations] Python service không khả dụng cho similar product={}, trả về danh sách rỗng", productId);
        return ResponseEntity.ok(SimilarProductResponse.builder()
                .productId(productId)
                .strategy("unavailable")
                .similarities(List.of())
                .fromAiModel(false)
                .build());
    }
}
