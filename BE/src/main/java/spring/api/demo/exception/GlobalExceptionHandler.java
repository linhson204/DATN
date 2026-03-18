package spring.api.demo.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import spring.api.demo.resource.ErrorResource;

import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResource> handleAppException(AppException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        ErrorResource errorResource = ex.getErrors() != null
                ? new ErrorResource(errorCode, ex.getErrors())
                : new ErrorResource(errorCode);
        return new ResponseEntity<>(errorResource, errorCode.getHttpStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResource> handleValidationException(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        return new ResponseEntity<>(new ErrorResource(ErrorCode.VALIDATION_FAILED, errors), ErrorCode.VALIDATION_FAILED.getHttpStatus());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResource> handleAccessDeniedException(AccessDeniedException ex) {
        return new ResponseEntity<>(new ErrorResource(ErrorCode.FORBIDDEN), ErrorCode.FORBIDDEN.getHttpStatus());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResource> handleGenericException(Exception ex) {
        return new ResponseEntity<>(new ErrorResource(ErrorCode.INTERNAL_SERVER_ERROR), ErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus());
    }
}
