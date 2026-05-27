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
 * Response trả về FE từ endpoint GET /v1/recommendations/similar/{productId}.
 * Proxy từ Python FastAPI GET /similar/{product_id}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SimilarProductResponse {

    @JsonProperty("product_id")
    String productId;

    String strategy;

    /** Danh sách sản phẩm tương tự kèm điểm similarity */
    List<SimilarItem> similarities;

    /** true nếu dữ liệu lấy từ AI model, false nếu fallback */
    @Builder.Default
    boolean fromAiModel = true;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class SimilarItem {

        @JsonProperty("product_id")
        String productId;

        double score;
    }
}
