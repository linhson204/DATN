package spring.api.demo.controller;
import spring.api.demo.service.GoongService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/v1/goong")
public class GoongController {
    @Autowired
    private GoongService goongService;

   
    @GetMapping("/distance")
    public ResponseEntity<Map<String, Object>> getDistance(
            @RequestParam String origin,
            @RequestParam String destination,
            @RequestParam(defaultValue = "car") String vehicle) {
        try {
            Object distanceData = goongService.getDistance(origin, destination, vehicle);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Lấy khoảng cách thành công");
            response.put("data", distanceData);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Không thể lấy khoảng cách: " + e.getMessage());
            errorResponse.put("data", null);

            return ResponseEntity.badRequest().body(errorResponse);
        }
    }



    @GetMapping("/location")
    public ResponseEntity<Map<String, Object>> getLocation(
            @RequestParam String address) {
        try {
            Object locationData = goongService.getLocation(address);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Lấy địa điểm thành công");
            response.put("data", locationData);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Không thể lấy địa điểm: " + e.getMessage());
            errorResponse.put("data", null);

            return ResponseEntity.badRequest().body(errorResponse);
        }
    }


    @GetMapping("/coordinates")
    public ResponseEntity<Map<String, Object>> getCoordinatesByLocation(
            @RequestParam String address) {
        try {
            Object locationData = goongService.getCoordinatesByLocation(address);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Lấy tọa độ thành công");
            response.put("data", locationData);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Không thể lấy tọa độ: " + e.getMessage());
            errorResponse.put("data", null);

            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @GetMapping("/calculation-distance")
    public ResponseEntity<Map<String, Object>> calculationDistance(
            @RequestParam String origin,
            @RequestParam String destination,
            @RequestParam(defaultValue = "car") String vehicle) {
        try {
            Object distanceData = goongService.calculationDistance(origin, destination, vehicle);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Tính khoảng cách thành công");
            response.put("data", distanceData);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Không thể tính khoảng cách: " + e.getMessage());
            errorResponse.put("data", null);

            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}
