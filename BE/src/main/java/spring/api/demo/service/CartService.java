package spring.api.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.cart.request.CartItemRequest;
import spring.api.demo.dto.cart.response.CartResponse;
import spring.api.demo.entity.CartItem;
import spring.api.demo.entity.ProductVariant;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.mapper.CartMapper;
import spring.api.demo.repository.CartItemRepository;
import spring.api.demo.repository.ProductVariantRepository;
import spring.api.demo.repository.UserRepository;

import java.util.List;
import java.util.UUID;

@Service
public class CartService {

    private final CartItemRepository cartItemRepository;
    private final ProductVariantRepository productVariantRepository;
    private final UserRepository userRepository;
    private final CartMapper cartMapper;

    public CartService(
            CartItemRepository cartItemRepository,
            ProductVariantRepository productVariantRepository,
            UserRepository userRepository,
            CartMapper cartMapper
    ) {
        this.cartItemRepository = cartItemRepository;
        this.productVariantRepository = productVariantRepository;
        this.userRepository = userRepository;
        this.cartMapper = cartMapper;
    }

    @Transactional(readOnly = true)
    public CartResponse getMyCart(String email) {
        User user = getUserByEmail(email);
        List<CartItem> items = cartItemRepository.findByUserOrderByCreatedAtDesc(user);
        return cartMapper.toCartResponse(items);
    }

    @Transactional
    public CartResponse addItem(String email, CartItemRequest request) {
        User user = getUserByEmail(email);
        ProductVariant variant = getVariantById(request.getVariantId());

        validateVariantAvailability(variant, request.getQuantity());

        CartItem cartItem = cartItemRepository.findByUserAndVariant(user, variant)
                .orElseGet(() -> CartItem.builder()
                        .user(user)
                        .variant(variant)
                        .quantity(0)
                        .build());

        int newQuantity = cartItem.getQuantity() + request.getQuantity();
        validateStock(variant, newQuantity);
        cartItem.setQuantity(newQuantity);
        cartItemRepository.save(cartItem);

        return getMyCart(email);
    }

    @Transactional
    public CartResponse updateQuantity(String email, UUID cartItemId, Integer quantity) {
        User user = getUserByEmail(email);
        CartItem cartItem = cartItemRepository.findByIdAndUser(cartItemId, user)
                .orElseThrow(() -> new AppException(ErrorCode.CART_ITEM_NOT_FOUND));

        validateVariantAvailability(cartItem.getVariant(), quantity);
        validateStock(cartItem.getVariant(), quantity);

        cartItem.setQuantity(quantity);
        cartItemRepository.save(cartItem);

        return getMyCart(email);
    }

    @Transactional
    public CartResponse updateSelection(String email, UUID cartItemId) {
        User user = getUserByEmail(email);
        CartItem cartItem = cartItemRepository.findByIdAndUser(cartItemId, user)
                .orElseThrow(() -> new AppException(ErrorCode.CART_ITEM_NOT_FOUND));

        cartItem.setIsSelected(!Boolean.TRUE.equals(cartItem.getIsSelected()));
        cartItemRepository.save(cartItem);

        return getMyCart(email);
    }

    @Transactional
    public CartResponse removeItem(String email, UUID cartItemId) {
        User user = getUserByEmail(email);
        CartItem cartItem = cartItemRepository.findByIdAndUser(cartItemId, user)
                .orElseThrow(() -> new AppException(ErrorCode.CART_ITEM_NOT_FOUND));

        cartItemRepository.delete(cartItem);
        return getMyCart(email);
    }

    @Transactional
    public void clearCart(String email) {
        User user = getUserByEmail(email);
        cartItemRepository.deleteByUser(user);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private ProductVariant getVariantById(UUID variantId) {
        return productVariantRepository.findById(variantId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_VARIANT_NOT_FOUND));
    }

    private void validateVariantAvailability(ProductVariant variant, Integer quantity) {
        if (!Boolean.TRUE.equals(variant.getStatus()) || !Boolean.TRUE.equals(variant.getProduct().getStatus())) {
            throw new AppException(ErrorCode.PRODUCT_VARIANT_NOT_FOUND);
        }
        if (quantity == null || quantity <= 0) {
            throw new AppException(ErrorCode.INVALID_QUANTITY);
        }
    }

    private void validateStock(ProductVariant variant, int quantity) {
        if (variant.getStockQuantity() < quantity) {
            throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
        }
    }
}
