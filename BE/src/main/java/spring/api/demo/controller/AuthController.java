package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import spring.api.demo.dto.auth.request.BlacklistTokenRequest;
import spring.api.demo.dto.auth.request.EmailReceiveOptRequest;
import spring.api.demo.dto.auth.request.LoginRequest;
import spring.api.demo.dto.auth.request.RegisterRequest;
import spring.api.demo.dto.auth.request.ResetPasswordRequest;
import spring.api.demo.dto.auth.request.VerifyOtpRequest;
import spring.api.demo.dto.auth.response.LoginResponse;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.entity.OtpValid;
import spring.api.demo.entity.OtpValid.OtpType;
import spring.api.demo.service.AuthServiceInterface;
import spring.api.demo.service.BlacklistService;
import spring.api.demo.service.JwtService;
import spring.api.demo.service.OtpService;
import spring.api.demo.dto.auth.response.RefreshTokenResponse;
import lombok.RequiredArgsConstructor;
import java.util.Optional;

@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthServiceInterface authService;
    private final BlacklistService blacklistService;
    private final JwtService jwtService;
    private final OtpService otpService;

    @PostMapping("login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse loginResponse = authService.authenticate(request);
        return ResponseEntity.ok(loginResponse);
    }

    @GetMapping("logout")
    public ResponseEntity<MessageResource> logout(@RequestHeader("Authorization") String bearerToken) {
        String token = bearerToken.substring(7);
        BlacklistTokenRequest blacklistTokenRequest = new BlacklistTokenRequest();
        blacklistTokenRequest.setToken(token);
        MessageResource result = blacklistService.create(blacklistTokenRequest);
        return ResponseEntity.ok(result);
    }

    @PostMapping("refresh")
    public ResponseEntity<?> refreshToken(@RequestHeader("Authorization") String bearerToken) {
        if (bearerToken == null || !bearerToken.startsWith("Bearer ")) {
            throw new AppException(ErrorCode.TOKEN_INVALID);
        }

        String refreshToken = bearerToken.substring(7);
        if (!jwtService.isTokenFormatValid(refreshToken) || !jwtService.isSignatureValid(refreshToken)) {
            throw new AppException(ErrorCode.TOKEN_INVALID);
        }

        if (!jwtService.isRefreshToken(refreshToken)) {
            throw new AppException(ErrorCode.TOKEN_INVALID);
        }

        String userId = jwtService.getUserIdFromJwt(refreshToken);
        String email = jwtService.getEmailFromJwt(refreshToken);
        String role = jwtService.getRoleFromJwt(refreshToken);
        String username = jwtService.getUsernameFromJwt(refreshToken);

        String newAccessToken = jwtService.generateToken(userId, email, role, username);
        String newRefreshToken = jwtService.generateRefreshToken(userId, email, role, username);
        return ResponseEntity.ok(new RefreshTokenResponse(newAccessToken, newRefreshToken));
    }

    @PostMapping("send-otp")
    public ResponseEntity<MessageResource> sendOtp(@Valid @RequestBody EmailReceiveOptRequest request) {
        MessageResource result = otpService.sendOtp(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("verify-otp-forgot-password")
    public ResponseEntity<MessageResource> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        Optional<OtpValid> result = otpService.verifyOtp(request, OtpType.FORGOT_PASSWORD);

        if (result.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_OTP);
        }

        return ResponseEntity.ok(new MessageResource("Mã OTP hợp lệ"));
    }

    @PostMapping("reset-password")
    public ResponseEntity<MessageResource> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        MessageResource result = otpService.resetPassword(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("register")
    public ResponseEntity<MessageResource> register(@Valid @RequestBody RegisterRequest request) {
        MessageResource result = authService.register(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("verify-email")
    public ResponseEntity<MessageResource> verifyEmail(@Valid @RequestBody VerifyOtpRequest request) {
        MessageResource result = authService.verifyEmail(request);
        return ResponseEntity.ok(result);
    }

}
