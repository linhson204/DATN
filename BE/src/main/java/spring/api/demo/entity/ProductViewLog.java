package spring.api.demo.entity;

import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "product_view_log")
public class ProductViewLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    Product product;

    @Enumerated(EnumType.STRING)
    @Column(name = "view_type", nullable = false, length = 20)
    @Builder.Default
    ViewType viewType = ViewType.DETAIL_VIEW;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (viewType == null) {
            viewType = ViewType.DETAIL_VIEW;
        }
    }

    public enum ViewType {
        DETAIL_VIEW("detail_view"),
        QUICK_VIEW("quick_view"),
        SEARCH_CLICK("search_click");

        private final String value;

        ViewType(String value) {
            this.value = value;
        }

        @JsonValue
        public String toJson() {
            return value;
        }
    }
}
