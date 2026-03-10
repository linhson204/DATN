package spring.api.demo.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "otp_valid")
public class OtpValid {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @Column(nullable = false, length = 255)
    String email;

    @Column(name = "otp_code", nullable = false, length = 6)
    String otpCode;

    @Column(name = "expiry_date", nullable = false)
    LocalDateTime expiryDate;

    @Builder.Default
    @Column(name = "is_used", nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    Boolean isUsed = false;

    @Builder.Default
    @Column(nullable = false, length = 30, columnDefinition = "VARCHAR(30) DEFAULT 'FORGOT_PASSWORD'")
    String type = OtpType.FORGOT_PASSWORD.name();

    @Builder.Default
    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    LocalDateTime createdAt = LocalDateTime.now();

    public enum OtpType {
        FORGOT_PASSWORD,
        EMAIL_VERIFICATION
    }
}
