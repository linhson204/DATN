ALTER TABLE password_reset_otp
    ADD COLUMN type VARCHAR(30) NOT NULL DEFAULT 'FORGOT_PASSWORD';

CREATE INDEX idx_password_reset_otp_email_type ON password_reset_otp (email, type);
