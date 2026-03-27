package spring.api.demo.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.recommendation.CandidateResponse;
import spring.api.demo.service.CandidateGenerationService;

import java.util.UUID;

@RestController
@RequestMapping("/v1/recommendations")
public class RecommendationController {

    private final CandidateGenerationService candidateGenerationService;

    public RecommendationController(CandidateGenerationService candidateGenerationService) {
        this.candidateGenerationService = candidateGenerationService;
    }

    @GetMapping("/candidates/{productId}")
    public ResponseEntity<CandidateResponse> getCandidates(@PathVariable UUID productId) {
        CandidateResponse response = candidateGenerationService.generateCandidates(productId);
        return ResponseEntity.ok(response);
    }
}
