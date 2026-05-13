package spring.api.demo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @ManyToOne(optional = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JoinColumn(name = "order_id", nullable = false)
    Order order;

    @ManyToOne(optional = false)
    @JoinColumn(name = "variant_id", nullable = false)
    ProductVariant variant;

    /** FK trực tiếp tới Product — dùng cho AI recommendation (tránh JOIN qua product_variants) */
    @ManyToOne
    @JoinColumn(name = "product_id")
    Product product;

    @Column(name = "product_name", nullable = false, length = 255)
    String productName;

    @Column(name = "image_url", length = 255)
    String imageUrl;

    @Column(name = "sku", length = 64)
    String sku;

    @Column(name = "size", length = 30)
    String size;

    @Column(name = "color", length = 50)
    String color;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    BigDecimal unitPrice;

    @Column(name = "quantity", nullable = false)
    Integer quantity;

    @Column(name = "line_total", nullable = false, precision = 12, scale = 2)
    BigDecimal lineTotal;
}
