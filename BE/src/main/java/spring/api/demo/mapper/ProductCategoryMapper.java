package spring.api.demo.mapper;

import org.springframework.stereotype.Component;
import spring.api.demo.dto.product.response.ProductCategoryResponse;
import spring.api.demo.entity.ProductCategory;

@Component
public class ProductCategoryMapper {

    public ProductCategoryResponse toResponse(ProductCategory category) {
        return ProductCategoryResponse.builder()
                .id(category.getId())
                .code(category.getCode())
                .name(category.getName())
                .build();
    }
}
