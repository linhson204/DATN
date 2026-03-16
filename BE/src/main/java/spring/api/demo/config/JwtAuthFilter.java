package spring.api.demo.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import spring.api.demo.service.CustomUserDetailsService;
import spring.api.demo.service.JwtService;
import spring.api.demo.exception.ErrorCode;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;
    private final ObjectMapper objectMapper;

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthFilter.class);

    @Override
    public boolean shouldNotFilter(@NotNull HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/v1/auth/login")
                || path.startsWith("/v1/auth/refresh")
                || path.startsWith("/api/public/")
                || path.startsWith("/v1/auth/send-otp")
                || path.startsWith("/v1/auth/verify-otp-forgot-password")
                || path.startsWith("/v1/auth/reset-password")
                || path.startsWith("/v1/auth/register")
                || path.startsWith("/v1/auth/verify-email")
                || path.startsWith("/oauth2/")
                || path.startsWith("/login/oauth2/")
                || (request.getMethod().equals("GET") && (path.startsWith("/v1/products") || path.startsWith("/v1/product-categories")));
    }

    @Override
    public void doFilterInternal(
            @NotNull HttpServletRequest request,
            @NotNull HttpServletResponse response,
            @NotNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendErrorResponse(response, request, ErrorCode.UNAUTHORIZED);
            return;
        }

        final String jwt = authHeader.substring(7);

        if (!jwtService.isTokenFormatValid(jwt)) {
            sendErrorResponse(response, request, ErrorCode.TOKEN_INVALID);
            return;
        }

        if (jwtService.isTokenExpired(jwt)) {
            sendErrorResponse(response, request, ErrorCode.TOKEN_EXPIRED);
            return;
        }

        if (!jwtService.isSignatureValid(jwt)) {
            sendErrorResponse(response, request, ErrorCode.TOKEN_INVALID);
            return;
        }

        if (!jwtService.isAccessToken(jwt)) {
            sendErrorResponse(response, request, ErrorCode.TOKEN_INVALID);
            return;
        }

        if (jwtService.isBlacklistedToken(jwt)) {
            sendErrorResponse(response, request, ErrorCode.TOKEN_BLACKLISTED);
            return;
        }

        try {
            final String userId = jwtUtil.getUserIdFromJwt(jwt);
            if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                UserDetails userDetails = customUserDetailsService.loadUserByUsername(userId);

                String emailFromToken = jwtUtil.getEmailFromJwt(jwt);
                if (emailFromToken == null || !emailFromToken.equals(userDetails.getUsername())) {
                    sendErrorResponse(response, request, ErrorCode.TOKEN_INVALID);
                    return;
                }

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
                logger.info("Xác thực tài khoản thành công: {}", userDetails.getUsername());
            }
        } catch (Exception e) {
            logger.error("Lỗi xử lý JWT: {}", e.getMessage());
            sendErrorResponse(response, request, ErrorCode.TOKEN_INVALID);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void sendErrorResponse(
            @NotNull HttpServletResponse response,
            @NotNull HttpServletRequest request,
            ErrorCode errorCode
    ) throws IOException {
        response.setStatus(errorCode.getStatusCode());
        response.setContentType("application/json");

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("timestamp", System.currentTimeMillis());
        errorResponse.put("status", errorCode.getStatusCode());
        errorResponse.put("error", errorCode.getHttpStatus().getReasonPhrase());
        errorResponse.put("message", errorCode.getMessage());
        errorResponse.put("path", request.getRequestURI());

        String jsonResponse = objectMapper.writeValueAsString(errorResponse);
        response.getWriter().write(jsonResponse);
    }
}
