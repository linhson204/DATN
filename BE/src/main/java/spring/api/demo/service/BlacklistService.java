package spring.api.demo.service;

import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import spring.api.demo.dto.auth.request.BlacklistTokenRequest;
import spring.api.demo.entity.BlacklistedToken;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.BlacklistedTokenRepository;
import spring.api.demo.resource.MessageResource;

import java.util.UUID;

@Service
public class BlacklistService {

    private static final Logger logger = LoggerFactory.getLogger(BlacklistService.class);

    @Autowired
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Autowired
    private JwtService jwtService;

    public MessageResource create(BlacklistTokenRequest request) {
        if (blacklistedTokenRepository.existsByToken(request.getToken())) {
            return new MessageResource("Token đã bị blacklist trước đó");
        }

        try {
            Claims claims = jwtService.getAllClaims(request.getToken());
            String userId = claims.getSubject();
            java.util.Date expiryDate = claims.getExpiration();

            BlacklistedToken blacklistedToken = new BlacklistedToken();
            blacklistedToken.setToken(request.getToken());
            blacklistedToken.setUserId(UUID.fromString(userId));
            blacklistedToken.setExpiryDate(
                    expiryDate.toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime()
            );
            blacklistedTokenRepository.save(blacklistedToken);

            logger.info("Token đã được thêm vào blacklist");
            return new MessageResource("Đăng xuất thành công");
        } catch (Exception e) {
            logger.error("Lỗi thêm token vào blacklist: {}", e.getMessage());
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }
}
