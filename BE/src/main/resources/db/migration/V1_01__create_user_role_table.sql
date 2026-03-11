-- Tạo bảng roles
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE DEFAULT 'customer'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Dữ liệu mặc định
INSERT INTO roles (name) VALUES ('admin'), ('customer');

