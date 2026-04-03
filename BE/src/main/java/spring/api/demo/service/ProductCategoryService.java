package spring.api.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.api.demo.dto.product.response.ProductCategoryResponse;
import spring.api.demo.mapper.ProductCategoryMapper;
import spring.api.demo.repository.ProductCategoryRepository;

import java.util.List;

@Service
public class ProductCategoryService {

    private final ProductCategoryRepository productCategoryRepository;
    private final ProductCategoryMapper productCategoryMapper;

    public ProductCategoryService(
            ProductCategoryRepository productCategoryRepository,
            ProductCategoryMapper productCategoryMapper
    ) {
        this.productCategoryRepository = productCategoryRepository;
        this.productCategoryMapper = productCategoryMapper;
    }

    @Transactional(readOnly = true)
    public List<ProductCategoryResponse> getAll() {
        return productCategoryRepository.findAll().stream()
                .filter(category -> Boolean.TRUE.equals(category.getStatus()))
                .map(productCategoryMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> getMasterCategories() {
        return productCategoryRepository.findDistinctActiveMasterCategories();
    }

    @Transactional(readOnly = true)
    public List<String> getSubCategoriesByMasterCategory(String masterCategory) {
        String normalizedMasterCategory = normalizeCategoryValue(masterCategory);
        if (normalizedMasterCategory == null) {
            return List.of();
        }
        return productCategoryRepository.findDistinctActiveSubCategoriesByMasterCategory(normalizedMasterCategory);
    }

    @Transactional(readOnly = true)
    public List<String> getArticleTypesBySubCategory(String subCategory) {
        String normalizedSubCategory = normalizeCategoryValue(subCategory);
        if (normalizedSubCategory == null) {
            return List.of();
        }
        return productCategoryRepository.findActiveArticleTypesBySubCategory(normalizedSubCategory);
    }

    private String normalizeCategoryValue(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}
