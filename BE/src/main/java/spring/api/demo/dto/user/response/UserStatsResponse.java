package spring.api.demo.dto.user.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserStatsResponse {
    private String userId;
    private String username;
    private String fullName;

    /** Số lần xem sản phẩm theo articleType */
    private List<CategoryStatItem> viewStats;

    /** Số item trong giỏ hàng theo articleType */
    private List<CategoryStatItem> cartStats;

    /** Tổng số lượng sản phẩm đã đặt theo articleType (SUM quantity) */
    private List<CategoryStatItem> orderStats;

    /** Số sản phẩm yêu thích theo articleType */
    private List<CategoryStatItem> wishlistStats;
}
