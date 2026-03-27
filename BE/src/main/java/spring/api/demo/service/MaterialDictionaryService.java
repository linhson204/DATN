package spring.api.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.material.request.MaterialDictionaryCreateRequest;
import spring.api.demo.dto.material.response.MaterialDictionaryResponse;
import spring.api.demo.entity.MaterialDictionary;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.MaterialDictionaryRepository;

import java.util.List;

@Service
public class MaterialDictionaryService {

    private final MaterialDictionaryRepository materialDictionaryRepository;

    public MaterialDictionaryService(MaterialDictionaryRepository materialDictionaryRepository) {
        this.materialDictionaryRepository = materialDictionaryRepository;
    }

    @Transactional(readOnly = true)
    public List<MaterialDictionaryResponse> getAll() {
        return materialDictionaryRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MaterialDictionaryResponse getByCode(String code) {
        MaterialDictionary material = materialDictionaryRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.MATERIAL_NOT_FOUND));
        return toResponse(material);
    }

    @Transactional
    public MaterialDictionaryResponse create(MaterialDictionaryCreateRequest request) {
        if (materialDictionaryRepository.existsByCode(request.getCode())) {
            throw new AppException(ErrorCode.MATERIAL_CODE_ALREADY_EXISTS);
        }

        MaterialDictionary material = MaterialDictionary.builder()
                .code(request.getCode().toLowerCase().trim())
                .name(request.getName().trim())
                .qualityScore(request.getQualityScore())
                .breathabilityScore(request.getBreathabilityScore())
                .durabilityScore(request.getDurabilityScore())
                .softnessScore(request.getSoftnessScore())
                .warmthScore(request.getWarmthScore())
                .build();

        MaterialDictionary saved = materialDictionaryRepository.save(material);
        return toResponse(saved);
    }

    @Transactional
    public MaterialDictionaryResponse update(String code, MaterialDictionaryCreateRequest request) {
        MaterialDictionary material = materialDictionaryRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.MATERIAL_NOT_FOUND));

        // If code is being changed, check uniqueness
        if (!material.getCode().equals(request.getCode().toLowerCase().trim())
                && materialDictionaryRepository.existsByCode(request.getCode().toLowerCase().trim())) {
            throw new AppException(ErrorCode.MATERIAL_CODE_ALREADY_EXISTS);
        }

        material.setCode(request.getCode().toLowerCase().trim());
        material.setName(request.getName().trim());
        material.setQualityScore(request.getQualityScore());
        material.setBreathabilityScore(request.getBreathabilityScore());
        material.setDurabilityScore(request.getDurabilityScore());
        material.setSoftnessScore(request.getSoftnessScore());
        material.setWarmthScore(request.getWarmthScore());

        MaterialDictionary saved = materialDictionaryRepository.save(material);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String code) {
        MaterialDictionary material = materialDictionaryRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.MATERIAL_NOT_FOUND));
        materialDictionaryRepository.delete(material);
    }

    private MaterialDictionaryResponse toResponse(MaterialDictionary material) {
        return MaterialDictionaryResponse.builder()
                .id(material.getId())
                .code(material.getCode())
                .name(material.getName())
                .qualityScore(material.getQualityScore())
                .breathabilityScore(material.getBreathabilityScore())
                .durabilityScore(material.getDurabilityScore())
                .softnessScore(material.getSoftnessScore())
                .warmthScore(material.getWarmthScore())
                .createdAt(material.getCreatedAt())
                .build();
    }
}
