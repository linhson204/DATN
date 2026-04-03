package spring.api.demo.mapper;

import org.springframework.stereotype.Component;

import spring.api.demo.dto.material.request.MaterialDictionaryCreateRequest;
import spring.api.demo.dto.material.response.MaterialDictionaryResponse;
import spring.api.demo.entity.MaterialDictionary;

@Component
public class MaterialDictionaryMapper {
    public MaterialDictionary toNewEntity(MaterialDictionaryCreateRequest request) {
        return MaterialDictionary.builder()
                .code(request.getCode().toLowerCase().trim())
                .name(request.getName().trim())
                .qualityScore(request.getQualityScore())
                .build();
    }


    public void updateEntity(MaterialDictionary material, MaterialDictionaryCreateRequest request) {
        material.setCode(request.getCode().toLowerCase().trim());
        material.setName(request.getName().trim());
        material.setQualityScore(request.getQualityScore());
    }

    public MaterialDictionaryResponse toResponse(MaterialDictionary material) {
        return MaterialDictionaryResponse.builder()
                .id(material.getId())
                .code(material.getCode())
                .name(material.getName())
                .qualityScore(material.getQualityScore())
                .createdAt(material.getCreatedAt())
                .build();
    }
}
