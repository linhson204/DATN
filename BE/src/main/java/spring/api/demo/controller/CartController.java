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
import spring.api.demo.dto.cart.request.CartItemQuantityUpdateRequest;
import spring.api.demo.dto.cart.request.CartItemRequest;
import spring.api.demo.dto.cart.response.CartResponse;
import spring.api.demo.resource.MessageResource;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.CartService;

import java.util.UUID;

@RestController
@RequestMapping("/v1/cart")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public ResponseEntity<SuccessResource<CartResponse>> getMyCart() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        CartResponse response = cartService.getMyCart(email);
        return ResponseEntity.ok(new SuccessResource<>("Lấy giỏ hàng thành công", response));
    }

    @PostMapping("/items")
    public ResponseEntity<SuccessResource<CartResponse>> addItem(@Valid @RequestBody CartItemRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        CartResponse response = cartService.addItem(email, request);
        return ResponseEntity.ok(new SuccessResource<>("Thêm sản phẩm vào giỏ hàng thành công", response));
    }

    @PutMapping("/items/{cartItemId}")
    public ResponseEntity<SuccessResource<CartResponse>> updateItemQuantity(
            @PathVariable UUID cartItemId,
            @Valid @RequestBody CartItemQuantityUpdateRequest request
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        CartResponse response = cartService.updateQuantity(email, cartItemId, request.getQuantity());
        return ResponseEntity.ok(new SuccessResource<>("Cập nhật số lượng sản phẩm thành công", response));
    }

    @PutMapping("/items/{cartItemId}/selection")
    public ResponseEntity<SuccessResource<CartResponse>> updateItemSelection(
            @PathVariable UUID cartItemId
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        CartResponse response = cartService.updateSelection(email, cartItemId);
        return ResponseEntity.ok(new SuccessResource<>("Cập nhật trạng thái chọn sản phẩm thành công", response));
    }

    @DeleteMapping("/items/{cartItemId}")
    public ResponseEntity<SuccessResource<CartResponse>> removeItem(@PathVariable UUID cartItemId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        CartResponse response = cartService.removeItem(email, cartItemId);
        return ResponseEntity.ok(new SuccessResource<>("Xóa sản phẩm khỏi giỏ hàng thành công", response));
    }

    @DeleteMapping
    public ResponseEntity<MessageResource> clearCart() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        cartService.clearCart(email);
        return ResponseEntity.ok(new MessageResource("Xóa toàn bộ giỏ hàng thành công"));
    }
}
