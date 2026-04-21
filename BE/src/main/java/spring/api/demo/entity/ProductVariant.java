package spring.api.demo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "product_variants")
public class ProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    Product product;

    @Column(length = 64)
    String sku;

    @Column(length = 30)
    String size;

    @Column(length = 50)
    String color;

    @Column(name = "image_url", length = 255)
    String imageUrl;

    @Column(name = "stock_quantity", nullable = false)
    Integer stockQuantity;

    @Column(name = "original_price", precision = 12, scale = 2, nullable = false)
    BigDecimal originalPrice;

    @Column(name = "sale_price", precision = 12, scale = 2, nullable = false)
    BigDecimal salePrice;

    @Builder.Default
    @Column(nullable = false)
    Boolean status = true;

    @PrePersist
    public void prePersist() {
        if (stockQuantity == null) {
            stockQuantity = 0;
        }
        if (status == null) {
            status = true;
        }
    }
}
