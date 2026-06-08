package spring.api.demo.dto.user.response;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserResponse {
    private final String id;
    private final String username;
    private final String email;
    private final String name;
    private final String role;
    private final String phone;
    private final String address;
    private final String gender;
    private final Short birthYear;
    private final Integer point;
    private final BigDecimal balance;
    private final BigDecimal totalSpent;
    private final String membershipLevel;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;
    private final Boolean isActive;
}
