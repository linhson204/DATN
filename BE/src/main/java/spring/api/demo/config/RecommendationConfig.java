package spring.api.demo.config;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "recommendation")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecommendationConfig {

    /**
     * ± Tỉ lệ phần trăm về giá để coi sản phẩm là tương tự (ví dụ: 30% nghĩa là sản phẩm có giá trong khoảng 70% đến 130% của sản phẩm gốc sẽ được coi là tương tự).
     */
    int priceRangePercent = 20;

    /**
     * Ứng viên tối đa lấy từ mỗi nguồn (ví dụ: co-view, cluster, content-based) trước khi gộp và lọc.
     */
    int candidatesPerSource = 10;

    /**
     * Tổng số ứng viên tối đa sau khi gộp từ tất cả các nguồn để đưa vào bước xếp hạng cuối cùng. (Ví dụ: nếu đặt là 50, thì dù có bao nhiêu ứng viên từ các nguồn, chỉ chọn 50 ứng viên có điểm cao nhất để xếp hạng và hiển thị).
     */
    int maxTotalCandidates = 10;

    /**
     * Số ngày cần xem xét dữ liệu co-view (nguồn cluster).
     */
    int clusterLookbackDays = 10;

    /**
     * Chênh lệch điểm tối đa giữa các nguồn để coi sản phẩm 
     * là tương tự (ví dụ: nếu đặt là 10, thì sản phẩm có điểm 
     * chênh lệch trong khoảng ±10 điểm so với sản phẩm gốc sẽ được 
     * coi là tương tự). Điểm này có thể dựa trên một thang điểm từ 0 đến 100, 
     * hoặc bất kỳ thang điểm nào mà hệ thống xếp hạng sử dụng.
     */
    int materialScoreTolerance = 10;
}
