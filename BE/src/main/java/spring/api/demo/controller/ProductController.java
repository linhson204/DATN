package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.dto.product.request.ProductCreateAndUpdateRequest;
import spring.api.demo.dto.product.response.ProductResponse;
import spring.api.demo.entity.ProductViewLog;
import spring.api.demo.entity.User;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.ProductService;
import spring.api.demo.service.ProductViewLogService;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/v1/products")
public class ProductController {

    private final ProductService productService;
    private final ProductViewLogService productViewLogService;
    private final UserRepository userRepository;

    public ProductController(
            ProductService productService,
            ProductViewLogService productViewLogService,
            UserRepository userRepository
    ) {
        this.productService = productService;
        this.productViewLogService = productViewLogService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<SuccessResource<ProductResponse>> createProduct(@Valid @RequestBody ProductCreateAndUpdateRequest request) {
        ProductResponse response = productService.create(request);
        return ResponseEntity.ok(new SuccessResource<>("Tạo sản phẩm thành công", response));
    }

    @GetMapping
    public ResponseEntity<SuccessResource<PageResponse<ProductResponse>>> getAllProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String categoryCode,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice
    ) {
        PageResponse<ProductResponse> response = productService.getAll(
                page, size, sortBy, sortDir, name, categoryCode, minPrice, maxPrice
        );
        return ResponseEntity.ok(new SuccessResource<>("Lấy danh sách sản phẩm thành công", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SuccessResource<ProductResponse>> getProductById(@PathVariable UUID id) {
        ProductResponse response = productService.getById(id);
        return ResponseEntity.ok(new SuccessResource<>("Lấy chi tiết sản phẩm thành công", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SuccessResource<ProductResponse>> updateProduct(@PathVariable UUID id, @Valid @RequestBody ProductCreateAndUpdateRequest request) {
        ProductResponse response = productService.update(id, request);
        return ResponseEntity.ok(new SuccessResource<>("Cập nhật sản phẩm thành công", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<MessageResource> deleteProduct(@PathVariable UUID id) {
        productService.delete(id);
        return ResponseEntity.ok(new MessageResource("Xóa sản phẩm thành công"));
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<MessageResource> logProductView(
            @PathVariable UUID id,
            @RequestParam(required = false, defaultValue = "DETAIL_VIEW") ProductViewLog.ViewType viewType,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        productViewLogService.logView(user.getId(), id, viewType);
        return ResponseEntity.ok(new MessageResource("Đã ghi nhận lượt xem sản phẩm"));
    }
}