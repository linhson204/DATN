package spring.api.demo.dto.order.request;

import jakarta.validation.constraints.Email;
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
public class DeliveryInfoRequest {

    @NotBlank(message = "Ten nguoi nhan khong duoc de trong")
    String recipientName;

    @NotBlank(message = "Email khong duoc de trong")
    @Email(message = "Email khong dung dinh dang")
    String email;

    @NotBlank(message = "So dien thoai khong duoc de trong")
    String phoneNumber;

    @NotBlank(message = "Dia chi giao hang khong duoc de trong")
    String address;

    @NotBlank(message = "Phuong thuc giao hang khong duoc de trong")
    String deliveryMethod;

    @NotBlank(message = "Thoi gian giao hang khong duoc de trong")
    String deliveryTime;

    @NotBlank(message = "Huong dan giao hang khong duoc de trong")
    String deliveryInstructions;
}
