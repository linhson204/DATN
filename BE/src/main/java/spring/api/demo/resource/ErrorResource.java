package spring.api.demo.resource;

import org.springframework.http.HttpStatus;
import spring.api.demo.exception.ErrorCode;

import java.util.Map;

public class ErrorResource {
    private String message;
    private Map<String, String> errors;
    private int status;

    public ErrorResource(ErrorCode errorCode, Map<String, String> errors) {
        this.message = errorCode.getMessage();
        this.errors = errors;
        this.status = errorCode.getStatusCode();
    }

    public ErrorResource(ErrorCode errorCode) {
        this.message = errorCode.getMessage();
        this.errors = null;
        this.status = errorCode.getStatusCode();
    }

    public ErrorResource(String message, Map<String, String> errors) {
        this.message = message;
        this.errors = errors;
        this.status = HttpStatus.UNPROCESSABLE_ENTITY.value();
    }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Map<String, String> getErrors() { return errors; }
    public void setErrors(Map<String, String> errors) { this.errors = errors; }

    public int getStatus() { return status; }
}
