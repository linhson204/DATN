package spring.api.demo.entity;

import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @Column(nullable = false, length = 255)
    String name;

    @Column(length = 150)
    String brand;

    @ManyToOne(optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    ProductCategory category;

    @ManyToOne
    @JoinColumn(name = "material_id")
    MaterialDictionary material;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_gender", nullable = false, length = 20)
    TargetGender targetGender;

    @Column(columnDefinition = "TEXT")
    String description;

    @Column(name = "original_price", precision = 12, scale = 2, nullable = false)
    BigDecimal originalPrice;

    @Column(name = "sale_price", precision = 12, scale = 2, nullable = false)
    BigDecimal salePrice;

    @Builder.Default
    @Column(name = "total_stock", nullable = false)
    Integer totalStock = 0;

    @Builder.Default
    @OneToMany(mappedBy = "product", cascade = jakarta.persistence.CascadeType.ALL, orphanRemoval = true)
    List<ProductAttribute> attributes = new ArrayList<>();

    @Builder.Default
    @OneToMany(mappedBy = "product", cascade = jakarta.persistence.CascadeType.ALL, orphanRemoval = true)
    List<ProductVariant> variants = new ArrayList<>();

    @Builder.Default
    @Column(nullable = false)
    Boolean status = true;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (status == null) {
            status = true;
        }
        if (totalStock == null) {
            totalStock = 0;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum TargetGender {
        MALE("male"),
        FEMALE("female"),
        UNISEX("unisex");

        private final String value;

        TargetGender(String value) {
            this.value = value;
        }

        @JsonValue
        public String toJson() {
            return value;
        }

        @JsonCreator
        public static TargetGender fromJson(String raw) {
            if (raw == null || raw.isBlank()) {
                return null;
            }

            String normalized = raw.trim().toLowerCase(Locale.ROOT);
            for (TargetGender gender : values()) {
                if (gender.value.equals(normalized)
                        || gender.name().toLowerCase(Locale.ROOT).equals(normalized)) {
                    return gender;
                }
            }

            throw new IllegalArgumentException("Unsupported targetGender: " + raw);
        }
    }
}