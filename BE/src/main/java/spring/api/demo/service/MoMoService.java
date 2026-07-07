package spring.api.demo.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import spring.api.demo.dto.payment.request.MoMoCallbackRequest;
import spring.api.demo.dto.payment.response.MoMoCreatePaymentResult;
import spring.api.demo.entity.Order;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.CartItemRepository;
import spring.api.demo.repository.OrderRepository;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class MoMoService {

    @Value("${momo.enabled:false}")
    private boolean enabled;

    @Value("${momo.partner-code:}")
    private String partnerCode;

    @Value("${momo.access-key:}")
    private String accessKey;

    @Value("${momo.secret-key:}")
    private String secretKey;

    @Value("${momo.create-endpoint:https://test-payment.momo.vn/v2/gateway/api/create}")
    private String createEndpoint;

    @Value("${momo.query-endpoint:https://test-payment.momo.vn/v2/gateway/api/query}")
    private String queryEndpoint;

    @Value("${momo.callback-url:}")
    private String callbackUrl;

    @Value("${momo.redirect-url:}")
    private String redirectUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final OrderRepository orderRepository;
    private final CartItemRepository cartItemRepository;

    public MoMoService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            OrderRepository orderRepository,
            CartItemRepository cartItemRepository
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.orderRepository = orderRepository;
        this.cartItemRepository = cartItemRepository;
    }

    public MoMoCreatePaymentResult createPayment(Order order, String appUserEmail) {
        ensureConfiguration();

        long amount = order.getTotalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
        if (amount <= 0) {
            throw new AppException(ErrorCode.INVALID_ORDER_AMOUNT);
        }

        String orderId = generateMoMoOrderId(order.getId());
        String requestId = UUID.randomUUID().toString();
        String orderInfo = "Thanh toan don hang #" + order.getId().toString().substring(0, 8).toUpperCase();
        String extraData = "";
        String requestType = "captureWallet";

        String orderRedirectUrl = buildOrderRedirectUrl(order.getId());

        // Build rawSignature theo đúng format MoMo yêu cầu (thứ tự alphabet)
        String rawSignature = "accessKey=" + accessKey
                + "&amount=" + amount
                + "&extraData=" + extraData
                + "&ipnUrl=" + callbackUrl
                + "&orderId=" + orderId
                + "&orderInfo=" + orderInfo
                + "&partnerCode=" + partnerCode
                + "&redirectUrl=" + orderRedirectUrl
                + "&requestId=" + requestId
                + "&requestType=" + requestType;

        String signature = signHmacSha256(rawSignature, secretKey);

        // Build JSON request body
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("partnerCode", partnerCode);
        requestBody.put("accessKey", accessKey);
        requestBody.put("requestId", requestId);
        requestBody.put("amount", amount);
        requestBody.put("orderId", orderId);
        requestBody.put("orderInfo", orderInfo);
        requestBody.put("redirectUrl", orderRedirectUrl);
        requestBody.put("ipnUrl", callbackUrl);
        requestBody.put("extraData", extraData);
        requestBody.put("requestType", requestType);
        requestBody.put("signature", signature);
        requestBody.put("lang", "vi");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String responseBody;
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    createEndpoint,
                    new HttpEntity<>(requestBody, headers),
                    String.class
            );
            responseBody = response.getBody();
        } catch (RestClientException ex) {
            String message = ex.getMessage() == null ? "Khong the ket noi den MoMo" : ex.getMessage();
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("momo", message));
        }

        if (responseBody == null || responseBody.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("momo", "MoMo khong tra ve du lieu"));
        }

        JsonNode responseNode;
        try {
            responseNode = objectMapper.readTree(responseBody);
        } catch (JsonProcessingException ex) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("momo", "Phan hoi tu MoMo khong hop le"));
        }

        int resultCode = responseNode.path("resultCode").asInt(-1);
        String resultMessage = responseNode.path("message").asText("");
        if (resultCode != 0) {
            String message = resultMessage.isBlank() ? "Khong the khoi tao thanh toan MoMo" : resultMessage;
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("momo", message));
        }

        String payUrl = responseNode.path("payUrl").asText("");
        if (payUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("momo", "Khong nhan duoc link thanh toan"));
        }

        return MoMoCreatePaymentResult.builder()
                .payUrl(payUrl)
                .orderId(orderId)
                .requestId(requestId)
                .build();
    }

    @Transactional
    public void handleCallback(MoMoCallbackRequest request) {
        if (secretKey == null || secretKey.isBlank()) {
            return;
        }

        // Build rawSignature cho IPN callback verification (thứ tự alphabet)
        String rawSignature = "accessKey=" + accessKey
                + "&amount=" + request.getAmount()
                + "&extraData=" + request.getExtraData()
                + "&message=" + request.getMessage()
                + "&orderId=" + request.getOrderId()
                + "&orderInfo=" + request.getOrderInfo()
                + "&orderType=" + request.getOrderType()
                + "&partnerCode=" + request.getPartnerCode()
                + "&payType=" + request.getPayType()
                + "&requestId=" + request.getRequestId()
                + "&responseTime=" + request.getResponseTime()
                + "&resultCode=" + request.getResultCode()
                + "&transId=" + request.getTransId();


        String expectedSignature = signHmacSha256(rawSignature, secretKey);
        if (!expectedSignature.equalsIgnoreCase(request.getSignature())) {
            return;
        }

        // MoMo dùng orderId = Order UUID
        String momoOrderId = request.getOrderId();
        if (momoOrderId == null || momoOrderId.isBlank()) {
            return;
        }

        UUID orderUuid;
        try {
            orderUuid = UUID.fromString(momoOrderId);
        } catch (IllegalArgumentException ex) {
            // orderId không phải UUID, thử tìm theo paymentAppTransId
            Optional<Order> optionalOrder = orderRepository.findByPaymentAppTransId(momoOrderId);
            if (optionalOrder.isPresent()) {
                updateOrderPayment(optionalOrder.get(), request);
            }
            return;
        }

        Optional<Order> optionalOrder = orderRepository.findById(orderUuid);
        if (optionalOrder.isPresent()) {
            updateOrderPayment(optionalOrder.get(), request);
        }
    }

    private void updateOrderPayment(Order order, MoMoCallbackRequest request) {
        if (request.getResultCode() == 0) {
            order.setPaymentStatus("PAID");
            if (request.getTransId() > 0) {
                order.setPaymentTransactionId(String.valueOf(request.getTransId()));
            }
            if ("PENDING".equals(order.getStatus())) {
                order.setStatus("CONFIRMED");
            }
            // Xóa giỏ hàng sau khi thanh toán MoMo thành công
            cartItemRepository.deleteByUserAndIsSelectedTrue(order.getUser());
        }
        orderRepository.save(order);
    }

    @Transactional
    public boolean queryPaymentStatus(Order order) {
        if (order.getPaymentAppTransId() == null || order.getPaymentAppTransId().isBlank()) {
            return false;
        }
        String orderId = order.getPaymentAppTransId();
        String requestId = UUID.randomUUID().toString();
        String rawSignature = "accessKey=" + accessKey
                + "&orderId=" + orderId
                + "&partnerCode=" + partnerCode
                + "&requestId=" + requestId;
        String signature = signHmacSha256(rawSignature, secretKey);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("partnerCode", partnerCode);
        requestBody.put("requestId", requestId);
        requestBody.put("orderId", orderId);
        requestBody.put("lang", "vi");
        requestBody.put("signature", signature);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    queryEndpoint,
                    new HttpEntity<>(requestBody, headers),
                    String.class
            );
            String responseBody = response.getBody();
            if (responseBody != null && !responseBody.isBlank()) {
                JsonNode responseNode = objectMapper.readTree(responseBody);
                int resultCode = responseNode.path("resultCode").asInt(-1);
                if (resultCode == 0) {
                    order.setPaymentStatus("PAID");
                    long transId = responseNode.path("transId").asLong(0);
                    if (transId > 0) {
                        order.setPaymentTransactionId(String.valueOf(transId));
                    }
                    if ("PENDING".equals(order.getStatus())) {
                        order.setStatus("CONFIRMED");
                    }
                    cartItemRepository.deleteByUserAndIsSelectedTrue(order.getUser());
                    orderRepository.save(order);
                    return true;
                }
            }
        } catch (Exception ex) {
            // Ignore query error
        }
        return false;
    }

    private String buildOrderRedirectUrl(UUID orderId) {
        String baseRedirect = redirectUrl.endsWith("/")
                ? redirectUrl.substring(0, redirectUrl.length() - 1)
                : redirectUrl;
        return baseRedirect + "/" + orderId + "?payment=momo";
    }

    private String signHmacSha256(String data, String key) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte value : hash) {
                builder.append(String.format("%02x", value & 0xff));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("Khong the tao chu ky HMAC SHA256", ex);
        }
    }

    private void ensureConfiguration() {
        if (!enabled
                || partnerCode == null
                || partnerCode.isBlank()
                || accessKey == null
                || accessKey.isBlank()
                || secretKey == null
                || secretKey.isBlank()
                || createEndpoint == null
                || createEndpoint.isBlank()
                || callbackUrl == null
                || callbackUrl.isBlank()
                || redirectUrl == null
                || redirectUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_NOT_CONFIGURED);
        }
    }

    private String generateMoMoOrderId(UUID orderId) {
        String datePrefix = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))
                .format(DateTimeFormatter.ofPattern("yyMMdd"));
        String orderPart = orderId.toString().replace("-", "").substring(0, 8);
        return "MM" + datePrefix + "_" + System.currentTimeMillis() + "_" + orderPart;
    }
}
