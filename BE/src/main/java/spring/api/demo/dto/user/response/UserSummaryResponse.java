package spring.api.demo.dto.user.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserSummaryResponse {
    private String id;
    private String username;
    private String email;
    private String fullName;
    private String role;
    private String membershipLevel;
    private Boolean status;
    private LocalDateTime createdAt;
}
