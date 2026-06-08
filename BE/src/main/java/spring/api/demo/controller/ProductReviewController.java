package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.dto.review.request.ProductReviewRequest;
import spring.api.demo.dto.review.response.ProductRatingSummaryResponse;
import spring.api.demo.dto.review.response.ProductReviewResponse;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.ProductReviewService;

import java.util.UUID;

@RestController
@RequestMapping("/v1/products/{productId}/reviews")
public class ProductReviewController {

    private final ProductReviewService reviewService;
    private final UserRepository userRepository;

    public ProductReviewController(
            ProductReviewService reviewService,
            UserRepository userRepository
    ) {
        this.reviewService = reviewService;
        this.userRepository = userRepository;
    }

    /**
     * POST /v1/products/{productId}/reviews
     * Tạo đánh giá mới (yêu cầu đăng nhập và đã mua sản phẩm).
     */
    @PostMapping
    public ResponseEntity<SuccessResource<ProductReviewResponse>> createReview(
            @PathVariable UUID productId,
            @Valid @RequestBody ProductReviewRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        ProductReviewResponse response = reviewService.createReview(productId, user.getId(), request);
        return ResponseEntity.ok(new SuccessResource<>("Đánh giá sản phẩm thành công", response));
    }

    /**
     * GET /v1/products/{productId}/reviews
     * Lấy danh sách reviews (public, phân trang).
     */
    @GetMapping
    public ResponseEntity<SuccessResource<PageResponse<ProductReviewResponse>>> getReviews(
            @PathVariable UUID productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        PageResponse<ProductReviewResponse> response = reviewService.getReviewsByProduct(productId, page, size);
        return ResponseEntity.ok(new SuccessResource<>("Lấy danh sách đánh giá thành công", response));
    }

    /**
     * GET /v1/products/{productId}/reviews/summary
     * Lấy tổng quan rating: avg, tổng số, phân phối sao (public).
     */
    @GetMapping("/summary")
    public ResponseEntity<SuccessResource<ProductRatingSummaryResponse>> getRatingSummary(
            @PathVariable UUID productId
    ) {
        ProductRatingSummaryResponse response = reviewService.getRatingSummary(productId);
        return ResponseEntity.ok(new SuccessResource<>("Lấy thống kê đánh giá thành công", response));
    }

    /**
     * DELETE /v1/products/{productId}/reviews/{reviewId}
     * Xóa review (chủ review hoặc ADMIN).
     */
    @DeleteMapping("/{reviewId}")
    public ResponseEntity<MessageResource> deleteReview(
            @PathVariable UUID productId,
            @PathVariable UUID reviewId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        reviewService.deleteReview(reviewId, user.getId(), isAdmin);
        return ResponseEntity.ok(new MessageResource("Xóa đánh giá thành công"));
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
