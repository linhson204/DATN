package spring.api.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfig {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expirationMs}")
    private long expirationMs;

    @Value("${jwt.issuer}")
    private String issuer;

    @Value("${jwt.refreshTokenExpirationMs}")
    private long refreshTokenExpirationMs;

    public String getSecretKey() {
        return secretKey;
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public String getIssuer() {
        return issuer;
    }

    public long getRefreshTokenExpirationMs() {
        return refreshTokenExpirationMs;
    }
}
