package spring.api.demo.dto.order.response;

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
public class OrderItemResponse {

    UUID orderItemId;
    UUID variantId;
    UUID productId;
    String productName;
    String imageUrl;
    String sku;
    String size;
    String color;
    BigDecimal unitPrice;
    Integer quantity;
    BigDecimal lineTotal;
}
