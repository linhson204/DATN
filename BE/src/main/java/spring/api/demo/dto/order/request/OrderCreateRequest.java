package spring.api.demo.dto.order.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OrderCreateRequest {

    String status;
    String paymentMethod;

    @NotNull(message = "Phi van chuyen khong duoc de trong")
    @PositiveOrZero(message = "Phi van chuyen phai lon hon hoac bang 0")
    Float shippingFee;

    @Valid
    @NotNull(message = "Thong tin giao hang khong duoc de trong")
    DeliveryInfoRequest deliveryInfo;
}
