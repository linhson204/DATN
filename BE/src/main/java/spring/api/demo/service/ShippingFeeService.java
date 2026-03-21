package spring.api.demo.service;

import java.math.BigDecimal;

import org.springframework.stereotype.Service;

import spring.api.demo.dto.goong.response.DistanceResponse;
import spring.api.demo.dto.shipping.response.ShippingFeeResponse;

@Service
public class ShippingFeeService {
    private final GoongService goongService;

    String originAddress = "176 Khâm Thiên, Quận Đống Đa, Hà Nội";


    public ShippingFeeService(GoongService goongService) {
        this.goongService = goongService;
    }

    public ShippingFeeResponse calculateShippingFee(String destination) {
        try {
            DistanceResponse.Leg.Distance distance = goongService.calculationDistance(originAddress, destination, "car");
            int distanceInMeters = distance.getValue() == null ? 0 : distance.getValue();
            BigDecimal shippingFee = BigDecimal.valueOf(0);
            if(distanceInMeters == 0) {
                throw new RuntimeException("Khoảng cách không hợp lệ, không thể tính phí vận chuyển");
            } else if (distanceInMeters <= 1500) {
                shippingFee = BigDecimal.valueOf(0); // Phí tối thiểu cho khoảng cách dưới 1km
            } else if (distanceInMeters <= 3000) {
                shippingFee = BigDecimal.valueOf(10000); // Phí cố định cho khoảng cách từ 1km đến 50km
            } else if (distanceInMeters <= 5000) {
                shippingFee = BigDecimal.valueOf(20000); // Phí cố định cho khoảng cách từ 1km đến 50km
            } else if (distanceInMeters <= 7000) {
                shippingFee = BigDecimal.valueOf(30000); // Phí cố định cho khoảng cách từ 1km đến 50km
            } else {
                shippingFee = BigDecimal.valueOf(50000);
            }
            return ShippingFeeResponse.builder()
                    .shippingFee(shippingFee)
                    .distance(distance.getText())
                    .build();
        } catch (Exception e) {
            throw new RuntimeException("Không thể tính phí vận chuyển: " + e.getMessage());
        }
    }

}
