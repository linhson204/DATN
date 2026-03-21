package spring.api.demo.dto.shipping.request;

import lombok.*;
import lombok.experimental.FieldDefaults;
import jakarta.validation.constraints.NotNull;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShippingFeeRequest {

    @NotNull(message = "Địa chỉ không được để trống")
    String destination;
}
