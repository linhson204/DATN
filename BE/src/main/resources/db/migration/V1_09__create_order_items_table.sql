CREATE TABLE order_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    variant_id CHAR(36) NOT NULL,
    product_id CHAR(36) NULL COMMENT 'FK trực tiếp tới product — dùng cho AI recommendation',
    product_name VARCHAR(255) NOT NULL,
    image_url VARCHAR(255),
    sku VARCHAR(64),
    size VARCHAR(30),
    color VARCHAR(50),
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INT NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_items_variant
        FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_order_items_line_total CHECK (line_total >= 0)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_variant_id ON order_items (variant_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
