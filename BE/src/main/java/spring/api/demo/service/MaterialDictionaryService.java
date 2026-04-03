package spring.api.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.material.request.MaterialDictionaryCreateRequest;
import spring.api.demo.dto.material.response.MaterialDictionaryResponse;
import spring.api.demo.entity.MaterialDictionary;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.MaterialDictionaryRepository;
import spring.api.demo.mapper.MaterialDictionaryMapper;

import java.util.List;

@Service
public class MaterialDictionaryService {

    private final MaterialDictionaryRepository materialDictionaryRepository;

    private final MaterialDictionaryMapper materialDictionaryMapper;

    public MaterialDictionaryService(MaterialDictionaryRepository materialDictionaryRepository, MaterialDictionaryMapper materialDictionaryMapper) {
        this.materialDictionaryRepository = materialDictionaryRepository;
        this.materialDictionaryMapper = materialDictionaryMapper;
    }

    @Transactional(readOnly = true)
    public List<MaterialDictionaryResponse> getAll() {
        return materialDictionaryRepository.findAll()
                .stream()
                .map(materialDictionaryMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MaterialDictionaryResponse getByCode(String code) {
        MaterialDictionary material = materialDictionaryRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.MATERIAL_NOT_FOUND));
        return materialDictionaryMapper.toResponse(material);
    }

    @Transactional
    public MaterialDictionaryResponse create(MaterialDictionaryCreateRequest request) {
        if (materialDictionaryRepository.existsByCode(request.getCode())) {
            throw new AppException(ErrorCode.MATERIAL_CODE_ALREADY_EXISTS);
        }

        MaterialDictionary material = materialDictionaryMapper.toNewEntity(request);
        MaterialDictionary saved = materialDictionaryRepository.save(material);
        return materialDictionaryMapper.toResponse(saved);
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

        materialDictionaryMapper.updateEntity(material, request);
        return materialDictionaryMapper.toResponse(material);
    }


    @Transactional
    public void delete(String code) {
        MaterialDictionary material = materialDictionaryRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.MATERIAL_NOT_FOUND));
        materialDictionaryRepository.delete(material);
    }

}
