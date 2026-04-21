package spring.api.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.entity.CartItem;
import spring.api.demo.dto.order.request.OrderCreateRequest;
import spring.api.demo.dto.order.request.OrderStatusUpdateRequest;
import spring.api.demo.dto.order.response.OrderResponse;
import spring.api.demo.entity.DeliveryInfo;
import spring.api.demo.entity.Order;
import spring.api.demo.entity.OrderItem;
import spring.api.demo.entity.ProductVariant;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.mapper.OrderMapper;
import spring.api.demo.repository.CartItemRepository;
import spring.api.demo.repository.DeliveryInfoRepository;
import spring.api.demo.repository.OrderItemRepository;
import spring.api.demo.repository.OrderRepository;
import spring.api.demo.repository.ProductVariantRepository;
import spring.api.demo.repository.UserRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class OrderService {

    private static final Set<String> VALID_ORDER_STATUS = Set.of(
            "PENDING",
            "CONFIRMED",
            "SHIPPING",
            "DELIVERED",
            "CANCELLED"
    );

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductVariantRepository productVariantRepository;
    private final DeliveryInfoRepository deliveryInfoRepository;
    private final UserRepository userRepository;
    private final OrderMapper orderMapper;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            CartItemRepository cartItemRepository,
            ProductVariantRepository productVariantRepository,
            DeliveryInfoRepository deliveryInfoRepository,
            UserRepository userRepository,
            OrderMapper orderMapper
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.cartItemRepository = cartItemRepository;
        this.productVariantRepository = productVariantRepository;
        this.deliveryInfoRepository = deliveryInfoRepository;
        this.userRepository = userRepository;
        this.orderMapper = orderMapper;
    }

    @Transactional
    public OrderResponse createOrder(String email, OrderCreateRequest request) {
        User user = getUserByEmail(email);
        validateShippingFee(request.getShippingFee());

        List<CartItem> allCartItems = cartItemRepository.findByUserOrderByCreatedAtDesc(user);
        if (allCartItems.isEmpty()) {
            throw new AppException(ErrorCode.CART_EMPTY);
        }

        List<CartItem> cartItems = cartItemRepository.findByUserAndIsSelectedTrueOrderByCreatedAtDesc(user);
        if (cartItems.isEmpty()) {
            throw new AppException(ErrorCode.CART_NO_SELECTED_ITEMS);
        }

        validateCartStock(cartItems);

        BigDecimal shippingFee = BigDecimal.valueOf(request.getShippingFee());
        BigDecimal subtotalAmount = calculateSubtotal(cartItems);
        BigDecimal totalAmount = subtotalAmount.add(shippingFee);

        DeliveryInfo deliveryInfo = deliveryInfoRepository.save(
            orderMapper.toDeliveryInfo(request.getDeliveryInfo())
        );

        Order order = Order.builder()
                .user(user)
                .deliveryInfo(deliveryInfo)
                .status(resolveStatus(request.getStatus()))
                .shippingFee(shippingFee)
                .totalAmount(totalAmount)
                .build();

        Order savedOrder = orderRepository.save(order);

        List<OrderItem> orderItems = cartItems.stream()
                .map(cartItem -> orderMapper.toOrderItem(cartItem, savedOrder))
                .toList();
        orderItemRepository.saveAll(orderItems);

        savedOrder.setOrderItems(orderItems);
        updateStockAfterCheckout(cartItems);
        cartItemRepository.deleteByUserAndIsSelectedTrue(user);

        return orderMapper.toOrderResponse(savedOrder);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> getMyOrders(String email, int page, int size) {
        User user = getUserByEmail(email);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by("createdAt").descending());
        Page<Order> orders = orderRepository.findByUser(user, pageable);
        return PageResponse.fromPage(orders.map(orderMapper::toOrderResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> getAllOrdersForAdmin(String email, int page, int size) {
        User user = getUserByEmail(email);
        validateAdmin(user);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("createdAt").descending());
        Page<Order> orders = orderRepository.findAll(pageable);
        return PageResponse.fromPage(orders.map(orderMapper::toOrderResponse));
    }

    @Transactional(readOnly = true)
    public OrderResponse getMyOrderDetail(String email, UUID orderId) {
        User user = getUserByEmail(email);
        Order order = orderRepository.findByIdAndUser(orderId, user)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        return orderMapper.toOrderResponse(order);
    }

    @Transactional
    public OrderResponse updateOrderStatus(String email, UUID orderId, OrderStatusUpdateRequest request) {
        User user = getUserByEmail(email);
        validateAdmin(user);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));

        order.setStatus(resolveStatus(request.getStatus()));
        Order savedOrder = orderRepository.save(order);
        return orderMapper.toOrderResponse(savedOrder);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private void validateAdmin(User user) {
        if (user.getRole() == null || user.getRole().getName() == null || !"admin".equalsIgnoreCase(user.getRole().getName())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    private String resolveStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) {
            return "PENDING";
        }

        String normalizedStatus = rawStatus.trim().toUpperCase();
        if (!VALID_ORDER_STATUS.contains(normalizedStatus)) {
            throw new AppException(ErrorCode.INVALID_ORDER_STATUS);
        }

        return normalizedStatus;
    }

    private void validateShippingFee(Float shippingFee) {
        if (shippingFee == null || shippingFee < 0f) {
            throw new AppException(ErrorCode.INVALID_ORDER_AMOUNT);
        }
    }

    private BigDecimal calculateSubtotal(List<CartItem> cartItems) {
        return cartItems.stream()
                .filter(cartItem -> cartItem.getIsSelected())
                .map(cartItem -> cartItem.getVariant().getSalePrice().multiply(BigDecimal.valueOf(cartItem.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void validateCartStock(List<CartItem> cartItems) {
        boolean insufficientStock = cartItems.stream().anyMatch(cartItem -> {
            ProductVariant variant = cartItem.getVariant();
            if (!Boolean.TRUE.equals(variant.getStatus()) || !Boolean.TRUE.equals(variant.getProduct().getStatus())) {
                return true;
            }
            return variant.getStockQuantity() < cartItem.getQuantity();
        });

        if (insufficientStock) {
            throw new AppException(ErrorCode.INSUFFICIENT_STOCK);
        }
    }

    private void updateStockAfterCheckout(List<CartItem> cartItems) {
        List<ProductVariant> variantsToUpdate = cartItems.stream()
                .map(cartItem -> {
                    ProductVariant variant = cartItem.getVariant();
                    variant.setStockQuantity(variant.getStockQuantity() - cartItem.getQuantity());
                    return variant;
                })
                .toList();

        productVariantRepository.saveAll(variantsToUpdate);
    }
}
