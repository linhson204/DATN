package spring.api.demo.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import spring.api.demo.config.JwtConfig;
import spring.api.demo.entity.BlacklistedToken;
import spring.api.demo.entity.RefreshToken;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.BlacklistedTokenRepository;
import spring.api.demo.repository.RefreshTokenRepository;

import java.security.Key;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

@Service
public class JwtService {

    private static final Logger logger = LoggerFactory.getLogger(JwtService.class);

    private final JwtConfig jwtConfig;
    private final Key key;

    @Autowired
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    public JwtService(JwtConfig jwtConfig) {
        this.jwtConfig = jwtConfig;
        this.key = Keys.hmacShaKeyFor(jwtConfig.getSecretKey().getBytes());
    }

    public String generateToken(String userId, String email, String role, String username) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtConfig.getExpirationMs());

        return Jwts.builder()
                .setSubject(userId)
                .claim("username", username)
                .claim("email", email)
                .claim("role", role)
                .claim("type", "access")
                .setIssuer(jwtConfig.getIssuer())
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateRefreshToken(String userId, String email, String role, String username) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtConfig.getRefreshTokenExpirationMs());

        String refreshToken;

        LocalDateTime expiryDateTime = expiryDate.toInstant()
                .atZone(java.time.ZoneId.systemDefault()).toLocalDateTime();

        Optional<RefreshToken> existingTokenOpt = refreshTokenRepository.findByUserId(UUID.fromString(userId));
        if (existingTokenOpt.isPresent()) {
            RefreshToken existing = existingTokenOpt.get();
            refreshToken = existing.getRefreshToken();
            existing.setRefreshToken(refreshToken);
            existing.setExpiryDate(expiryDateTime);
            refreshTokenRepository.save(existing);
        } else {
            refreshToken = Jwts.builder()
                .setSubject(userId)
                .claim("email", email)
                .claim("role", role)
                .claim("username", username)
                .claim("type", "refresh")
                .setIssuer(jwtConfig.getIssuer())
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();

            RefreshToken newRefreshToken = new RefreshToken();
            newRefreshToken.setUserId(UUID.fromString(userId));
            newRefreshToken.setRefreshToken(refreshToken);
            newRefreshToken.setExpiryDate(expiryDateTime);
            refreshTokenRepository.save(newRefreshToken);
        }

        return refreshToken;
    }



    public boolean isTokenFormatValid(String token) {
        try {
            String[] tokenParts = token.split("\\.");
            if (tokenParts.length != 3) {
                logger.error("Invalid token format: expected 3 parts but got {}", tokenParts.length);
                return false;
            }
            return true;
        } catch (Exception e) {
            logger.error("Invalid token format: {}", e.getMessage());
            return false;
        }
    }

    public boolean isSignatureValid(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (ExpiredJwtException e) {
            return true; // expired but signature is valid
        } catch (Exception e) {
            logger.error("Invalid token signature: {}", e.getMessage());
            return false;
        }
    }

    public boolean isTokenExpired(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key).build()
                    .parseClaimsJws(token)
                    .getBody();
            return claims.getExpiration().before(new Date());
        } catch (ExpiredJwtException e) {
            logger.error("Token expired: {}", e.getMessage());
            return true;
        }
    }

    public boolean isBlacklistedToken(String token) {
        return blacklistedTokenRepository.existsByToken(token);
    }

    public Claims getAllClaims(String token) {
        try {
            return Jwts.parserBuilder()
                    .setSigningKey(key).build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (Exception e) {
            logger.error("Error parsing token claims: {}", e.getMessage());
            throw new RuntimeException(ErrorCode.TOKEN_INVALID.getMessage());
        }
    }

    public <T> T getClaimFromToken(String token, Function<Claims, T> claimsResolver) {
        Claims claims = getAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public boolean isAccessToken(String token) {
        try {
            Claims claims = getAllClaims(token);
            return "access".equals(claims.get("type", String.class));
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isRefreshToken(String token) {
        try {
            Claims claims = getAllClaims(token);
            if (!"refresh".equals(claims.get("type", String.class))) {
                return false;
            }
            RefreshToken refreshToken = refreshTokenRepository.findByRefreshToken(token)
                    .orElseThrow(() -> new RuntimeException(ErrorCode.REFRESH_TOKEN_NOT_FOUND.getMessage()));
            final Date expiration = getClaimFromToken(refreshToken.getRefreshToken(), Claims::getExpiration);
            return expiration.after(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
