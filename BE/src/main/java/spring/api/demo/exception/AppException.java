package spring.api.demo.exception;

import java.util.Map;

public class AppException extends RuntimeException {

    private final ErrorCode errorCode;
    private final Map<String, String> errors;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.errors = null;
    }

    public AppException(ErrorCode errorCode, Map<String, String> errors) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.errors = errors;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public Map<String, String> getErrors() {
        return errors;
    }
}
