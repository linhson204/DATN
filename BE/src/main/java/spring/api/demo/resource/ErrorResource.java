package spring.api.demo.resource;

import spring.api.demo.exception.ErrorCode;

import java.util.Map;

public class ErrorResource {
    private String message;
    private Map<String, String> errors;

    public ErrorResource(ErrorCode errorCode, Map<String, String> errors) {
        this.message = errorCode.getMessage();
        this.errors = errors;
    }

    public ErrorResource(ErrorCode errorCode) {
        this.message = errorCode.getMessage();
        this.errors = null;
    }

    public ErrorResource(String message, Map<String, String> errors) {
        this.message = message;
        this.errors = errors;
    }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Map<String, String> getErrors() { return errors; }
    public void setErrors(Map<String, String> errors) { this.errors = errors; }
}
