package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import spring.api.demo.config.JwtUtil;
import spring.api.demo.dto.auth.request.BlacklistTokenRequest;
import spring.api.demo.dto.auth.request.LoginRequest;
import spring.api.demo.dto.auth.response.LoginResponse;
import spring.api.demo.dto.auth.response.RefreshTokenResponse;
import spring.api.demo.resource.ErrorResource;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.service.BlacklistService;
import spring.api.demo.service.JwtService;
import spring.api.demo.service.impl.UserServiceInterface;

@Validated
@RestController
@RequestMapping("v1/auth")
public class AuthController {

    private final UserServiceInterface userService;

    @Autowired
    private BlacklistService blacklistService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JwtUtil jwtUtil;

    public AuthController(UserServiceInterface userService) {
        this.userService = userService;
    }

    @PostMapping("login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        Object result = userService.authenticate(request);
        if (result instanceof LoginResponse loginResponse) {
            return ResponseEntity.ok(loginResponse);
        }
        if (result instanceof ErrorResource errorResource) {
            return ResponseEntity.unprocessableEntity().body(errorResource);
        }
        return ResponseEntity.status(500).body("Network Error");
    }

    @GetMapping("logout")
    public ResponseEntity<?> logout(@RequestHeader("Authorization") String bearerToken) {
        try {
            String token = bearerToken.substring(7);
            BlacklistTokenRequest blacklistTokenRequest = new BlacklistTokenRequest();
            blacklistTokenRequest.setToken(token);
            MessageResource result = (MessageResource) blacklistService.create(blacklistTokenRequest);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResource("Đăng xuất thất bại: " + e.getMessage()));
        }
    }

    @PostMapping("refresh")
    public ResponseEntity<?> refreshToken(@RequestHeader("Authorization") String bearerToken) {
        if (bearerToken == null || !bearerToken.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new MessageResource("Authorization header không hợp lệ"));
        }

        String refreshToken = bearerToken.substring(7);
        if (!jwtService.isTokenFormatValid(refreshToken) || !jwtService.isSignatureValid(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResource("Refresh token sai định dạng hoặc chữ ký"));
        }

        if (!jwtService.isRefreshToken(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResource("Refresh token không hợp lệ"));
        }

        String userId = jwtUtil.getUserIdFromJwt(refreshToken);
        String email = jwtUtil.getEmailFromJwt(refreshToken);
        String role = jwtUtil.getRoleFromJwt(refreshToken);
        String username = jwtUtil.getUsernameFromJwt(refreshToken);

        String newAccessToken = jwtService.generateToken(userId, email, role, username);
        String newRefreshToken = jwtService.generateRefreshToken(userId, email, role, username);
        return ResponseEntity.ok(new RefreshTokenResponse(newAccessToken, newRefreshToken));
    }
}
