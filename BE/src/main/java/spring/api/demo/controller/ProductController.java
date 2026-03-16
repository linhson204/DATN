package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
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
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.resource.ErrorResource;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.ProductService;

import java.math.BigDecimal;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
@RequestMapping("v1/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @PostMapping
    public ResponseEntity<?> createProduct(@Valid @RequestBody ProductCreateAndUpdateRequest request) {
        try {
            ProductResponse response = productService.create(request);
            return ResponseEntity.ok(new SuccessResource<>("Tao san pham thanh cong", response));
        } catch (NoSuchElementException ex) {
            return buildNoSuchElementResponse(ex, Map.of("categoryCode", request.getCategoryCode()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getAllProducts(
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
                page,
                size,
                sortBy,
                sortDir,
                name,
                categoryCode,
                minPrice,
                maxPrice
        );
        return ResponseEntity.ok(new SuccessResource<>("Lay danh sach san pham thanh cong", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getProductById(@PathVariable UUID id) {
        try {
            ProductResponse response = productService.getById(id);
            return ResponseEntity.ok(new SuccessResource<>("Lay chi tiet san pham thanh cong", response));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.status(ErrorCode.PRODUCT_NOT_FOUND.getHttpStatus())
                    .body(new ErrorResource(ErrorCode.PRODUCT_NOT_FOUND, Map.of("productId", id.toString())));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable UUID id, @Valid @RequestBody ProductCreateAndUpdateRequest request) {
        try {
            ProductResponse response = productService.update(id, request);
            return ResponseEntity.ok(new SuccessResource<>("Cap nhat san pham thanh cong", response));
        } catch (NoSuchElementException ex) {
            if ("CATEGORY_NOT_FOUND".equals(ex.getMessage())) {
                return buildNoSuchElementResponse(ex, Map.of("categoryCode", request.getCategoryCode()));
            }
            return buildNoSuchElementResponse(ex, Map.of("productId", id.toString()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable UUID id) {
        try {
            productService.delete(id);
            return ResponseEntity.ok(new MessageResource("Xoa san pham thanh cong"));
        } catch (NoSuchElementException ex) {
            return buildNoSuchElementResponse(ex, Map.of("productId", id.toString()));
        }
    }

    private ResponseEntity<ErrorResource> buildNoSuchElementResponse(NoSuchElementException ex, Map<String, String> details) {
        if ("CATEGORY_NOT_FOUND".equals(ex.getMessage())) {
            return ResponseEntity.status(ErrorCode.CATEGORY_NOT_FOUND.getHttpStatus())
                    .body(new ErrorResource(ErrorCode.CATEGORY_NOT_FOUND, details));
        }
        return ResponseEntity.status(ErrorCode.PRODUCT_NOT_FOUND.getHttpStatus())
                .body(new ErrorResource(ErrorCode.PRODUCT_NOT_FOUND, details));
    }
}