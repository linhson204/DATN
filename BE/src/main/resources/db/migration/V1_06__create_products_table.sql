-- Tạo bảng product_categories

CREATE TABLE product_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    master_category VARCHAR(120) NOT NULL,
    sub_category VARCHAR(120) NOT NULL,
    article_type VARCHAR(100) NOT NULL UNIQUE,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Tạo bảng products
CREATE TABLE products (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(150),
    image_url VARCHAR(255),
    category_id CHAR(36) NOT NULL,
    target_gender VARCHAR(20) NOT NULL,
    description TEXT,
    original_price DECIMAL(12,2) NOT NULL,
    sale_price DECIMAL(12,2) NOT NULL,
    total_stock INT NOT NULL DEFAULT 0,
    material_id CHAR(36) NOT NULL,
    view_count INT NOT NULL DEFAULT 0 COMMENT 'Tổng lượt xem — popularity signal cho AI',
    purchase_count INT NOT NULL DEFAULT 0 COMMENT 'Tổng lượt mua — strong positive signal',
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES product_categories(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_target_gender ON products (target_gender);
CREATE INDEX idx_products_created_at ON products (created_at);
CREATE INDEX idx_products_view_count ON products (view_count DESC);
CREATE INDEX idx_products_purchase_count ON products (purchase_count DESC);


-- Tạo bảng wishlist (explicit positive feedback cho AI)
CREATE TABLE wishlist (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    user_id     CHAR(36)    NOT NULL,
    product_id  CHAR(36)    NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wishlist_user
        FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT uq_wishlist_user_product
        UNIQUE (user_id, product_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_wishlist_user_id    ON wishlist (user_id);
CREATE INDEX idx_wishlist_product_id ON wishlist (product_id);


-- Tạo bảng product_attributes

CREATE TABLE product_attributes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    product_id CHAR(36) NOT NULL,
    attribute_key VARCHAR(100) NOT NULL,
    attribute_value VARCHAR(255) NOT NULL,
    CONSTRAINT fk_product_attributes_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_product_attributes_product_id ON product_attributes (product_id);
CREATE INDEX idx_product_attributes_key ON product_attributes (attribute_key);



-- Tạo bảng product_variants
CREATE TABLE product_variants (
    id CHAR(36) NOT NULL PRIMARY KEY,
    product_id CHAR(36) NOT NULL,
    sku VARCHAR(64),
    image_url VARCHAR(255),
    size VARCHAR(30),
    color VARCHAR(50),
    stock_quantity INT NOT NULL DEFAULT 0,
    original_price DECIMAL(12,2) NOT NULL,
    sale_price DECIMAL(12,2) NOT NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_product_variants_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX idx_product_variants_sku ON product_variants (sku);
CREATE INDEX idx_product_variants_size ON product_variants (size);


-- Tạo bảng material_dictionary
CREATE TABLE material_dictionary (
    id                  CHAR(36) NOT NULL PRIMARY KEY,
    code                VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL,
    quality_score       INT NOT NULL DEFAULT 50,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_material_dictionary_code ON material_dictionary (code);


-- Tạo bảng đánh giá sản phẩm
CREATE TABLE product_reviews (
    id          CHAR(36)        NOT NULL,
    user_id     CHAR(36)        NOT NULL,
    product_id  CHAR(36)        NOT NULL,
    rating      TINYINT         NOT NULL COMMENT 'Số sao đánh giá: 1–5',
    comment     TEXT            NULL     COMMENT 'Nội dung bình luận (tuỳ chọn)',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    -- Mỗi user chỉ được đánh giá 1 lần trên mỗi sản phẩm
    CONSTRAINT uq_review_user_product UNIQUE (user_id, product_id),

    CONSTRAINT fk_review_user
        FOREIGN KEY (user_id)    REFERENCES users    (id) ON DELETE CASCADE,

    CONSTRAINT fk_review_product
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,

    CONSTRAINT chk_review_rating
        CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Index để query nhanh theo product (lấy danh sách review + tính avg)
CREATE INDEX idx_review_product_id ON product_reviews (product_id);

-- Index để query nhanh theo user (kiểm tra user đã review chưa)
CREATE INDEX idx_review_user_id    ON product_reviews (user_id);