ALTER TABLE cart_items
ADD COLUMN is_selected BOOLEAN NOT NULL DEFAULT TRUE AFTER quantity;

CREATE INDEX idx_cart_items_user_selected ON cart_items (user_id, is_selected);
