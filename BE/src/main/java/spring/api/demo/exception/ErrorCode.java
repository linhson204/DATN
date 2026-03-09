package spring.api.demo.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    // Authentication
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không đúng"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Bạn không có quyền truy cập"),

    // User
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User không tồn tại"),

    // Token
    TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "Token không hợp lệ"),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Token đã hết hạn"),
    TOKEN_BLACKLISTED(HttpStatus.UNAUTHORIZED, "Token đã bị vô hiệu hóa"),
    REFRESH_TOKEN_NOT_FOUND(HttpStatus.UNAUTHORIZED, "Refresh token không tồn tại"),

    // Validation
    VALIDATION_FAILED(HttpStatus.UNPROCESSABLE_ENTITY, "Dữ liệu không hợp lệ"),

    // Server
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi hệ thống, vui lòng thử lại sau");

    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(HttpStatus httpStatus, String message) {
        this.httpStatus = httpStatus;
        this.message = message;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public int getStatusCode() {
        return httpStatus.value();
    }

    public String getMessage() {
        return message;
    }
}
