package spring.api.demo.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    // Authentication
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không đúng"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện hành động này"),
    ACCOUNT_NOT_VERIFIED(HttpStatus.FORBIDDEN, "Tài khoản chưa được xác thực email"),

    // User
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "Người dùng không tồn tại"),
    EMAIL_ALREADY_EXISTS(HttpStatus.UNPROCESSABLE_ENTITY, "Email đã được sử dụng"),
    ROLE_NOT_FOUND(HttpStatus.INTERNAL_SERVER_ERROR, "Role không tồn tại trong hệ thống"),

    // Product
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND, "Sản phẩm không tồn tại"),
    CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "Danh mục không tồn tại"),
    PRODUCT_VARIANT_NOT_FOUND(HttpStatus.NOT_FOUND, "Biến thể sản phẩm không tồn tại"),
    PRODUCT_VARIANT_UNAVAILABLE(HttpStatus.UNPROCESSABLE_ENTITY, "Sản phẩm tạm thời không còn kinh doanh"),

    // Material
    MATERIAL_NOT_FOUND(HttpStatus.NOT_FOUND, "Chất liệu không tồn tại"),
    MATERIAL_CODE_ALREADY_EXISTS(HttpStatus.UNPROCESSABLE_ENTITY, "Mã chất liệu đã tồn tại"),

    // Cart
    CART_ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, "Sản phẩm trong giỏ hàng không tồn tại"),
    CART_EMPTY(HttpStatus.UNPROCESSABLE_ENTITY, "Giỏ hàng đang trống"),
    CART_NO_SELECTED_ITEMS(HttpStatus.UNPROCESSABLE_ENTITY, "Vui lòng chọn ít nhất 1 sản phẩm để mua"),
    INSUFFICIENT_STOCK(HttpStatus.UNPROCESSABLE_ENTITY, "Số lượng sản phẩm trong kho không đủ"),
    INVALID_QUANTITY(HttpStatus.UNPROCESSABLE_ENTITY, "Số lượng không hợp lệ"),

    // Wishlist
    WISHLIST_ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, "Sản phẩm trong wishlist không tồn tại"),
    WISHLIST_ITEM_ALREADY_EXISTS(HttpStatus.UNPROCESSABLE_ENTITY, "Sản phẩm đã tồn tại trong wishlist"),

    // Order
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "Đơn hàng không tồn tại"),
    INVALID_ORDER_STATUS(HttpStatus.UNPROCESSABLE_ENTITY, "Trạng thái đơn hàng không hợp lệ"),
    INVALID_ORDER_AMOUNT(HttpStatus.UNPROCESSABLE_ENTITY, "Phí vận chuyển và tổng tiền không hợp lệ"),

    // Token
    TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "Token không hợp lệ"),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Token đã hết hạn"),
    TOKEN_BLACKLISTED(HttpStatus.UNAUTHORIZED, "Token đã bị vô hiệu hóa"),
    REFRESH_TOKEN_NOT_FOUND(HttpStatus.UNAUTHORIZED, "Refresh token không tồn tại"),

    // OTP
    INVALID_OTP(HttpStatus.UNPROCESSABLE_ENTITY, "Mã OTP không hợp lệ hoặc đã hết hạn"),

    // Validation
    VALIDATION_FAILED(HttpStatus.UNPROCESSABLE_ENTITY, "Dữ liệu không hợp lệ"),

    // Payment
    INVALID_PAYMENT_METHOD(HttpStatus.UNPROCESSABLE_ENTITY, "Phương thức thanh toán không hợp lệ"),
    PAYMENT_GATEWAY_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "Cổng thanh toán chưa được cấu hình"),
    PAYMENT_GATEWAY_ERROR(HttpStatus.BAD_GATEWAY, "Không thể kết nối cổng thanh toán"),

    // External API
    GOONG_API_ERROR(HttpStatus.SERVICE_UNAVAILABLE, "Không thể kết nối đến dịch vụ bản đồ Goong"),
    SHIPPING_FEE_CALCULATION_ERROR(HttpStatus.UNPROCESSABLE_ENTITY, "Không thể tính phí vận chuyển"),

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
