package spring.api.demo.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.dto.user.response.CategoryStatItem;
import spring.api.demo.dto.user.response.UserStatsResponse;
import spring.api.demo.dto.user.response.UserSummaryResponse;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.CartItemRepository;
import spring.api.demo.repository.OrderItemRepository;
import spring.api.demo.repository.ProductViewLogRepository;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.repository.WishlistRepository;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserDataAdminService {

    private final UserRepository userRepository;
    private final ProductViewLogRepository viewLogRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderItemRepository orderItemRepository;
    private final WishlistRepository wishlistRepository;

    // ─── List users (paginated) ────────────────────────────────────────────────

    public PageResponse<UserSummaryResponse> listUsers(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "createdAt"));
        Page<UserSummaryResponse> resultPage = userRepository.findAll(pageable)
                .map(this::toSummary);
        return PageResponse.fromPage(resultPage);
    }

    // ─── Stats per user ───────────────────────────────────────────────────────

    public UserStatsResponse getUserStats(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        List<CategoryStatItem> viewStats    = viewLogRepository.countByArticleTypeForUser(userId);
        List<CategoryStatItem> cartStats    = cartItemRepository.countByArticleTypeForUser(userId);
        List<CategoryStatItem> orderStats   = orderItemRepository.countByArticleTypeForUser(userId);
        List<CategoryStatItem> wishlistStats = wishlistRepository.countByArticleTypeForUser(userId);

        return UserStatsResponse.builder()
                .userId(userId.toString())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .viewStats(viewStats)
                .cartStats(cartStats)
                .orderStats(orderStats)
                .wishlistStats(wishlistStats)
                .build();
    }

    // ─── Mapper ───────────────────────────────────────────────────────────────

    private UserSummaryResponse toSummary(User u) {
        return UserSummaryResponse.builder()
                .id(u.getId().toString())
                .username(u.getUsername())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .role(u.getRole() != null ? u.getRole().getName() : null)
                .membershipLevel(u.getMembershipLevel() != null ? u.getMembershipLevel().getValue() : null)
                .status(u.getStatus())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
