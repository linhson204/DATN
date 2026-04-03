package spring.api.demo.dto.recommendation;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import spring.api.demo.entity.Product;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CandidateDTO {

    UUID productId;
    String productName;
    String brand;
    String articleType;
    Product.TargetGender targetGender;
    BigDecimal salePrice;
    String materialCode;
    Integer materialQualityScore;
    Integer totalStock;
    Boolean status;

    @Builder.Default
    Set<String> sources = new LinkedHashSet<>();
}
