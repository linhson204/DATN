package spring.api.demo.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.entity.Product;
import spring.api.demo.entity.ProductViewLog;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.ProductRepository;
import spring.api.demo.repository.ProductViewLogRepository;
import spring.api.demo.repository.UserRepository;
import java.util.List;
import java.util.UUID;

@Service
public class ProductViewLogService {

    private final ProductViewLogRepository productViewLogRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public ProductViewLogService(
            ProductViewLogRepository productViewLogRepository,
            ProductRepository productRepository,
            UserRepository userRepository
    ) {
        this.productViewLogRepository = productViewLogRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void logView(UUID userId, UUID productId, ProductViewLog.ViewType viewType, int durationSeconds) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));

        ProductViewLog.ViewType resolvedViewType = resolveViewType(durationSeconds);

        ProductViewLog log = ProductViewLog.builder()
                .user(user)
                .product(product)
                .viewType(resolvedViewType)
                .durationSeconds(durationSeconds)
                .build();

        productViewLogRepository.save(log);
    }


    // Lấy danh sách sản phẩm đã xem gần đây của người dùng, có thể giới hạn số lượng trả về
    @Transactional(readOnly = true)
    public List<ProductViewLog> getRecentViews(UUID userId, int limit) {
        return productViewLogRepository.findRecentViewsByUserId(
                userId,
                PageRequest.of(0, limit)
        );
    }

    // Đếm số lần người dùng đã xem một sản phẩm cụ thể
    @Transactional(readOnly = true)
    public long getViewCount(UUID userId, UUID productId) {
        return productViewLogRepository.countByUserIdAndProductId(userId, productId);
    }

    private ProductViewLog.ViewType resolveViewType(int durationSeconds) {
        if (durationSeconds < 60 && durationSeconds > 6) {
            return ProductViewLog.ViewType.QUICK_VIEW;
        }
        if (durationSeconds < 210 && durationSeconds >= 60) {
            return ProductViewLog.ViewType.DETAIL_VIEW;
        }
        return ProductViewLog.ViewType.DEEP_VIEW;
    }
}
