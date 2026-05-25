ALTER TABLE orders
    ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'COD' AFTER total_amount,
    ADD COLUMN payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID' AFTER payment_method,
    ADD COLUMN payment_app_trans_id VARCHAR(100) NULL AFTER payment_status,
    ADD COLUMN payment_transaction_id VARCHAR(100) NULL AFTER payment_app_trans_id;

CREATE UNIQUE INDEX uq_orders_payment_app_trans_id ON orders (payment_app_trans_id);