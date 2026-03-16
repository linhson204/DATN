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
}
