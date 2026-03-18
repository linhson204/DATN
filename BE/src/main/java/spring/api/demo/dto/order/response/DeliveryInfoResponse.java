package spring.api.demo.dto.order.response;

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
public class DeliveryInfoResponse {

    UUID id;
    String recipientName;
    String email;
    String phoneNumber;
    String address;
    String deliveryMethod;
    String deliveryTime;
    String deliveryInstructions;
}
