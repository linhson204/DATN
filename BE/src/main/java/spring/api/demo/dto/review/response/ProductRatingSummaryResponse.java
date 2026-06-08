package spring.api.demo.dto.review.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductRatingSummaryResponse {

    /** Điểm trung bình (0.0 nếu chưa có review). */
    Double averageRating;

    /** Tổng số review. */
    Long totalReviews;

    /**
     * Phân phối sao: key = số sao (1–5), value = số lượng review.
     * Ví dụ: {1: 2, 2: 0, 3: 5, 4: 10, 5: 30}
     */
    Map<Integer, Long> ratingDistribution;
}
