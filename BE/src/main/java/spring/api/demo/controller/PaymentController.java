package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.payment.request.MoMoCallbackRequest;
import spring.api.demo.dto.payment.request.ZaloPayCallbackRequest;
import spring.api.demo.dto.payment.response.ZaloPayCallbackResponse;
import spring.api.demo.service.MoMoService;
import spring.api.demo.service.ZaloPayService;

@RestController
@RequestMapping("/v1/payments")
public class PaymentController {

    private final ZaloPayService zaloPayService;
    private final MoMoService moMoService;

    public PaymentController(ZaloPayService zaloPayService, MoMoService moMoService) {
        this.zaloPayService = zaloPayService;
        this.moMoService = moMoService;
    }

    @PostMapping("/zalopay/callback")
    public ResponseEntity<ZaloPayCallbackResponse> handleZaloPayCallback(
            @Valid @RequestBody ZaloPayCallbackRequest request
    ) {
        ZaloPayCallbackResponse response = zaloPayService.handleCallback(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/momo/callback")
    public ResponseEntity<Void> handleMoMoCallback(@RequestBody MoMoCallbackRequest request) {
        moMoService.handleCallback(request);
        return ResponseEntity.noContent().build();
    }
}
