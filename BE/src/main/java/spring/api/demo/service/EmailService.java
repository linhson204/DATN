package spring.api.demo.service;

public interface EmailService {
    void sendOtpEmail(String toEmail, String otpCode);
}
