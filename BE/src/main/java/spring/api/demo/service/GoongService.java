package spring.api.demo.service;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import spring.api.demo.dto.goong.response.DistanceResponse;
import spring.api.demo.dto.goong.response.GeocodeResponse;
import spring.api.demo.dto.goong.response.LocationResponse;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;

import java.net.URI;
import java.nio.charset.StandardCharsets;

@Service
public class GoongService {

    @Value("${goong.api.base-url}")
    private String baseUrl;

    @Value("${goong.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public GoongService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public DistanceResponse.Leg.Distance getDistance(String origin, String destination, String vehicle) {
        URI url = UriComponentsBuilder.fromUriString(baseUrl + "/Direction")
                .queryParam("origin", origin)
                .queryParam("destination", destination)
                .queryParam("vehicle", vehicle)
                .queryParam("api_key", apiKey)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            DistanceResponse response = restTemplate.getForObject(url, DistanceResponse.class);
            if (response == null
                    || response.getRoutes() == null
                    || response.getRoutes().isEmpty()
                    || response.getRoutes().get(0).getLegs() == null
                    || response.getRoutes().get(0).getLegs().isEmpty()) {
                throw new AppException(ErrorCode.GOONG_API_ERROR);
            }
            return response.getRoutes().get(0).getLegs().get(0).getDistance();
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.GOONG_API_ERROR);
        }
    }

    public Object getLocation(String address) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl + "/Place/AutoComplete")
                .queryParam("input", address)
                .queryParam("api_key", apiKey)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            ResponseEntity<LocationResponse> responseEntity = restTemplate.getForEntity(uri, LocationResponse.class);
            LocationResponse response = responseEntity.getBody();

            if (response != null && response.getPredictions() != null && !response.getPredictions().isEmpty()) {
                return response.getPredictions();
            }

            return null;
        } catch (Exception e) {
            throw new AppException(ErrorCode.GOONG_API_ERROR);
        }
    }

    public Object getCoordinatesByLocation(String address) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl + "/geocode")
                .queryParam("address", address)
                .queryParam("api_key", apiKey)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            ResponseEntity<GeocodeResponse> responseEntity = restTemplate.getForEntity(uri, GeocodeResponse.class);
            GeocodeResponse response = responseEntity.getBody();

            if (response != null && response.getResults() != null && !response.getResults().isEmpty()) {
                GeocodeResponse.Result firstResult = response.getResults().get(0);
                if (firstResult.getGeometry() != null && firstResult.getGeometry().getLocation() != null) {
                    return firstResult;
                }
            }

            return null;
        } catch (Exception e) {
            throw new AppException(ErrorCode.GOONG_API_ERROR);
        }
    }

    public DistanceResponse.Leg.Distance calculationDistance(String origin, String destination, String vehicle) {
        GeocodeResponse.Result originResult = (GeocodeResponse.Result) getCoordinatesByLocation(origin);
        if (originResult == null || originResult.getGeometry() == null || originResult.getGeometry().getLocation() == null) {
            throw new AppException(ErrorCode.GOONG_API_ERROR);
        }

        Double latOrigin = originResult.getGeometry().getLocation().getLat();
        Double lngOrigin = originResult.getGeometry().getLocation().getLng();

        GeocodeResponse.Result destinationResult = (GeocodeResponse.Result) getCoordinatesByLocation(destination);
        if (destinationResult == null || destinationResult.getGeometry() == null || destinationResult.getGeometry().getLocation() == null) {
            throw new AppException(ErrorCode.GOONG_API_ERROR);
        }

        Double latDestination = destinationResult.getGeometry().getLocation().getLat();
        Double lngDestination = destinationResult.getGeometry().getLocation().getLng();

        String originCoords = latOrigin + "," + lngOrigin;
        String destinationCoords = latDestination + "," + lngDestination;

        return getDistance(originCoords, destinationCoords, vehicle);
    }
}
