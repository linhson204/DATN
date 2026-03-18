package spring.api.demo.dto.cart.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CartItemRequest {

    @NotNull(message = "Variant id khong duoc de trong")
    UUID variantId;

    @NotNull(message = "So luong khong duoc de trong")
    @Min(value = 1, message = "So luong phai lon hon 0")
    Integer quantity;
}
