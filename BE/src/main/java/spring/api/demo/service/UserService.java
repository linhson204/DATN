package spring.api.demo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.auth.request.LoginRequest;
import spring.api.demo.dto.auth.request.RegisterRequest;
import spring.api.demo.dto.auth.request.VerifyOtpRequest;
import spring.api.demo.dto.auth.response.LoginResponse;
import spring.api.demo.dto.user.request.UserRequest;
import spring.api.demo.entity.OtpValid;
import spring.api.demo.entity.OtpValid.OtpType;
import spring.api.demo.entity.Role;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.OtpValidRepository;
import spring.api.demo.repository.RoleRepository;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.service.impl.UserServiceInterface;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService implements UserServiceInterface {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private OtpService otpService;

    @Autowired
    private OtpValidRepository otpRepository;

    @Override
    public LoginResponse authenticate(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        if (!Boolean.TRUE.equals(user.getStatus())) {
            throw new AppException(ErrorCode.ACCOUNT_NOT_VERIFIED,
                    Map.of("message", "Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư."));
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
    }

    @Override
    @Transactional
    public MessageResource register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        Role customerRole = roleRepository.findByName("customer")
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .role(customerRole)
                .status(false) // chưa xác thực email
                .build();
        userRepository.save(user);

        try {
            otpService.SendOtpValidEmail(request.getEmail(), OtpType.EMAIL_VERIFICATION);
        } catch (Exception e) {
            logger.error("Lỗi gửi OTP xác thực email: {}", e.getMessage());
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR,
                    Map.of("message", "Tạo tài khoản thành công nhưng gửi email thất bại. Vui lòng yêu cầu gửi lại OTP."));
        }

        return new MessageResource("Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP xác thực.");
    }

    @Override
    @Transactional
    public MessageResource verifyEmail(VerifyOtpRequest request) {
        Optional<OtpValid> otpOpt = otpService.verifyOtp(request, OtpType.EMAIL_VERIFICATION);

        if (otpOpt.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP không đúng hoặc đã hết hạn"));
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.setStatus(true);
        userRepository.save(user);

        // Đánh dấu OTP đã sử dụng
        OtpValid otp = otpOpt.get();
        otp.setIsUsed(true);
        otpRepository.save(otp);

        logger.info("Xác thực email thành công: {}", request.getEmail());
        return new MessageResource("Xác thực email thành công! Bạn có thể đăng nhập.");
    }

    /** Gọi từ OAuth2AuthenticationSuccessHandler sau khi Spring xác thực Google thành công */
    @Transactional
    public LoginResponse  loginOrRegisterOAuth2(String email, String name) {
        return buildLoginResponse(email, name);
    }

    private LoginResponse buildLoginResponse(String email, String name) {
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            Role customerRole = roleRepository.findByName("customer")
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

            // Tạo username duy nhất từ email prefix
            String baseUsername = email.split("@")[0];
            String username = baseUsername;
            int suffix = 1;
            while (userRepository.existsByUsername(username)) {
                username = baseUsername + suffix++;
            }

            User newUser = User.builder()
                    .username(username)
                    .email(email)
                    .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .fullName(name != null ? name : username)
                    .role(customerRole)
                    .status(true) // Google đã xác thực email
                    .build();

            logger.info("Tạo tài khoản SSO mới cho email: {}", email);
            return userRepository.save(newUser);
        });

        UserRequest userRequest = UserRequest.builder()
                .id(String.valueOf(user.getId()))
                .email(user.getEmail())
                .name(user.getFullName())
                .role(String.valueOf(user.getRole().getName()))
                .build();

        String token = jwtService.generateToken(
                String.valueOf(user.getId()), user.getEmail(),
                String.valueOf(user.getRole().getName()), user.getFullName());
        String refreshToken = jwtService.generateRefreshToken(
                String.valueOf(user.getId()), user.getEmail(),
                String.valueOf(user.getRole().getName()), user.getFullName());

        return new LoginResponse(token, refreshToken, userRequest);
    }
}
