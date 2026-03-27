package spring.api.demo.dto.product.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import spring.api.demo.dto.material.response.MaterialDictionaryResponse;
import spring.api.demo.entity.Product;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductResponse {
    UUID id;
    String name;
    String brand;
    ProductCategoryResponse category;
    MaterialDictionaryResponse material;
    Product.TargetGender targetGender;
    String description;
    BigDecimal originalPrice;
    BigDecimal salePrice;
    Integer totalStock;
    Boolean status;
    List<ProductAttributeResponse> attributes;
    List<ProductVariantResponse> variants;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}