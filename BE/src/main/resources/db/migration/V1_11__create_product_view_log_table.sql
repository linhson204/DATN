CREATE TABLE product_view_log (
    id          CHAR(36) NOT NULL PRIMARY KEY,
    user_id     CHAR(36) NOT NULL,
    product_id  CHAR(36) NOT NULL,
    view_type   VARCHAR(20) NOT NULL DEFAULT 'detail_view',
    duration_seconds INT NULL COMMENT 'Thời gian xem (giây) — implicit feedback quality signal cho AI',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_view_log_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_product_view_log_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_pvl_user_time ON product_view_log (user_id, created_at DESC);
CREATE INDEX idx_pvl_product ON product_view_log (product_id);
