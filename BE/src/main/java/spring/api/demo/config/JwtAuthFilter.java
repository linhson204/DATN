package spring.api.demo.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import spring.api.demo.service.CustomUserDetailsService;
import spring.api.demo.service.JwtService;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.resource.ErrorResource;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;
    private final ObjectMapper objectMapper;


    @Override
    public void doFilterInternal(
            @NotNull HttpServletRequest request,
            @NotNull HttpServletResponse response,
            @NotNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);

        if (!jwtService.isTokenFormatValid(jwt)) {
            sendErrorResponse(response, ErrorCode.TOKEN_INVALID);
            return;
        }

        if (jwtService.isTokenExpired(jwt)) {
            sendErrorResponse(response, ErrorCode.TOKEN_EXPIRED);
            return;
        }

        if (!jwtService.isSignatureValid(jwt)) {
            sendErrorResponse(response, ErrorCode.TOKEN_INVALID);
            return;
        }

        if (!jwtService.isAccessToken(jwt)) {
            sendErrorResponse(response, ErrorCode.TOKEN_INVALID);
            return;
        }

        if (jwtService.isBlacklistedToken(jwt)) {
            sendErrorResponse(response, ErrorCode.TOKEN_BLACKLISTED);
            return;
        }

        try {
            final String userId = jwtUtil.getUserIdFromJwt(jwt);
            if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                UserDetails userDetails = customUserDetailsService.loadUserByUsername(userId);

                String emailFromToken = jwtUtil.getEmailFromJwt(jwt);
                if (emailFromToken == null || !emailFromToken.equals(userDetails.getUsername())) {
                    sendErrorResponse(response, ErrorCode.TOKEN_INVALID);
                    return;
                }

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        } catch (Exception e) {
            sendErrorResponse(response, ErrorCode.TOKEN_INVALID);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void sendErrorResponse(
            @NotNull HttpServletResponse response,
            ErrorCode errorCode
    ) throws IOException {
        response.setStatus(errorCode.getStatusCode());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ErrorResource errorResource = new ErrorResource(errorCode);
        objectMapper.writeValue(response.getOutputStream(), errorResource);
    }
}
