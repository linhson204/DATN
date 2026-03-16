CREATE TABLE product_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO product_categories (id, code, name, status)
VALUES
    (UUID(), 'clothing', 'Quan ao', TRUE),
    (UUID(), 'footwear', 'Giay dep', TRUE),
    (UUID(), 'accessory', 'Phu kien', TRUE);

CREATE TABLE products (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(150),
    category_id CHAR(36) NOT NULL,
    target_gender VARCHAR(20) NOT NULL,
    description TEXT,
    original_price DECIMAL(12,2) NOT NULL,
    sale_price DECIMAL(12,2) NOT NULL,
    total_stock INT NOT NULL DEFAULT 0,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES product_categories(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_target_gender ON products (target_gender);
CREATE INDEX idx_products_created_at ON products (created_at);