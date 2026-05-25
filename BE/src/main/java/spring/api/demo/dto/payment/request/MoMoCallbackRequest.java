package spring.api.demo.dto.payment.request;

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
public class MoMoCallbackRequest {

    String partnerCode;
    String orderId;
    String requestId;
    long amount;
    String orderInfo;
    String orderType;
    long transId;
    int resultCode;
    String message;
    String payType;
    long responseTime;
    String extraData;
    String signature;
}
