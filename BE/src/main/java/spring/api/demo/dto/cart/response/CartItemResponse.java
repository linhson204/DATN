package spring.api.demo.dto.cart.response;

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
public class  CartItemResponse {

    UUID cartItemId;
    UUID variantId;
    UUID productId;
    String productName;
    String productBrand;
    String sku;
    String size;
    String color;
    BigDecimal unitPrice;
    Integer quantity;
    Boolean isSelected;
    Integer stockAvailable;
    BigDecimal lineTotal;
}
