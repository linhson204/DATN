CREATE TABLE material_dictionary (
    id                  CHAR(36) NOT NULL PRIMARY KEY,
    code                VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL,
    quality_score       INT NOT NULL DEFAULT 50,
    breathability_score INT NOT NULL DEFAULT 50,
    durability_score    INT NOT NULL DEFAULT 50,
    softness_score      INT NOT NULL DEFAULT 50,
    warmth_score        INT NOT NULL DEFAULT 50,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_material_dictionary_code ON material_dictionary (code);
