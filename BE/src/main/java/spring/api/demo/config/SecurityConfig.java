package spring.api.demo.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.resource.ErrorResource;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;
    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(request -> {
                    var corsConfiguration = new org.springframework.web.cors.CorsConfiguration();
                    corsConfiguration.addAllowedOrigin("http://localhost:5173");
                    corsConfiguration.addAllowedOrigin("http://localhost:3000");
                    corsConfiguration.addAllowedHeader("*");
                    corsConfiguration.addAllowedMethod("*");
                    corsConfiguration.setAllowCredentials(true);
                    return corsConfiguration;
                }))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(auth -> auth
                        // ========== PUBLIC ENDPOINTS ==========
                        .requestMatchers("/v1/auth/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()


                        // ========== PROTECTED ENDPOINTS ==========
                        .requestMatchers(HttpMethod.GET, "/v1/products", "/v1/products/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/v1/products", "/v1/products/{id}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/v1/products", "/v1/products/{id}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/v1/products", "/v1/products/{id}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/v1/products", "/v1/products/{id}").hasRole("ADMIN")


                        .requestMatchers(HttpMethod.GET, "/v1/product-categories", "/v1/product-categories/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/v1/product-categories", "/v1/product-categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/v1/product-categories", "/v1/product-categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/v1/product-categories", "/v1/product-categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/v1/product-categories", "/v1/product-categories/**").hasRole("ADMIN")

                        // ========== GOONG ENDPOINTS (PUBLIC) ==========
                        .requestMatchers("/v1/goong/**").permitAll()

                        // ========== MATERIAL ENDPOINTS ==========
                        .requestMatchers(HttpMethod.GET, "/v1/materials", "/v1/materials/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/v1/materials", "/v1/materials/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/v1/materials", "/v1/materials/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/v1/materials", "/v1/materials/**").hasRole("ADMIN")


                        //============ SHIPPING FEE ENDPOINTS (PUBLIC) ==========
                        .requestMatchers("/v1/shipping-fee/**").permitAll()

                        //============ ZALOPAY CALLBACK ENDPOINT ==========
                        .requestMatchers("/v1/payments/zalopay/callback").permitAll()

                        //============ MOMO CALLBACK ENDPOINT ==========
                        .requestMatchers("/v1/payments/momo/callback").permitAll()

                        // ========== VIEW LOG ENDPOINTS ==========
                        .requestMatchers(HttpMethod.POST, "/v1/products/{id}/view").permitAll()

                        // ========== RECOMMENDATION ENDPOINTS (PUBLIC) ==========
                        .requestMatchers(HttpMethod.GET, "/v1/recommendations/**").permitAll()

                        // ========== REVIEW ENDPOINTS ==========
                        .requestMatchers(HttpMethod.GET, "/v1/products/*/reviews", "/v1/products/*/reviews/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/v1/products/*/reviews").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/v1/products/*/reviews/**").authenticated()


                        .anyRequest().authenticated()
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(ErrorCode.UNAUTHORIZED.getStatusCode());
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            objectMapper.writeValue(response.getOutputStream(), new ErrorResource(ErrorCode.UNAUTHORIZED));
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(ErrorCode.FORBIDDEN.getStatusCode());
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            objectMapper.writeValue(response.getOutputStream(), new ErrorResource(ErrorCode.FORBIDDEN));
                        })
                )
                .oauth2Login(oauth2 -> oauth2
                        .successHandler(oAuth2AuthenticationSuccessHandler)
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}
