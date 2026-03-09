package spring.api.demo.dto.auth.response;

import spring.api.demo.dto.user.request.UserRequest;

public class LoginResponse {
    private final String token;
    private final String refreshToken;
    private final UserRequest user;

    public LoginResponse(String token, String refreshToken, UserRequest user) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public UserRequest getUser() {
        return user;
    }
}
