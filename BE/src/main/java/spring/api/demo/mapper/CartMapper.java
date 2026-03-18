package spring.api.demo.mapper;

import org.springframework.stereotype.Component;
import spring.api.demo.dto.cart.response.CartItemResponse;
import spring.api.demo.dto.cart.response.CartResponse;
import spring.api.demo.entity.CartItem;
import spring.api.demo.entity.ProductVariant;

import java.math.BigDecimal;
import java.util.List;

@Component
public class CartMapper {

    public CartResponse toCartResponse(List<CartItem> items) {
        List<CartItemResponse> itemResponses = items.stream()
                .map(this::toCartItemResponse)
                .toList();

        int totalItems = itemResponses.stream()
                .mapToInt(CartItemResponse::getQuantity)
                .sum();

        BigDecimal totalAmount = itemResponses.stream()
                .map(CartItemResponse::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return CartResponse.builder()
                .items(itemResponses)
                .totalItems(totalItems)
                .totalAmount(totalAmount)
                .build();
    }

    public CartItemResponse toCartItemResponse(CartItem cartItem) {
        ProductVariant variant = cartItem.getVariant();
        BigDecimal unitPrice = variant.getSalePrice();
        BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(cartItem.getQuantity()));

        return CartItemResponse.builder()
                .cartItemId(cartItem.getId())
                .variantId(variant.getId())
                .productId(variant.getProduct().getId())
                .productName(variant.getProduct().getName())
                .productBrand(variant.getProduct().getBrand())
                .sku(variant.getSku())
                .size(variant.getSize())
                .color(variant.getColor())
                .unitPrice(unitPrice)
                .quantity(cartItem.getQuantity())
                                .isSelected(Boolean.TRUE.equals(cartItem.getIsSelected()))
                .stockAvailable(variant.getStockQuantity())
                .lineTotal(lineTotal)
                .build();
    }
}
