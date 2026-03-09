package spring.api.demo.dto.auth.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@Data
@AllArgsConstructor
@RequiredArgsConstructor
public class RefreshTokenResponse {
    private String accessToken;
    private String refreshToken;
}
