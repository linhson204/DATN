package spring.api.demo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.auth.request.EmailReceiveOptRequest;
import spring.api.demo.dto.auth.request.ResetPasswordRequest;
import spring.api.demo.dto.auth.request.VerifyOtpRequest;
import spring.api.demo.entity.OtpValid;
import spring.api.demo.entity.OtpValid.OtpType;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.OtpValidRepository;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.resource.MessageResource;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
public class OtpService {

    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private OtpValidRepository otpRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailForgotPasswordService emailForgotPasswordService;

    @Autowired
    private EmailValidService emailValidService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${otp.expiration-minutes}")
    private int otpExpirationMinutes;

    @Transactional
    public MessageResource sendOtp(EmailReceiveOptRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());

        if (userOpt.isEmpty()) {
            // Trả về thông báo chung để tránh lộ thông tin người dùng
            return new MessageResource("Nếu email tồn tại, mã OTP đã được gửi");
        }

        User user = userOpt.get();
        if (!user.getStatus() && String.valueOf(OtpType.FORGOT_PASSWORD).equals(request.getType())) {
            throw new AppException(ErrorCode.ACCOUNT_NOT_VERIFIED,
                    Map.of("message", "Tài khoản chưa được kích hoạt"));
        }

        // Vô hiệu hóa tất cả OTP cũ của email này
        otpRepository.invalidateAllByEmailAndType(request.getEmail(), request.getType());

        String otpCode = generateOtp();
        OtpValid otp = OtpValid.builder()
                .email(request.getEmail())
                .otpCode(otpCode)
                .expiryDate(LocalDateTime.now().plusMinutes(otpExpirationMinutes))
                .isUsed(false)
                .type(request.getType())
                .build();
        otpRepository.save(otp);

        try {
            if (OtpType.valueOf(request.getType()) == OtpType.FORGOT_PASSWORD) {
                emailForgotPasswordService.sendOtpEmail(request.getEmail(), otpCode);
            } else if (OtpType.valueOf(request.getType()) == OtpType.EMAIL_VERIFICATION) {
                emailValidService.sendOtpEmail(request.getEmail(), otpCode);
            }
        } catch (Exception e) {
            logger.error("Lỗi gửi OTP: {}", e.getMessage());
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR,
                    Map.of("message", "Gửi email thất bại, vui lòng thử lại"));
        }

        return new MessageResource("Mã OTP đã được gửi đến email của bạn");
    }


    /** Xác minh OTP với type tuỳ chỉnh — trả về OTP nếu hợp lệ */
    public Optional<OtpValid> verifyOtp(VerifyOtpRequest request, OtpType otpType) {
        Optional<OtpValid> otpOpt = otpRepository
                .findTopByEmailAndTypeAndIsUsedFalseOrderByCreatedAtDesc(request.getEmail(), otpType.name());
        if (otpOpt.isEmpty()) return Optional.empty();

        OtpValid otp = otpOpt.get();
        if (LocalDateTime.now().isAfter(otp.getExpiryDate())) return Optional.empty();
        if (!otp.getOtpCode().equals(request.getOtpCode())) return Optional.empty();

        return Optional.of(otp);
    }


    @Transactional
    public MessageResource resetPassword(ResetPasswordRequest request) {
        Optional<OtpValid> otpOpt = otpRepository
                .findTopByEmailAndTypeAndIsUsedFalseOrderByCreatedAtDesc(request.getEmail(), OtpType.FORGOT_PASSWORD.name());

        if (otpOpt.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP không hợp lệ hoặc đã hết hạn"));
        }

        OtpValid otp = otpOpt.get();

        if (LocalDateTime.now().isAfter(otp.getExpiryDate())) {
            throw new AppException(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP đã hết hạn"));
        }

        if (!otp.getOtpCode().equals(request.getOtpCode())) {
            throw new AppException(ErrorCode.INVALID_OTP,
                    Map.of("message", "Mã OTP không đúng"));
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.VALIDATION_FAILED,
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


    @Transactional
    public void SendOtpValidEmail(String email, OtpType otpType) {
        otpRepository.invalidateAllByEmailAndType(email, otpType.name());

        String otpCode = generateOtp();
        OtpValid otp = OtpValid.builder()
                .email(email)
                .otpCode(otpCode)
                .expiryDate(LocalDateTime.now().plusMinutes(otpExpirationMinutes))
                .isUsed(false)
                .type(otpType.name())
                .build();
        otpRepository.save(otp);
        emailValidService.sendOtpEmail(email, otpCode);
    }
    
}
