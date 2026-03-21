package spring.api.demo.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

import spring.api.demo.dto.shipping.request.ShippingFeeRequest;
import spring.api.demo.dto.shipping.response.ShippingFeeResponse;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.ShippingFeeService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/v1/shipping-fee")
public class ShippingFeeController {
    ShippingFeeService shippingFeeService;

    public ShippingFeeController(ShippingFeeService shippingFeeService) {
        this.shippingFeeService = shippingFeeService;
    }

    @PostMapping()
    public ResponseEntity<SuccessResource<ShippingFeeResponse>> postMethodName(@RequestBody ShippingFeeRequest request) {
        ShippingFeeResponse shippingFee = shippingFeeService.calculateShippingFee(request.getDestination());
        return ResponseEntity.ok(new SuccessResource<>("Tính phí vận chuyển", shippingFee));
    }
    
}
