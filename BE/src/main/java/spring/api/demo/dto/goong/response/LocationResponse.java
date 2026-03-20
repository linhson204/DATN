package spring.api.demo.dto.goong.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class LocationResponse {
    
    @JsonProperty("predictions")
    private List<Prediction> predictions;
    

    @Data
    public static class Prediction {
        @JsonProperty("description")
        private String description;
        
        @JsonProperty("place_id")
        private String placeId;
        
        @JsonProperty("compound")
        private Compound compound;
        
        @JsonProperty("structured_formatting")
        private StructuredFormatting structuredFormatting;
        
    }
    
    @Data
    public static class Compound {
        @JsonProperty("district")
        private String district; // Quận/Huyện
        
        @JsonProperty("commune")
        private String commune; // Xã/Phường
        
        @JsonProperty("province")
        private String province; // Tỉnh/Thành phố
    }
    
    @Data
    public static class MatchedSubstring {
        @JsonProperty("length")
        private Integer length;
        
        @JsonProperty("offset")
        private Integer offset;
    }
    
    @Data
    public static class StructuredFormatting {
        @JsonProperty("main_text")
        private String mainText;
        
        @JsonProperty("secondary_text")
        private String secondaryText;
        
        @JsonProperty("main_text_matched_substrings")
        private List<MatchedSubstring> mainTextMatchedSubstrings;
    }

}
