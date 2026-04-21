package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.wishlist.request.WishlistUpsertRequest;
import spring.api.demo.dto.wishlist.response.WishlistItemResponse;
import spring.api.demo.dto.wishlist.response.WishlistResponse;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.WishlistService;

import java.util.UUID;

@RestController
@RequestMapping("/v1/wishlist")
public class WishlistController {

    private final WishlistService wishlistService;

    public WishlistController(WishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @GetMapping
    public ResponseEntity<SuccessResource<WishlistResponse>> getMyWishlist() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        WishlistResponse response = wishlistService.getMyWishlist(email);
        return ResponseEntity.ok(new SuccessResource<>("Lấy wishlist thành công", response));
    }

    @GetMapping("/items/{wishlistItemId}")
    public ResponseEntity<SuccessResource<WishlistItemResponse>> getWishlistItem(@PathVariable UUID wishlistItemId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        WishlistItemResponse response = wishlistService.getWishlistItem(email, wishlistItemId);
        return ResponseEntity.ok(new SuccessResource<>("Lấy chi tiết wishlist item thành công", response));
    }

    @PostMapping("/items")
    public ResponseEntity<SuccessResource<WishlistResponse>> addItem(@Valid @RequestBody WishlistUpsertRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        WishlistResponse response = wishlistService.addItem(email, request);
        return ResponseEntity.ok(new SuccessResource<>("Thêm sản phẩm vào wishlist thành công", response));
    }


    @DeleteMapping("/items/{wishlistItemId}")
    public ResponseEntity<SuccessResource<WishlistResponse>> removeItem(@PathVariable UUID wishlistItemId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        WishlistResponse response = wishlistService.removeItem(email, wishlistItemId);
        return ResponseEntity.ok(new SuccessResource<>("Xóa sản phẩm khỏi wishlist thành công", response));
    }

    @DeleteMapping
    public ResponseEntity<MessageResource> clearWishlist() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        wishlistService.clearWishlist(email);
        return ResponseEntity.ok(new MessageResource("Xóa toàn bộ wishlist thành công"));
    }
}
