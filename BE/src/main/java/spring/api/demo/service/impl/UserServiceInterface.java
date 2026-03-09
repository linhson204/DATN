package spring.api.demo.service.impl;

import spring.api.demo.dto.auth.request.LoginRequest;

public interface UserServiceInterface {
    Object authenticate(LoginRequest request);
}
