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

    // ─────────────────────────────────────────────────────────────────────────
    // Endpoint cũ: rule-based candidate generation (Phase 1)
    // GET /v1/recommendations/candidates/{productId}
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/candidates/{productId}")
    public ResponseEntity<CandidateResponse> getCandidates(@PathVariable UUID productId) {
        CandidateResponse response = candidateGenerationService.generateCandidates(productId);
        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Endpoint mới: personalized recommendations từ Python AI model (Phase 4)
    // GET /v1/recommendations/personalized/{userId}?top_n=20&gender=MALE
    //
    // Fallback: nếu Python service down → trả về rỗng với fromAiModel=false
    // ─────────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────────
    // Endpoint sản phẩm tương tự từ AI model (Phase 4)
    // GET /v1/recommendations/similar/{productId}
    //
    // Proxy sang Python FastAPI GET /similar/{productId}
    // Fallback: nếu Python service down → trả về similarities rỗng với fromAiModel=false
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/similar/{productId}")
    public ResponseEntity<SimilarProductResponse> getSimilar(@PathVariable String productId) {
        PythonRecommendationClient.SimilarResult result = pythonClient.getSimilar(productId);

        if (result != null) {
            return ResponseEntity.ok(SimilarProductResponse.builder()
                    .productId(productId)
                    .strategy(result.strategy())
                    .similarities(result.similarities())
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
