package spring.api.demo.resource;

public class SuccessResource<T> {
    private String message;
    private T data;
    private int status;

    public SuccessResource(String message, T data) {
        this.message = message;
        this.data = data;
        this.status = 200;
    }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public T getData() { return data; }
    public void setData(T data) { this.data = data; }

    public int getStatus() { return status; }
}
