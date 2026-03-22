package spring.api.demo.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;
import spring.api.demo.dto.goong.response.DistanceResponse;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.GoongService;

@RestController
@RequestMapping("/v1/goong")
@RequiredArgsConstructor
public class GoongController {

    private final GoongService goongService;

    @GetMapping("/distance")
    public ResponseEntity<SuccessResource<DistanceResponse.Leg.Distance>> getDistance(
            @RequestParam String origin,
            @RequestParam String destination,
            @RequestParam(defaultValue = "car") String vehicle) {
        DistanceResponse.Leg.Distance distanceData = goongService.getDistance(origin, destination, vehicle);
        return ResponseEntity.ok(new SuccessResource<>("Lấy khoảng cách thành công", distanceData));
    }

    @GetMapping("/location")
    public ResponseEntity<SuccessResource<?>> getLocation(@RequestParam String address) {
        Object locationData = goongService.getLocation(address);
        return ResponseEntity.ok(new SuccessResource<>("Lấy địa điểm thành công", locationData));
    }

    @GetMapping("/coordinates")
    public ResponseEntity<SuccessResource<?>> getCoordinatesByLocation(@RequestParam String address) {
        Object locationData = goongService.getCoordinatesByLocation(address);
        return ResponseEntity.ok(new SuccessResource<>("Lấy tọa độ thành công", locationData));
    }

    @GetMapping("/calculation-distance")
    public ResponseEntity<SuccessResource<DistanceResponse.Leg.Distance>> calculationDistance(
            @RequestParam String origin,
            @RequestParam String destination,
            @RequestParam(defaultValue = "car") String vehicle) {
        DistanceResponse.Leg.Distance distanceData = goongService.calculationDistance(origin, destination, vehicle);
        return ResponseEntity.ok(new SuccessResource<>("Tính khoảng cách thành công", distanceData));
    }
}
