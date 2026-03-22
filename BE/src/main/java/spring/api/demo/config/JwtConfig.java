package spring.api.demo.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Getter
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
}
