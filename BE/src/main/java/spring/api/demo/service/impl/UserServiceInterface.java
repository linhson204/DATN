package spring.api.demo.service.impl;

import spring.api.demo.dto.auth.request.LoginRequest;
import spring.api.demo.dto.auth.request.RegisterRequest;
import spring.api.demo.dto.auth.request.VerifyOtpRequest;

public interface UserServiceInterface {
    Object authenticate(LoginRequest request);
    Object register(RegisterRequest request);
    Object verifyEmail(VerifyOtpRequest request);
}
