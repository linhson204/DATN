package spring.api.demo.service;

import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import spring.api.demo.dto.auth.request.LoginRequest;
import spring.api.demo.dto.auth.response.LoginResponse;
import spring.api.demo.dto.user.request.UserRequest;
import spring.api.demo.entity.User;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.resource.ErrorResource;
import spring.api.demo.service.impl.UserServiceInterface;

import java.util.HashMap;
import java.util.Map;

@Service
public class UserService implements UserServiceInterface {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserRepository userRepository;

    @Override
    public Object authenticate(LoginRequest request) {
        try {
            User user = userRepository.findByEmail(request.getEmail())
                    .orElseThrow(() -> new BadCredentialsException(ErrorCode.INVALID_CREDENTIALS.getMessage()));

            if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
                throw new BadCredentialsException(ErrorCode.INVALID_CREDENTIALS.getMessage());
            }

            UserRequest userRequest = UserRequest.builder()
                    .id(String.valueOf(user.getId()))
                    .email(user.getEmail())
                    .name(user.getFullName())
                    .role(String.valueOf(user.getRole().getName()))
                    .build();

            String token = jwtService.generateToken(String.valueOf(user.getId()), user.getEmail(), String.valueOf(user.getRole().getName()), user.getFullName());
            String refreshToken = jwtService.generateRefreshToken(String.valueOf(user.getId()), user.getEmail(), String.valueOf(user.getRole().getName()), user.getFullName());

            return new LoginResponse(token, refreshToken, userRequest);

        } catch (BadCredentialsException e) {
            logger.error("Lỗi xác thực người dùng: {}", e.getMessage());
            Map<String, String> errors = new HashMap<>();
            errors.put("message", e.getMessage());
            return new ErrorResource(ErrorCode.INVALID_CREDENTIALS, errors);
        }
    }
}
