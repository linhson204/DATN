package spring.api.demo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/**
 * Xác minh Google ID Token bằng cách gọi Google tokeninfo endpoint.
 * Endpoint này xác minh chữ ký và trả về thông tin người dùng nếu hợp lệ.
 */
@Service
public class GoogleTokenVerifier {

    private static final Logger logger = LoggerFactory.getLogger(GoogleTokenVerifier.class);
    private static final String GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token=";

    @Value("${spring.security.oauth2.client.registration.google.client-id}")
    private String expectedClientId;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Xác minh Google ID Token và trả về thông tin người dùng.
     *
     * @param idToken Google ID Token từ frontend
     * @return GoogleUserInfo nếu hợp lệ, ném RuntimeException nếu không hợp lệ
     */
    public GoogleUserInfo verify(String idToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GOOGLE_TOKENINFO_URL + idToken))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                logger.warn("Google tokeninfo trả về lỗi: status={}", response.statusCode());
                throw new RuntimeException("Google ID Token không hợp lệ");
            }

            JsonNode body = objectMapper.readTree(response.body());

            // Kiểm tra aud (audience) phải khớp với client ID của app
            String aud = body.path("aud").asText();
            if (!expectedClientId.equals(aud)) {
                logger.warn("Google ID Token có aud không hợp lệ: {}", aud);
                throw new RuntimeException("Google ID Token không dành cho ứng dụng này");
            }

            String email = body.path("email").asText(null);
            String name = body.path("name").asText(null);
            String emailVerified = body.path("email_verified").asText("false");

            if (email == null || email.isBlank()) {
                throw new RuntimeException("Google ID Token không chứa email");
            }

            if (!"true".equals(emailVerified)) {
                throw new RuntimeException("Email Google chưa được xác minh");
            }

            return new GoogleUserInfo(email, name);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Lỗi xác minh Google ID Token: {}", e.getMessage());
            throw new RuntimeException("Không thể xác minh Google ID Token");
        }
    }

    public record GoogleUserInfo(String email, String name) {}
}
