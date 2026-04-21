package spring.api.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.wishlist.request.WishlistUpsertRequest;
import spring.api.demo.dto.wishlist.response.WishlistItemResponse;
import spring.api.demo.dto.wishlist.response.WishlistResponse;
import spring.api.demo.entity.Product;
import spring.api.demo.entity.User;
import spring.api.demo.entity.Wishlist;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.mapper.WishlistMapper;
import spring.api.demo.repository.ProductRepository;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.repository.WishlistRepository;

import java.util.List;
import java.util.UUID;

@Service
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final WishlistMapper wishlistMapper;

    public WishlistService(
            WishlistRepository wishlistRepository,
            UserRepository userRepository,
            ProductRepository productRepository,
            WishlistMapper wishlistMapper
    ) {
        this.wishlistRepository = wishlistRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.wishlistMapper = wishlistMapper;
    }

    @Transactional(readOnly = true)
    public WishlistResponse getMyWishlist(String email) {
        User user = getUserByEmail(email);
        List<Wishlist> items = wishlistRepository.findByUserOrderByCreatedAtDesc(user);
        return wishlistMapper.toWishlistResponse(items);
    }

    @Transactional(readOnly = true)
    public WishlistItemResponse getWishlistItem(String email, UUID wishlistItemId) {
        User user = getUserByEmail(email);
        Wishlist wishlistItem = wishlistRepository.findByIdAndUser(wishlistItemId, user)
                .orElseThrow(() -> new AppException(ErrorCode.WISHLIST_ITEM_NOT_FOUND));
        return wishlistMapper.toWishlistItemResponse(wishlistItem);
    }

    @Transactional
    public WishlistResponse addItem(String email, WishlistUpsertRequest request) {
        User user = getUserByEmail(email);
        Product product = getProductById(request.getProductId());

        if (wishlistRepository.findByUserAndProduct(user, product).isPresent()) {
            throw new AppException(ErrorCode.WISHLIST_ITEM_ALREADY_EXISTS);
        }

        Wishlist wishlistItem = Wishlist.builder()
                .user(user)
                .product(product)
                .build();

        wishlistRepository.save(wishlistItem);
        return getMyWishlist(email);
    }


    @Transactional
    public WishlistResponse removeItem(String email, UUID wishlistItemId) {
        User user = getUserByEmail(email);
        Wishlist wishlistItem = wishlistRepository.findByIdAndUser(wishlistItemId, user)
                .orElseThrow(() -> new AppException(ErrorCode.WISHLIST_ITEM_NOT_FOUND));

        wishlistRepository.delete(wishlistItem);
        return getMyWishlist(email);
    }

    @Transactional
    public void clearWishlist(String email) {
        User user = getUserByEmail(email);
        wishlistRepository.deleteByUser(user);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private Product getProductById(UUID productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
    }
}
