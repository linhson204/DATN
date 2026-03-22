package spring.api.demo.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.ProductCategoryService;

@RestController
@RequestMapping("/v1/product-categories")
public class ProductCategoryController {

    private final ProductCategoryService productCategoryService;

    public ProductCategoryController(ProductCategoryService productCategoryService) {
        this.productCategoryService = productCategoryService;
    }

    @GetMapping
    public ResponseEntity<?> getCategories() {
        return ResponseEntity.ok(new SuccessResource<>("Lấy danh sách danh mục thành công", productCategoryService.getAll()));
    }
    
}
