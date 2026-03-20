package spring.api.demo.dto.product.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductVariantResponse {
    UUID id;
    String sku;
    String size;
    String color;
    Integer stockQuantity;
    BigDecimal originalPrice;
    BigDecimal salePrice;
    Boolean status;
}
