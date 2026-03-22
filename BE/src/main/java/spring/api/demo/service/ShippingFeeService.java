package spring.api.demo.service;

import java.math.BigDecimal;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import spring.api.demo.dto.goong.response.DistanceResponse;
import spring.api.demo.dto.shipping.response.ShippingFeeResponse;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;

@Service
public class ShippingFeeService {

    private final GoongService goongService;

    @Value("${shipping.origin-address:176 Khâm Thiên, Quận Đống Đa, Hà Nội}")
    private String originAddress;

    public ShippingFeeService(GoongService goongService) {
        this.goongService = goongService;
    }

    public ShippingFeeResponse calculateShippingFee(String destination) {
        try {
            DistanceResponse.Leg.Distance distance = goongService.calculationDistance(originAddress, destination, "car");
            int distanceInMeters = distance.getValue() == null ? 0 : distance.getValue();

            BigDecimal shippingFee;
            if (distanceInMeters == 0) {
                throw new AppException(ErrorCode.SHIPPING_FEE_CALCULATION_ERROR);
            } else if (distanceInMeters <= 1500) {
                shippingFee = BigDecimal.ZERO;
            } else if (distanceInMeters <= 3000) {
                shippingFee = BigDecimal.valueOf(10000);
            } else if (distanceInMeters <= 5000) {
                shippingFee = BigDecimal.valueOf(20000);
            } else if (distanceInMeters <= 7000) {
                shippingFee = BigDecimal.valueOf(30000);
            } else {
                shippingFee = BigDecimal.valueOf(50000);
            }

            return ShippingFeeResponse.builder()
                    .shippingFee(shippingFee)
                    .distance(distance.getText())
                    .build();
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.SHIPPING_FEE_CALCULATION_ERROR);
        }
    }
}
