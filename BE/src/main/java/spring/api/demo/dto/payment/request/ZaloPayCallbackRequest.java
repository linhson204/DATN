package spring.api.demo.dto.payment.request;

import jakarta.validation.constraints.NotBlank;
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
public class ZaloPayCallbackRequest {

    @NotBlank(message = "Du lieu callback khong duoc de trong")
    String data;

    @NotBlank(message = "Chu ky callback khong duoc de trong")
    String mac;
}
