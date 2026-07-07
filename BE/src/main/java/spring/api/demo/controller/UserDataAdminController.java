package spring.api.demo.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.dto.user.response.UserStatsResponse;
import spring.api.demo.dto.user.response.UserSummaryResponse;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.UserDataAdminService;

import java.util.UUID;

/**
 * Admin-only endpoints cho quản lý dữ liệu người dùng.
 * Tất cả endpoints đều yêu cầu role ADMIN (cấu hình trong SecurityConfig).
 */
@RestController
@RequestMapping("/v1/admin")
@RequiredArgsConstructor
public class UserDataAdminController {

    private final UserDataAdminService userDataAdminService;

    /**
     * Lấy danh sách người dùng có phân trang.
     * Mặc định: 30 người / trang, sắp xếp theo createdAt tăng dần.
     */
    @GetMapping("/users")
    public ResponseEntity<SuccessResource<PageResponse<UserSummaryResponse>>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        PageResponse<UserSummaryResponse> result = userDataAdminService.listUsers(page, size);
        return ResponseEntity.ok(new SuccessResource<>("Lấy danh sách người dùng thành công", result));
    }

    /**
     * Lấy thống kê hành vi của một người dùng theo articleType
     * (xem, giỏ hàng, đơn hàng, wishlist).
     */
    @GetMapping("/users/{userId}/stats")
    public ResponseEntity<SuccessResource<UserStatsResponse>> getUserStats(
            @PathVariable UUID userId) {
        UserStatsResponse stats = userDataAdminService.getUserStats(userId);
        return ResponseEntity.ok(new SuccessResource<>("Lấy thống kê người dùng thành công", stats));
    }
}
