package spring.api.demo.mapper;

import org.springframework.stereotype.Component;
import spring.api.demo.dto.product.response.ProductCategoryResponse;
import spring.api.demo.entity.ProductCategory;

@Component
public class ProductCategoryMapper {

    public ProductCategoryResponse toResponse(ProductCategory category) {
        return ProductCategoryResponse.builder()
                .id(category.getId())
                .articleType(category.getArticleType())
                .subCategory(category.getSubCategory())
                .masterCategory(category.getMasterCategory())
                .build();
    }
}
