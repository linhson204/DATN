package spring.api.demo.dto.goong.response;
import lombok.Data;

import java.util.List;

@Data
public class DistanceResponse {
    private List<Route> routes;

    @Data
    public static class Route {
        private List<Leg> legs;
    }

    @Data
    public static class Leg {
        private Distance distance;

        @Data
        public static class Distance {
            private String text;
            private Integer value;
        }
    }
}
