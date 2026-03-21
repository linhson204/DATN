package spring.api.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import spring.api.demo.dto.goong.response.DistanceResponse;
import spring.api.demo.dto.goong.response.GeocodeResponse;
import spring.api.demo.dto.goong.response.LocationResponse;



import java.net.URI;
import java.nio.charset.StandardCharsets;

@Service
public class GoongService {

    @Value("${goong.api.base-url}")
    private String baseUrl;

    @Value("${goong.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public GoongService() {
        this.restTemplate = new RestTemplate();
    }

    public DistanceResponse.Leg.Distance getDistance(String origin, String destination, String vehicle) {
        // Xây dựng URL với query parameters
        URI url = UriComponentsBuilder.fromHttpUrl(baseUrl + "/Direction")
                .queryParam("origin", origin)
                .queryParam("destination", destination)
                .queryParam("vehicle", vehicle)
                .queryParam("api_key", apiKey)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            // Gọi API và nhận response dưới dạng Object
            DistanceResponse response = restTemplate.getForObject(url, DistanceResponse.class);
            if (response == null
                    || response.getRoutes() == null
                    || response.getRoutes().isEmpty()
                    || response.getRoutes().get(0).getLegs() == null
                    || response.getRoutes().get(0).getLegs().isEmpty()) {
                throw new RuntimeException("Goong không trả về dữ liệu khoảng cách hợp lệ");
            }
            return response.getRoutes().get(0).getLegs().get(0).getDistance();
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy chỉ đường từ Goong API: " + e.getMessage());
        }
    }


    public Object getLocation(String address) {
        // Xây dựng URL với query parameters và encode UTF-8
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/Place/AutoComplete")
                .queryParam("input", address)
                .queryParam("api_key", apiKey)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();


        try {
            // Gọi API và nhận response dưới dạng LocationResponse
            ResponseEntity<LocationResponse> responseEntity = restTemplate.getForEntity(uri, LocationResponse.class);
            LocationResponse response = responseEntity.getBody();
            
            // Trả về prediction đầu tiên nếu có
            if (response != null && response.getPredictions() != null && !response.getPredictions().isEmpty()) {
                return response.getPredictions();
            }
            
            return null;
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy dữ liệu địa điểm từ Goong API: " + e.getMessage());
        }
    }


    public Object getCoordinatesByLocation(String address) {
        // Xây dựng URL với query parameters và encode UTF-8
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/geocode")
                .queryParam("address", address)
                .queryParam("api_key", apiKey)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();


        try {
            // Gọi API và nhận response dưới dạng GeocodeResponse
            ResponseEntity<GeocodeResponse> responseEntity = restTemplate.getForEntity(uri, GeocodeResponse.class);
            GeocodeResponse response = responseEntity.getBody();
            
            // Trả về result đầu tiên nếu có
            if (response != null && response.getResults() != null && !response.getResults().isEmpty()) {
                GeocodeResponse.Result firstResult = response.getResults().get(0);
                if (firstResult.getGeometry() != null && firstResult.getGeometry().getLocation() != null) {
                    return firstResult;
                }
            }
            
            return null;
        } catch (Exception e) {
            throw new RuntimeException("Không thể lấy tọa độ từ Goong API: " + e.getMessage());
        }
    }

    public DistanceResponse.Leg.Distance calculationDistance(String origin, String destination, String vehicle) {
        // Lấy tọa độ origin
        GeocodeResponse.Result originResult = (GeocodeResponse.Result) getCoordinatesByLocation(origin);
        if (originResult == null || originResult.getGeometry() == null || originResult.getGeometry().getLocation() == null) {
            throw new RuntimeException("Không thể lấy tọa độ điểm đi: " + origin);
        }
        
        Double latOrigin = originResult.getGeometry().getLocation().getLat();
        Double lngOrigin = originResult.getGeometry().getLocation().getLng();
        
        // Lấy tọa độ destination
        GeocodeResponse.Result destinationResult = (GeocodeResponse.Result) getCoordinatesByLocation(destination);
        if (destinationResult == null || destinationResult.getGeometry() == null || destinationResult.getGeometry().getLocation() == null) {
            throw new RuntimeException("Không thể lấy tọa độ điểm đến: " + destination);
        }
        
        Double latDestination = destinationResult.getGeometry().getLocation().getLat();
        Double lngDestination = destinationResult.getGeometry().getLocation().getLng();
        
        // Tạo chuỗi origin và destination với format "lat,lng"
        String originCoords = latOrigin + "," + lngOrigin;
        String destinationCoords = latDestination + "," + lngDestination;
        
        // Gọi API Direction với tọa độ
        return getDistance(originCoords, destinationCoords, vehicle );
    }
}

