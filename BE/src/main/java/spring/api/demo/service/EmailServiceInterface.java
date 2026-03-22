package spring.api.demo.service;

public interface EmailServiceInterface {
    void sendOtpEmail(String toEmail, String otpCode);
}
