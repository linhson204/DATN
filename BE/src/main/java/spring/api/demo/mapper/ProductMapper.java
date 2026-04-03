package spring.api.demo.mapper;

import org.springframework.stereotype.Component;
import spring.api.demo.dto.material.response.MaterialDictionaryResponse;
import spring.api.demo.dto.product.request.ProductAttributeUpsertRequest;
import spring.api.demo.dto.product.request.ProductCreateAndUpdateRequest;
import spring.api.demo.dto.product.request.ProductVariantUpsertRequest;
import spring.api.demo.dto.product.response.ProductAttributeResponse;
import spring.api.demo.dto.product.response.ProductResponse;
import spring.api.demo.dto.product.response.ProductVariantResponse;
import spring.api.demo.entity.MaterialDictionary;
import spring.api.demo.entity.Product;
import spring.api.demo.entity.ProductAttribute;
import spring.api.demo.entity.ProductCategory;
import spring.api.demo.entity.ProductVariant;

import java.util.ArrayList;
import java.util.List;

@Component
public class ProductMapper {

    private final ProductCategoryMapper productCategoryMapper;

    public ProductMapper(ProductCategoryMapper productCategoryMapper) {
        this.productCategoryMapper = productCategoryMapper;
    }

    public Product toNewEntity(ProductCreateAndUpdateRequest request, ProductCategory category, MaterialDictionary material) {
        Product product = Product.builder()
                .name(request.getName())
                .brand(request.getBrand())
                .category(category)
                .material(material)
                .targetGender(request.getTargetGender())
                .description(request.getDescription())
                .originalPrice(request.getOriginalPrice())
                .salePrice(request.getSalePrice())
                .totalStock(0)
                .status(request.getStatus() == null ? Boolean.TRUE : request.getStatus())
                .attributes(new ArrayList<>())
                .variants(new ArrayList<>())
                .build();
        replaceAttributes(product, request.getAttributes());
        replaceVariants(product, request.getVariants());
        return product;
    }

    public void updateEntity(Product product, ProductCreateAndUpdateRequest request, ProductCategory category, MaterialDictionary material) {
        product.setName(request.getName());
        product.setBrand(request.getBrand());
        product.setCategory(category);
        product.setMaterial(material);
        product.setTargetGender(request.getTargetGender());
        product.setDescription(request.getDescription());
        product.setOriginalPrice(request.getOriginalPrice());
        product.setSalePrice(request.getSalePrice());
        product.setStatus(request.getStatus() == null ? product.getStatus() : request.getStatus());
        replaceAttributes(product, request.getAttributes());
        replaceVariants(product, request.getVariants());
    }

    public ProductResponse toResponse(Product product) {
        MaterialDictionaryResponse materialResponse = null;
        if (product.getMaterial() != null) {
            materialResponse = toMaterialResponse(product.getMaterial());
        }

        return ProductResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .brand(product.getBrand())
                .category(productCategoryMapper.toResponse(product.getCategory()))
                .material(materialResponse)
                .targetGender(product.getTargetGender())
                .description(product.getDescription())
                .originalPrice(product.getOriginalPrice())
                .salePrice(product.getSalePrice())
                .totalStock(product.getTotalStock())
                .status(product.getStatus())
                .attributes(product.getAttributes().stream()
                        .map(this::toAttributeResponse)
                        .toList())
                .variants(product.getVariants().stream()
                    .map(this::toVariantResponse)
                    .toList())
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    private MaterialDictionaryResponse toMaterialResponse(MaterialDictionary material) {
        return MaterialDictionaryResponse.builder()
                .id(material.getId())
                .code(material.getCode())
                .name(material.getName())
                .qualityScore(material.getQualityScore())
                .createdAt(material.getCreatedAt())
                .build();
    }

    public void replaceAttributes(Product product, List<ProductAttributeUpsertRequest> attributes) {
        product.getAttributes().clear();
        for (ProductAttributeUpsertRequest request : attributes) {
            ProductAttribute attribute = ProductAttribute.builder()
                    .product(product)
                    .attributeKey(request.getAttributeKey())
                    .attributeValue(request.getAttributeValue())
                    .build();
            product.getAttributes().add(attribute);
        }
    }

    public void replaceVariants(Product product, List<ProductVariantUpsertRequest> variants) {
        product.getVariants().clear();
        int totalStock = 0;
        for (ProductVariantUpsertRequest request : variants) {
            ProductVariant variant = ProductVariant.builder()
                    .product(product)
                    .sku(request.getSku())
                    .size(request.getSize())
                    .color(request.getColor())
                    .stockQuantity(request.getStockQuantity())
                    .originalPrice(request.getOriginalPrice())
                    .salePrice(request.getSalePrice())
                    .status(request.getStatus() == null ? Boolean.TRUE : request.getStatus())
                    .build();
            product.getVariants().add(variant);
            totalStock += variant.getStockQuantity();
        }
        product.setTotalStock(totalStock);
    }

    private ProductAttributeResponse toAttributeResponse(ProductAttribute attribute) {
        return ProductAttributeResponse.builder()
                .attributeKey(attribute.getAttributeKey())
                .attributeValue(attribute.getAttributeValue())
                .build();
    }

    private ProductVariantResponse toVariantResponse(ProductVariant variant) {
        return ProductVariantResponse.builder()
                .id(variant.getId())
                .sku(variant.getSku())
                .size(variant.getSize())
                .color(variant.getColor())
                .stockQuantity(variant.getStockQuantity())
                .originalPrice(variant.getOriginalPrice())
                .salePrice(variant.getSalePrice())
                .status(variant.getStatus())
                .build();
    }
}
