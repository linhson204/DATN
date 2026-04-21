package spring.api.demo.mapper;

import org.springframework.stereotype.Component;
import spring.api.demo.dto.wishlist.response.WishlistItemResponse;
import spring.api.demo.dto.wishlist.response.WishlistResponse;
import spring.api.demo.entity.Product;
import spring.api.demo.entity.Wishlist;

import java.util.List;

@Component
public class WishlistMapper {

    public WishlistResponse toWishlistResponse(List<Wishlist> items) {
        List<WishlistItemResponse> itemResponses = items.stream()
                .map(this::toWishlistItemResponse)
                .toList();

        return WishlistResponse.builder()
                .items(itemResponses)
                .totalItems(itemResponses.size())
                .build();
    }

    public WishlistItemResponse toWishlistItemResponse(Wishlist wishlist) {
        Product product = wishlist.getProduct();

        return WishlistItemResponse.builder()
                .wishlistItemId(wishlist.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productBrand(product.getBrand())
                .imageUrl(product.getImageUrl())
                .articleType(product.getCategory() != null ? product.getCategory().getArticleType() : null)
                .originalPrice(product.getOriginalPrice())
                .salePrice(product.getSalePrice())
                .status(Boolean.TRUE.equals(product.getStatus()))
                .addedAt(wishlist.getCreatedAt())
                .build();
    }
}
