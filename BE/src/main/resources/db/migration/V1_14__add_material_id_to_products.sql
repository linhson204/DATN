ALTER TABLE products
    ADD COLUMN material_id CHAR(36) NULL;

ALTER TABLE products
    ADD CONSTRAINT fk_products_material
        FOREIGN KEY (material_id) REFERENCES material_dictionary(id)
        ON DELETE SET NULL;

CREATE INDEX idx_products_material_id ON products (material_id);
