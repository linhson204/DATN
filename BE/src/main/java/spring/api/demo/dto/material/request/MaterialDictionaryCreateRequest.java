package spring.api.demo.dto.material.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MaterialDictionaryCreateRequest {

    @NotBlank(message = "Mã chất liệu không được để trống")
    @Size(max = 50, message = "Mã chất liệu tối đa 50 ký tự")
    String code;

    @NotBlank(message = "Tên chất liệu không được để trống")
    @Size(max = 120, message = "Tên chất liệu tối đa 120 ký tự")
    String name;

    @Min(value = 0, message = "Điểm chất lượng phải từ 0 đến 100")
    @Max(value = 100, message = "Điểm chất lượng phải từ 0 đến 100")
    @Builder.Default
    Integer qualityScore = 50;

    @Min(value = 0, message = "Điểm thoáng khí phải từ 0 đến 100")
    @Max(value = 100, message = "Điểm thoáng khí phải từ 0 đến 100")
    @Builder.Default
    Integer breathabilityScore = 50;

    @Min(value = 0, message = "Điểm bền phải từ 0 đến 100")
    @Max(value = 100, message = "Điểm bền phải từ 0 đến 100")
    @Builder.Default
    Integer durabilityScore = 50;

    @Min(value = 0, message = "Điểm mềm mại phải từ 0 đến 100")
    @Max(value = 100, message = "Điểm mềm mại phải từ 0 đến 100")
    @Builder.Default
    Integer softnessScore = 50;

    @Min(value = 0, message = "Điểm giữ ấm phải từ 0 đến 100")
    @Max(value = 100, message = "Điểm giữ ấm phải từ 0 đến 100")
    @Builder.Default
    Integer warmthScore = 50;
}
