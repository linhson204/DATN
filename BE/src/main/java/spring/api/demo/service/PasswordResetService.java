package spring.api.demo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.auth.request.ForgotPasswordRequest;
import spring.api.demo.dto.auth.request.ResetPasswordRequest;
import spring.api.demo.dto.auth.request.VerifyOtpRequest;
import spring.api.demo.entity.PasswordResetOtp;
import spring.api.demo.entity.PasswordResetOtp.OtpType;
import spring.api.demo.entity.User;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.PasswordResetOtpRepository;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.resource.ErrorResource;
import spring.api.demo.resource.MessageResource;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
public class PasswordResetService {

    private static final Logger logger = LoggerFactory.getLogger(PasswordResetService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private PasswordResetOtpRepository otpRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${otp.expiration-minutes}")
    private int otpExpirationMinutes;

    @Transactional
    public Object sendOtp(ForgotPasswordRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());
        if (userOpt.isEmpty()) {
            // Trả về thông báo chung để tránh lộ thông tin người dùng
            return new MessageResource("Nếu email tồn tại, mã OTP đã được gửi");
        }

        // Vô hiệu hóa tất cả OTP cũ của email này
        otpRepository.invalidateAllByEmailAndType(request.getEmail(), OtpType.FORGOT_PASSWORD.name());

        String otpCode = generateOtp();
        PasswordResetOtp otp = PasswordResetOtp.builder()
                .email(request.getEmail())
                .otpCode(otpCode)
                .expiryDate(LocalDateTime.now().plusMinutes(otpExpirationMinutes))
                .isUsed(false)
                .type(OtpType.FORGOT_PASSWORD.name())
                .build();
        otpRepository.save(otp);

        try {
            emailService.sendOtpEmail(request.getEmail(), otpCode);
        } catch (Exception e) {
            logger.error("Lỗi gửi OTP: {}", e.getMessage());
            return new ErrorResource(ErrorCode.INTERNAL_SERVER_ERROR,
                    Map.of("message", "Gửi email thất bại, vui lòng thử lại"));
        }

        return new MessageResource("Mã OTP đã được gửi đến email của bạn");
    }

    public Object verifyOtp(VerifyOtpRequest request) {
        Optional<PasswordResetOtp> otpOpt = otpRepository
                .findTopByEmailAndTypeAndIsUsedFalseOrderByCreatedAtDesc(request.getEmail(), OtpType.FORGOT_PASSWORD.name());

        if (otpOpt.isEmpty()) {
            return new ErrorResource(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP không hợp lệ hoặc đã hết hạn"));
        }

        PasswordResetOtp otp = otpOpt.get();

        if (LocalDateTime.now().isAfter(otp.getExpiryDate())) {
            return new ErrorResource(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP đã hết hạn"));
        }

        if (!otp.getOtpCode().equals(request.getOtpCode())) {
            return new ErrorResource(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP không đúng"));
        }

        return new MessageResource("Mã OTP hợp lệ");
    }

    @Transactional
    public Object resetPassword(ResetPasswordRequest request) {
        Optional<PasswordResetOtp> otpOpt = otpRepository
                .findTopByEmailAndTypeAndIsUsedFalseOrderByCreatedAtDesc(request.getEmail(), OtpType.FORGOT_PASSWORD.name());

        if (otpOpt.isEmpty()) {
            return new ErrorResource(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP không hợp lệ hoặc đã hết hạn"));
        }

        PasswordResetOtp otp = otpOpt.get();

        if (LocalDateTime.now().isAfter(otp.getExpiryDate())) {
            return new ErrorResource(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP đã hết hạn"));
        }

        if (!otp.getOtpCode().equals(request.getOtpCode())) {
            return new ErrorResource(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP không đúng"));
        }

        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());
        if (userOpt.isEmpty()) {
            return new ErrorResource(ErrorCode.USER_NOT_FOUND,
                    Map.of("message", "Người dùng không tồn tại"));
        }

        User user = userOpt.get();

        if(passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            return new ErrorResource(ErrorCode.VALIDATION_FAILED,
                    Map.of("message", "Mật khẩu mới không được trùng với mật khẩu cũ"));
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // Đánh dấu OTP đã sử dụng
        otp.setIsUsed(true);
        otpRepository.save(otp);

        logger.info("Đặt lại mật khẩu thành công cho email: {}", request.getEmail());
        return new MessageResource("Đặt lại mật khẩu thành công");
    }

    private String generateOtp() {
        int code = RANDOM.nextInt(900000) + 100000; // 100000 - 999999
        return String.valueOf(code);
    }

    /** Tạo và gửi OTP với type tuỳ chỉnh — dùng chung cho cả quên MK và xác thực email */
    @Transactional
    public void createAndSendOtp(String email, OtpType otpType) {
        otpRepository.invalidateAllByEmailAndType(email, otpType.name());

        String otpCode = generateOtp();
        PasswordResetOtp otp = PasswordResetOtp.builder()
                .email(email)
                .otpCode(otpCode)
                .expiryDate(LocalDateTime.now().plusMinutes(otpExpirationMinutes))
                .isUsed(false)
                .type(otpType.name())
                .build();
        otpRepository.save(otp);
        emailService.sendOtpEmail(email, otpCode);
    }

    /** Xác minh OTP với type tuỳ chỉnh — trả về OTP nếu hợp lệ */
    public Optional<PasswordResetOtp> validateOtp(String email, String otpCode, OtpType otpType) {
        Optional<PasswordResetOtp> otpOpt = otpRepository
                .findTopByEmailAndTypeAndIsUsedFalseOrderByCreatedAtDesc(email, otpType.name());
        if (otpOpt.isEmpty()) return Optional.empty();

        PasswordResetOtp otp = otpOpt.get();
        if (LocalDateTime.now().isAfter(otp.getExpiryDate())) return Optional.empty();
        if (!otp.getOtpCode().equals(otpCode)) return Optional.empty();

        return Optional.of(otp);
    }
    
}
