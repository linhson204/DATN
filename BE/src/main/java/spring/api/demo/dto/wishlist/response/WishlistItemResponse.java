package spring.api.demo.dto.wishlist.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class WishlistItemResponse {

    UUID wishlistItemId;
    UUID productId;
    String productName;
    String productBrand;
    String imageUrl;
    String articleType;
    BigDecimal originalPrice;
    BigDecimal salePrice;
    Boolean status;
    LocalDateTime addedAt;
}
