package spring.api.demo.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.dto.review.request.ProductReviewRequest;
import spring.api.demo.dto.review.response.ProductRatingSummaryResponse;
import spring.api.demo.dto.review.response.ProductReviewResponse;
import spring.api.demo.entity.Product;
import spring.api.demo.entity.ProductReview;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.ProductRepository;
import spring.api.demo.repository.ProductReviewRepository;
import spring.api.demo.repository.UserRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProductReviewService {

    private final ProductReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public ProductReviewService(
            ProductReviewRepository reviewRepository,
            ProductRepository productRepository,
            UserRepository userRepository
    ) {
        this.reviewRepository = reviewRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    /**
     * Tạo đánh giá mới. Người dùng phải đã mua và nhận được sản phẩm (order DELIVERED).
     */
    @Transactional
    public ProductReviewResponse createReview(UUID productId, UUID userId, ProductReviewRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Kiểm tra đã mua sản phẩm chưa
        if (!reviewRepository.hasUserPurchasedProduct(productId, userId)) {
            throw new AppException(ErrorCode.REVIEW_NOT_PURCHASED);
        }

        // Kiểm tra đã review chưa
        if (reviewRepository.findByProductIdAndUserId(productId, userId).isPresent()) {
            throw new AppException(ErrorCode.REVIEW_ALREADY_EXISTS);
        }

        ProductReview review = ProductReview.builder()
                .user(user)
                .product(product)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        ProductReview saved = reviewRepository.save(review);
        return toResponse(saved);
    }

    /**
     * Lấy danh sách reviews của một sản phẩm (phân trang).
     */
    @Transactional(readOnly = true)
    public PageResponse<ProductReviewResponse> getReviewsByProduct(UUID productId, int page, int size) {
        if (!productRepository.existsById(productId)) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
        }
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 50),
                Sort.by("createdAt").descending()
        );
        Page<ProductReviewResponse> result = reviewRepository
                .findByProductId(productId, pageable)
                .map(this::toResponse);
        return PageResponse.fromPage(result);
    }

    /**
     * Lấy tổng quan rating: avg, tổng số, phân phối sao.
     */
    @Transactional(readOnly = true)
    public ProductRatingSummaryResponse getRatingSummary(UUID productId) {
        if (!productRepository.existsById(productId)) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
        }

        Double avg = reviewRepository.findAverageRatingByProductId(productId);
        long total = reviewRepository.countByProductId(productId);

        // Khởi tạo distribution với tất cả 5 mức = 0
        Map<Integer, Long> distribution = new HashMap<>();
        for (int i = 1; i <= 5; i++) {
            distribution.put(i, 0L);
        }

        List<Object[]> rawCounts = reviewRepository.countByProductIdGroupByRating(productId);
        for (Object[] row : rawCounts) {
            Integer star = (Integer) row[0];
            Long count = (Long) row[1];
            distribution.put(star, count);
        }

        return ProductRatingSummaryResponse.builder()
                .averageRating(avg != null ? Math.round(avg * 10.0) / 10.0 : 0.0)
                .totalReviews(total)
                .ratingDistribution(distribution)
                .build();
    }

    /**
     * Xóa review. Chỉ chủ review hoặc ADMIN mới được xóa.
     */
    @Transactional
    public void deleteReview(UUID reviewId, UUID requestingUserId, boolean isAdmin) {
        ProductReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new AppException(ErrorCode.REVIEW_NOT_FOUND));

        if (!isAdmin && !review.getUser().getId().equals(requestingUserId)) {
            throw new AppException(ErrorCode.REVIEW_FORBIDDEN);
        }

        reviewRepository.delete(review);
    }

    // ─── Mapping helper ──────────────────────────────────────────────────────

    private ProductReviewResponse toResponse(ProductReview review) {
        return ProductReviewResponse.builder()
                .id(review.getId())
                .userId(review.getUser().getId())
                .userFullName(review.getUser().getFullName())
                .rating(review.getRating())
                .comment(review.getComment())
                .createdAt(review.getCreatedAt())
                .updatedAt(review.getUpdatedAt())
                .build();
    }
}
