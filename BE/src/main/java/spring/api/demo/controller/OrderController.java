package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.dto.order.request.OrderCreateRequest;
import spring.api.demo.dto.order.request.OrderStatusUpdateRequest;
import spring.api.demo.dto.order.request.OrderPaymentStatusUpdateRequest;
import spring.api.demo.dto.order.response.OrderResponse;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.OrderService;

import java.util.UUID;

@RestController
@RequestMapping("/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<SuccessResource<OrderResponse>> createOrder(@Valid @RequestBody OrderCreateRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        OrderResponse response = orderService.createOrder(email, request);
        return ResponseEntity.ok(new SuccessResource<>("Tạo đơn hàng thành công", response));
    }

    @GetMapping
    public ResponseEntity<SuccessResource<PageResponse<OrderResponse>>> getMyOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        PageResponse<OrderResponse> response = orderService.getMyOrders(email, page, size);
        return ResponseEntity.ok(new SuccessResource<>("Lấy danh sách đơn hàng thành công", response));
    }

    @GetMapping("/admin")
    public ResponseEntity<SuccessResource<PageResponse<OrderResponse>>> getAllOrdersForAdmin(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String userName
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        PageResponse<OrderResponse> response = orderService.getAllOrdersForAdmin(email, page, size, status, userName);
        return ResponseEntity.ok(new SuccessResource<>("Lấy toàn bộ danh sách đơn hàng thành công", response));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<SuccessResource<OrderResponse>> getMyOrderDetail(@PathVariable UUID orderId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        OrderResponse response = orderService.getMyOrderDetail(email, orderId);
        return ResponseEntity.ok(new SuccessResource<>("Lấy chi tiết đơn hàng thành công", response));
    }

    @PostMapping("/{orderId}/repay")
    public ResponseEntity<SuccessResource<OrderResponse>> repayOrder(@PathVariable UUID orderId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        OrderResponse response = orderService.repayOrder(email, orderId);
        return ResponseEntity.ok(new SuccessResource<>("Tạo lại link thanh toán thành công", response));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<SuccessResource<OrderResponse>> cancelOrder(@PathVariable UUID orderId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        OrderResponse response = orderService.cancelOrder(email, orderId);
        return ResponseEntity.ok(new SuccessResource<>("Hủy đơn hàng thành công", response));
    }

    @PostMapping("/{orderId}/check-payment")
    public ResponseEntity<SuccessResource<OrderResponse>> checkPayment(@PathVariable UUID orderId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        OrderResponse response = orderService.checkPaymentStatus(email, orderId);
        return ResponseEntity.ok(new SuccessResource<>("Kiểm tra trạng thái thanh toán thành công", response));
    }

    @PutMapping("/{orderId}/status")
    public ResponseEntity<SuccessResource<OrderResponse>> updateOrderStatus(
            @PathVariable UUID orderId,
            @Valid @RequestBody OrderStatusUpdateRequest request
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        OrderResponse response = orderService.updateOrderStatus(email, orderId, request);
        return ResponseEntity.ok(new SuccessResource<>("Cập nhật trạng thái đơn hàng thành công", response));
    }

    @PutMapping("/{orderId}/payment-status")
    public ResponseEntity<SuccessResource<OrderResponse>> updatePaymentStatus(
            @PathVariable UUID orderId,
            @Valid @RequestBody OrderPaymentStatusUpdateRequest request
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        OrderResponse response = orderService.updatePaymentStatus(email, orderId, request);
        return ResponseEntity.ok(new SuccessResource<>("Cập nhật trạng thái thanh toán thành công", response));
    }
}
