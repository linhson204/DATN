package spring.api.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import spring.api.demo.dto.common.PageResponse;
import spring.api.demo.dto.product.request.ProductCreateAndUpdateRequest;
import spring.api.demo.dto.product.response.ProductResponse;
import spring.api.demo.entity.MaterialDictionary;
import spring.api.demo.entity.Product;
import spring.api.demo.entity.ProductCategory;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.mapper.ProductMapper;
import spring.api.demo.repository.MaterialDictionaryRepository;
import spring.api.demo.repository.ProductCategoryRepository;
import spring.api.demo.repository.ProductRepository;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

@Service
public class ProductService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "createdAt", "updatedAt", "name", "salePrice", "originalPrice", "totalStock"
    );

    private final ProductRepository productRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final MaterialDictionaryRepository materialDictionaryRepository;
    private final ProductMapper productMapper;

    public ProductService(
            ProductRepository productRepository,
            ProductCategoryRepository productCategoryRepository,
            MaterialDictionaryRepository materialDictionaryRepository,
            ProductMapper productMapper
    ) {
        this.productRepository = productRepository;
        this.productCategoryRepository = productCategoryRepository;
        this.materialDictionaryRepository = materialDictionaryRepository;
        this.productMapper = productMapper;
    }

    @Transactional
    public ProductResponse create(ProductCreateAndUpdateRequest request) {
        ProductCategory category = getCategoryByCode(request.getCategoryCode());
        MaterialDictionary material = getMaterialByCode(request.getMaterialCode());

        Product product = productMapper.toNewEntity(request, category, material);

        Product saved = productRepository.save(product);
        return productMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> getAll(
            int page,
            int size,
            String sortBy,
            String sortDir,
            String name,
            String categoryCode,
            BigDecimal minPrice,
            BigDecimal maxPrice
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        String safeSortBy = ALLOWED_SORT_FIELDS.contains(sortBy) ? sortBy : "createdAt";
        Sort sort = "asc".equalsIgnoreCase(sortDir)
            ? Sort.by(safeSortBy).ascending()
            : Sort.by(safeSortBy).descending();

        String safeName = normalizeFilterValue(name);
        String safeCategoryCode = normalizeFilterValue(categoryCode);

        Pageable pageable = PageRequest.of(safePage, safeSize, sort);
        Page<ProductResponse> pageResult = productRepository.search(
                safeName,
                safeCategoryCode,
                minPrice,
                maxPrice,
                pageable
        )
            .map(productMapper::toResponse);
        return PageResponse.fromPage(pageResult);
    }

    @Transactional(readOnly = true)
    public ProductResponse getById(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        return productMapper.toResponse(product);
    }

    @Transactional
    public ProductResponse update(UUID id, ProductCreateAndUpdateRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
        ProductCategory category = getCategoryByCode(request.getCategoryCode());
        MaterialDictionary material = getMaterialByCode(request.getMaterialCode());

        productMapper.updateEntity(product, request, category, material);

        Product updated = productRepository.save(product);
        return productMapper.toResponse(updated);
    }

    @Transactional
    public void delete(UUID id) {
        if (!productRepository.existsById(id)) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND);
        }
        productRepository.deleteById(id);
    }

    private ProductCategory getCategoryByCode(String categoryCode) {
        return productCategoryRepository.findByCode(categoryCode)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
    }

    private MaterialDictionary getMaterialByCode(String materialCode) {
        if (materialCode == null || materialCode.trim().isEmpty()) {
            return null;
        }
        return materialDictionaryRepository.findByCode(materialCode.trim().toLowerCase())
                .orElseThrow(() -> new AppException(ErrorCode.MATERIAL_NOT_FOUND));
    }

    private String normalizeFilterValue(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}