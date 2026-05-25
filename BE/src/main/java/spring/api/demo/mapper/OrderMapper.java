package spring.api.demo.mapper;

import org.springframework.stereotype.Component;
import spring.api.demo.dto.order.request.DeliveryInfoRequest;
import spring.api.demo.dto.order.response.DeliveryInfoResponse;
import spring.api.demo.dto.order.response.OrderItemResponse;
import spring.api.demo.dto.order.response.OrderResponse;
import spring.api.demo.entity.CartItem;
import spring.api.demo.entity.DeliveryInfo;
import spring.api.demo.entity.Order;
import spring.api.demo.entity.OrderItem;
import spring.api.demo.entity.ProductVariant;

import java.math.BigDecimal;
import java.util.List;

@Component
public class OrderMapper {

    public DeliveryInfo toDeliveryInfo(DeliveryInfoRequest request) {
        return DeliveryInfo.builder()
                .recipientName(request.getRecipientName())
                .email(request.getEmail())
                .phoneNumber(request.getPhoneNumber())
                .address(request.getAddress())
                .deliveryMethod(request.getDeliveryMethod())
                .deliveryTime(request.getDeliveryTime())
                .deliveryInstructions(request.getDeliveryInstructions())
                .build();
    }

    public List<OrderResponse> toOrderResponses(List<Order> orders) {
        return orders.stream().map(this::toOrderResponse).toList();
    }

    public OrderResponse toOrderResponse(Order order) {
        return OrderResponse.builder()
                .id(order.getId())
                .userId(order.getUser().getId())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .paymentAppTransId(order.getPaymentAppTransId())
                .paymentTransactionId(order.getPaymentTransactionId())
                .shippingFee(order.getShippingFee())
                .totalAmount(order.getTotalAmount())
                .createdAt(order.getCreatedAt())
                .deliveryInfo(toDeliveryInfoResponse(order.getDeliveryInfo()))
                .items(order.getOrderItems() == null ? List.of() : order.getOrderItems().stream().map(this::toOrderItemResponse).toList())
                .build();
    }

    public OrderItem toOrderItem(CartItem cartItem, Order order) {
        ProductVariant variant = cartItem.getVariant();
        BigDecimal unitPrice = variant.getSalePrice();
        BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(cartItem.getQuantity()));


        return OrderItem.builder()
                .order(order)
                .variant(variant)
                .productName(variant.getProduct().getName())
                .imageUrl(variant.getProduct().getImageUrl())
                .sku(variant.getSku())
                .size(variant.getSize())
                .color(variant.getColor())
                .unitPrice(unitPrice)
                .quantity(cartItem.getQuantity())
                .lineTotal(lineTotal)
                .build();
    }

    private OrderItemResponse toOrderItemResponse(OrderItem orderItem) {
        return OrderItemResponse.builder()
                .orderItemId(orderItem.getId())
                .variantId(orderItem.getVariant().getId())
                .productId(orderItem.getVariant().getProduct().getId())
                .productName(orderItem.getProductName())
                .imageUrl(orderItem.getImageUrl())
                .sku(orderItem.getSku())
                .size(orderItem.getSize())
                .color(orderItem.getColor())
                .unitPrice(orderItem.getUnitPrice())
                .quantity(orderItem.getQuantity())
                .lineTotal(orderItem.getLineTotal())
                .build();
    }


    private DeliveryInfoResponse toDeliveryInfoResponse(DeliveryInfo deliveryInfo) {
        return DeliveryInfoResponse.builder()
                .id(deliveryInfo.getId())
                .recipientName(deliveryInfo.getRecipientName())
                .email(deliveryInfo.getEmail())
                .phoneNumber(deliveryInfo.getPhoneNumber())
                .address(deliveryInfo.getAddress())
                .deliveryMethod(deliveryInfo.getDeliveryMethod())
                .deliveryTime(deliveryInfo.getDeliveryTime())
                .deliveryInstructions(deliveryInfo.getDeliveryInstructions())
                .build();
    }
}
