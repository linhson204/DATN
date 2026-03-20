package spring.api.demo.dto.goong.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class GeocodeResponse {
    
    @JsonProperty("results")
    private List<Result> results;
    
    @JsonProperty("status")
    private String status;

    @Data
    public static class Result {
        
        @JsonProperty("formatted_address")
        private String formattedAddress;
        
        @JsonProperty("geometry")
        private Geometry geometry;
        
    }
    
    
    @Data
    public static class Geometry {
        @JsonProperty("location")
        private Location location;
        
        @JsonProperty("location_type")
        private String locationType;
        
    }
    
    @Data
    public static class Location {
        @JsonProperty("lat")
        private Double lat;
        
        @JsonProperty("lng")
        private Double lng;
    }
    
}
