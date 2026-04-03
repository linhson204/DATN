-- Tạo bảng users
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    address TEXT,
    gender VARCHAR(10) NULL COMMENT 'male | female | other',
    birth_year SMALLINT NULL COMMENT 'Năm sinh — dùng để tính nhóm tuổi cho AI',
    role_id INT,
    status BOOLEAN DEFAULT TRUE,
    points INT DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,
    total_purchase DECIMAL(14,2) DEFAULT 0,
    membership_level VARCHAR(20) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;