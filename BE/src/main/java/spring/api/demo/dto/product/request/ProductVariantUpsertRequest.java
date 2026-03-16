package spring.api.demo.dto.product.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductVariantUpsertRequest {

    String sku;

    String size;

    String color;

    @NotNull(message = "stockQuantity khong duoc de trong")
    @Min(value = 0, message = "stockQuantity phai >= 0")
    Integer stockQuantity;

    @NotNull(message = "originalPrice cua variant khong duoc de trong")
    @DecimalMin(value = "0.0", inclusive = false, message = "originalPrice cua variant phai > 0")
    BigDecimal originalPrice;

    @NotNull(message = "salePrice cua variant khong duoc de trong")
    @DecimalMin(value = "0.0", inclusive = false, message = "salePrice cua variant phai > 0")
    BigDecimal salePrice;

    Boolean status;

    @jakarta.validation.constraints.AssertTrue(message = "salePrice cua variant khong duoc lon hon originalPrice")
    public boolean isValidVariantPriceRange() {
        if (originalPrice == null || salePrice == null) {
            return true;
        }
        return salePrice.compareTo(originalPrice) <= 0;
    }
}
