package spring.api.demo.dto.order.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OrderResponse {

    UUID id;
    UUID userId;
    String status;
    String paymentMethod;
    String paymentStatus;
    String paymentAppTransId;
    String paymentTransactionId;
    String paymentUrl;
    BigDecimal shippingFee;
    BigDecimal totalAmount;
    LocalDateTime createdAt;
    DeliveryInfoResponse deliveryInfo;
    List<OrderItemResponse> items;
}
