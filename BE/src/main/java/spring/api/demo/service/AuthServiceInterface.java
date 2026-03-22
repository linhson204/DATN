package spring.api.demo.service;

import spring.api.demo.dto.auth.request.LoginRequest;
import spring.api.demo.dto.auth.request.RegisterRequest;
import spring.api.demo.dto.auth.request.VerifyOtpRequest;
import spring.api.demo.dto.auth.response.LoginResponse;
import spring.api.demo.resource.MessageResource;

public interface AuthServiceInterface {
    LoginResponse authenticate(LoginRequest request);
    MessageResource register(RegisterRequest request);
    MessageResource verifyEmail(VerifyOtpRequest request);
    LoginResponse loginOrRegisterOAuth2(String email, String name);
}
