-- Tạo bảng roles
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE DEFAULT 'customer'
);

-- Dữ liệu mặc định
INSERT INTO roles (name) VALUES ('admin'), ('customer');

