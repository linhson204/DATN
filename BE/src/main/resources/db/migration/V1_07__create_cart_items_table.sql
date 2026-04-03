CREATE TABLE cart_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    variant_id CHAR(36) NOT NULL,
    quantity INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cart_items_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_cart_items_variant
        FOREIGN KEY (variant_id) REFERENCES product_variants(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_cart_items_user_variant UNIQUE (user_id, variant_id),
    CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_cart_items_user_id ON cart_items (user_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items (variant_id);
