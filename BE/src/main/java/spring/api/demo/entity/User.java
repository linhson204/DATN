package spring.api.demo.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import spring.api.demo.entity.converter.MembershipLevelConverter;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonValue;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @Column(nullable = false, unique = true, length = 100)
    String username;

    @Column(name = "password_hash", nullable = false, length = 255)
    String passwordHash;

    @Column(name = "full_name", length = 255)
    String fullName;

    @Column(unique = true, length = 255)
    String email;

    @Column(name = "phone_number", length = 20)
    String phoneNumber;

    @Column(columnDefinition = "TEXT")
    String address;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id")
    Role role;

    /** Giới tính: male | female | other. Dùng cho demographic-based recommendation. */
    @Column(length = 10)
    String gender;

    /** Năm sinh, dùng để tính nhóm tuổi cho AI recommendation. */
    @Column(name = "birth_year")
    Short birthYear;

    @Builder.Default
    @Column(columnDefinition = "BOOLEAN DEFAULT TRUE")
    Boolean status = true;

    @Builder.Default
    @Column(columnDefinition = "INT DEFAULT 0")
    Integer points = 0;

    @Builder.Default
    @Column(precision = 12, scale = 2, columnDefinition = "DECIMAL(12,2) DEFAULT 0")
    BigDecimal balance = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "total_purchase", precision = 14, scale = 2, columnDefinition = "DECIMAL(14,2) DEFAULT 0")
    BigDecimal totalPurchase = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "membership_level", length = 20, columnDefinition = "VARCHAR(20) DEFAULT 'basic'")
    @Convert(converter = MembershipLevelConverter.class)
    MembershipLevel membershipLevel = MembershipLevel.BASIC;

    @Builder.Default
    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    LocalDateTime updatedAt = LocalDateTime.now();

    public enum MembershipLevel {
        BASIC("basic"),
        SILVER("silver"), 
        GOLD("gold");

        private final String value;

        MembershipLevel(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }

        @JsonValue
        public String toJson() {
            return this.value;
        }
    }

}
