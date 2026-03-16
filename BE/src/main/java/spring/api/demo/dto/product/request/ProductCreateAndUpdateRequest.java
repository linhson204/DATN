package spring.api.demo.dto.product.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import spring.api.demo.entity.Product;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductCreateAndUpdateRequest {

    @NotBlank(message = "Ten san pham khong duoc de trong")
    String name;

    String brand;

    @NotBlank(message = "Category code khong duoc de trong")
    String categoryCode;

    @NotNull(message = "Target gender khong duoc de trong")
    Product.TargetGender targetGender;

    String description;

    @NotNull(message = "Gia goc khong duoc de trong")
    @DecimalMin(value = "0.0", inclusive = false, message = "Gia goc phai lon hon 0")
    BigDecimal originalPrice;

    @NotNull(message = "Gia sau giam khong duoc de trong")
    @DecimalMin(value = "0.0", inclusive = false, message = "Gia sau giam phai lon hon 0")
    BigDecimal salePrice;

    Boolean status;

    @NotNull(message = "Attributes khong duoc de null")
    @NotEmpty(message = "Attributes phai co it nhat 1 thuoc tinh")
    @Valid
    List<ProductAttributeUpsertRequest> attributes;

    @NotNull(message = "Variants khong duoc de null")
    @NotEmpty(message = "Variants phai co it nhat 1 bien the")
    @Valid
    List<ProductVariantUpsertRequest> variants;

    @jakarta.validation.constraints.AssertTrue(message = "Gia sau giam khong duoc lon hon gia goc")
    public boolean isValidPriceRange() {
        if (originalPrice == null || salePrice == null) {
            return true;
        }
        return salePrice.compareTo(originalPrice) <= 0;
    }
}