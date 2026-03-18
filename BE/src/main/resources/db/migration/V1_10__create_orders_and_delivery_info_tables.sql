CREATE TABLE delivery_infos (
    id CHAR(36) NOT NULL PRIMARY KEY,
    recipient_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    address VARCHAR(500) NOT NULL,
    delivery_method VARCHAR(100) NOT NULL,
    delivery_time VARCHAR(100) NOT NULL,
    delivery_instructions VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE orders (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    delivery_info_id CHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL,
    shipping_fee DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_orders_delivery_info
        FOREIGN KEY (delivery_info_id) REFERENCES delivery_infos(id),
    CONSTRAINT uq_orders_delivery_info UNIQUE (delivery_info_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at);
