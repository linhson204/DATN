package spring.api.demo.resource;

import lombok.Data;

@Data
public class MessageResource {
    private String message;
    private int status;

    public MessageResource(String message) {
        this.message = message;
        this.status = 200;
    }

    public MessageResource(String message, int status) {
        this.message = message;
        this.status = status;
    }
}
