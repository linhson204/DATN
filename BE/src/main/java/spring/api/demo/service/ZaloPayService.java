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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import spring.api.demo.dto.payment.request.ZaloPayCallbackRequest;
import spring.api.demo.dto.payment.response.ZaloPayCallbackResponse;
import spring.api.demo.dto.payment.response.ZaloPayCreatePaymentResult;
import spring.api.demo.entity.Order;
import spring.api.demo.entity.OrderItem;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ZaloPayService {

    @Value("${zalopay.enabled:false}")
    private boolean enabled;

    @Value("${zalopay.app-id:}")
    private int appId;

    @Value("${zalopay.key1:}")
    private String key1;

    @Value("${zalopay.key2:}")
    private String key2;

    @Value("${zalopay.create-endpoint:https://sb-openapi.zalopay.vn/v2/create}")
    private String createEndpoint;

    @Value("${zalopay.callback-url:}")
    private String callbackUrl;

    @Value("${zalopay.redirect-url:}")
    private String redirectUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final OrderRepository orderRepository;

    public ZaloPayService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            OrderRepository orderRepository
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.orderRepository = orderRepository;
    }

    public ZaloPayCreatePaymentResult createPayment(Order order, String appUserEmail) {
        ensureCreatePaymentConfiguration();

        long amount = order.getTotalAmount().setScale(0, RoundingMode.HALF_UP).longValue();
        if (amount <= 0) {
            throw new AppException(ErrorCode.INVALID_ORDER_AMOUNT);
        }

        String appTransId = generateAppTransId(order.getId());
        long appTime = System.currentTimeMillis();
        String appUser = (appUserEmail == null || appUserEmail.isBlank()) ? "customer" : appUserEmail;
        String item = buildItemData(order.getOrderItems());
        String embedData = buildEmbedData(order.getId());
        String description = "Thanh toan don hang #" + order.getId().toString().substring(0, 8).toUpperCase();

        String signData = appId
                + "|" + appTransId
                + "|" + appUser
                + "|" + amount
                + "|" + appTime
                + "|" + embedData
                + "|" + item;

        String mac = signHmacSha256(signData, key1);

        MultiValueMap<String, String> payload = new LinkedMultiValueMap<>();
        payload.add("app_id", String.valueOf(appId));
        payload.add("app_user", appUser);
        payload.add("app_time", String.valueOf(appTime));
        payload.add("amount", String.valueOf(amount));
        payload.add("app_trans_id", appTransId);
        payload.add("embed_data", embedData);
        payload.add("item", item);
        payload.add("description", description);
        payload.add("bank_code", "");
        payload.add("callback_url", callbackUrl);
        payload.add("mac", mac);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        String responseBody;
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    createEndpoint,
                    new HttpEntity<>(payload, headers),
                    String.class
            );
            responseBody = response.getBody();
        } catch (RestClientException ex) {
            String message = ex.getMessage() == null ? "Khong the ket noi den ZaloPay" : ex.getMessage();
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("zalopay", message));
        }

        if (responseBody == null || responseBody.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("zalopay", "ZaloPay khong tra ve du lieu"));
        }

        JsonNode responseNode;
        try {
            responseNode = objectMapper.readTree(responseBody);
        } catch (JsonProcessingException ex) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("zalopay", "Phan hoi tu ZaloPay khong hop le"));
        }

        int returnCode = responseNode.path("return_code").asInt(-1);
        String returnMessage = responseNode.path("return_message").asText("");
        if (returnCode != 1) {
            String message = returnMessage.isBlank() ? "Khong the khoi tao thanh toan ZaloPay" : returnMessage;
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("zalopay", message));
        }

        String orderUrl = responseNode.path("order_url").asText("");
        if (orderUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("zalopay", "Khong nhan duoc link thanh toan"));
        }

        return ZaloPayCreatePaymentResult.builder()
                .appTransId(appTransId)
                .orderUrl(orderUrl)
                .build();
    }

    @Transactional
    public ZaloPayCallbackResponse handleCallback(ZaloPayCallbackRequest request) {
        if (key2 == null || key2.isBlank()) {
            return ZaloPayCallbackResponse.builder()
                    .returnCode(-1)
                    .returnMessage("ZaloPay key2 is missing")
                    .build();
        }

        String expectedMac = signHmacSha256(request.getData(), key2);
        if (!expectedMac.equalsIgnoreCase(request.getMac())) {
            return ZaloPayCallbackResponse.builder()
                    .returnCode(-1)
                    .returnMessage("invalid mac")
                    .build();
        }

        JsonNode callbackData;
        try {
            callbackData = objectMapper.readTree(request.getData());
        } catch (JsonProcessingException ex) {
            return ZaloPayCallbackResponse.builder()
                    .returnCode(-1)
                    .returnMessage("invalid callback data")
                    .build();
        }

        String appTransId = callbackData.path("app_trans_id").asText("");
        if (appTransId.isBlank()) {
            return ZaloPayCallbackResponse.builder()
                    .returnCode(-1)
                    .returnMessage("missing app_trans_id")
                    .build();
        }

        Optional<Order> optionalOrder = orderRepository.findByPaymentAppTransId(appTransId);
        if (optionalOrder.isPresent()) {
            Order order = optionalOrder.get();
            order.setPaymentStatus("PAID");
            String zpTransId = callbackData.path("zp_trans_id").asText("");
            if (!zpTransId.isBlank()) {
                order.setPaymentTransactionId(zpTransId);
            }
            if ("PENDING".equals(order.getStatus())) {
                order.setStatus("CONFIRMED");
            }
            orderRepository.save(order);
        }

        return ZaloPayCallbackResponse.builder()
                .returnCode(1)
                .returnMessage("success")
                .build();
    }

    private String buildItemData(List<OrderItem> orderItems) {
        List<Map<String, Object>> items = orderItems.stream().map(orderItem -> {
            Map<String, Object> itemData = new HashMap<>();
            itemData.put("itemid", orderItem.getVariant().getId().toString());
            itemData.put("itemname", orderItem.getProductName());
            itemData.put("itemprice", orderItem.getUnitPrice().setScale(0, RoundingMode.HALF_UP).longValue());
            itemData.put("itemquantity", orderItem.getQuantity());
            return itemData;
        }).toList();

        try {
            return objectMapper.writeValueAsString(items);
        } catch (JsonProcessingException ex) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("zalopay", "Khong the tao du lieu item"));
        }
    }

    private String buildEmbedData(UUID orderId) {
        Map<String, Object> embedData = new HashMap<>();
        embedData.put("redirecturl", buildOrderRedirectUrl(orderId));
        embedData.put("order_id", orderId.toString());

        try {
            return objectMapper.writeValueAsString(embedData);
        } catch (JsonProcessingException ex) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR, Map.of("zalopay", "Khong the tao embed_data"));
        }
    }

    private String buildOrderRedirectUrl(UUID orderId) {
        String baseRedirect = redirectUrl.endsWith("/")
                ? redirectUrl.substring(0, redirectUrl.length() - 1)
                : redirectUrl;
        return baseRedirect + "/" + orderId + "?payment=zalopay";
    }

    private String generateAppTransId(UUID orderId) {
        String datePrefix = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))
                .format(DateTimeFormatter.ofPattern("yyMMdd"));
        String orderPart = orderId.toString().replace("-", "").substring(0, 8);
        return datePrefix + "_" + System.currentTimeMillis() + "_" + orderPart;
    }

    private String signHmacSha256(String data, String secretKey) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
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

    private void ensureCreatePaymentConfiguration() {
        if (!enabled
                || appId <= 0
                || key1 == null
                || key1.isBlank()
                || key2 == null
                || key2.isBlank()
                || createEndpoint == null
                || createEndpoint.isBlank()
                || callbackUrl == null
                || callbackUrl.isBlank()
                || redirectUrl == null
                || redirectUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_NOT_CONFIGURED);
        }
    }
}
