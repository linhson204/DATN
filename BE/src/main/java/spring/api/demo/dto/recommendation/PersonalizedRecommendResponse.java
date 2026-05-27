package spring.api.demo.dto.recommendation;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Response trả về FE từ endpoint GET /v1/recommendations/personalized/{userId}.
 * Proxy từ Python FastAPI GET /recommend/{user_id}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PersonalizedRecommendResponse {

    @JsonProperty("user_id")
    String userId;

    String strategy;

    @JsonProperty("product_ids")
    List<String> productIds;

    @Builder.Default
    boolean fromAiModel = true;
}
