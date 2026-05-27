package spring.api.demo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import spring.api.demo.dto.recommendation.SimilarProductResponse.SimilarItem;

@Component
public class PythonRecommendationClient {

    private static final Logger log = LoggerFactory.getLogger(PythonRecommendationClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public PythonRecommendationClient(
            @Value("${python.service.url:http://localhost:8000}") String baseUrl,
            @Value("${python.service.connect-timeout-ms:2000}") int connectTimeoutMs,
            @Value("${python.service.read-timeout-ms:5000}") int readTimeoutMs
    ) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);
        this.baseUrl = baseUrl;
    }

    public PythonRecommendResult getPersonalized(String userId, int topN, String gender) {
        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl + "/recommend/{userId}")
                .queryParam("top_n", topN)
                .queryParamIfPresent("gender", java.util.Optional.ofNullable(gender))
                .buildAndExpand(userId)
                .toUriString();

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<>() {}
            );

            if (response.getBody() == null) {
                log.warn("[PythonClient] /recommend/{} trả về body rỗng", userId);
                return null;
            }

            Map<String, Object> body = response.getBody();
            String strategy = (String) body.getOrDefault("strategy", "personalized");

            // Python trả về: recommendations: [{product_id: "...", score: 0.9}, ...]
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> recommendations =
                    (List<Map<String, Object>>) body.getOrDefault("recommendations", Collections.emptyList());

            List<String> productIds = recommendations.stream()
                    .map(item -> (String) item.get("product_id"))
                    .filter(id -> id != null && !id.isBlank())
                    .toList();

            log.info("[PythonClient] /recommend/{} → strategy={}, count={}", userId, strategy, productIds.size());
            return new PythonRecommendResult(productIds, strategy);

        } catch (RestClientException e) {
            log.warn("[PythonClient] /recommend/{} thất bại ({}): {}", userId, e.getClass().getSimpleName(), e.getMessage());
            return null;
        }
    }

    public record PythonRecommendResult(List<String> productIds, String strategy) {}


    public SimilarResult getSimilar(String productId) {
        String url = baseUrl + "/similar/" + productId;

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<>() {}
            );

            if (response.getBody() == null) {
                log.warn("[PythonClient] /similar/{} trả về body rỗng", productId);
                return null;
            }

            Map<String, Object> body = response.getBody();
            String strategy = (String) body.getOrDefault("strategy", "item_embedding");

            // Python trả về: similarities: [{product_id: "...", score: 0.95}, ...]
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rawSimilarities =
                    (List<Map<String, Object>>) body.getOrDefault("similarities", Collections.emptyList());

            List<SimilarItem> similarities = rawSimilarities.stream()
                    .filter(item -> item.get("product_id") != null)
                    .map(item -> SimilarItem.builder()
                            .productId((String) item.get("product_id"))
                            .score(((Number) item.getOrDefault("score", 0.0)).doubleValue())
                            .build())
                    .toList();

            log.info("[PythonClient] /similar/{} → strategy={}, count={}", productId, strategy, similarities.size());
            return new SimilarResult(similarities, strategy);

        } catch (RestClientException e) {
            log.warn("[PythonClient] /similar/{} thất bại ({}): {}", productId, e.getClass().getSimpleName(), e.getMessage());
            return null;
        }
    }

    public record SimilarResult(List<SimilarItem> similarities, String strategy) {}
}
