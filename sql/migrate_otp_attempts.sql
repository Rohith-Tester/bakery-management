-- Adds attempt counters for the delivery-confirmation OTP (orders) and
-- return pickup OTP (returns), so guessing a 4-digit OTP is capped instead
-- of unlimited (see OTP_MAX_ATTEMPTS in api/_bootstrap.php). Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_otp_attempts.sql

USE bakery_db;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_otp_attempts'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN delivery_otp_attempts INT NOT NULL DEFAULT 0 AFTER delivery_otp',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'returns' AND COLUMN_NAME = 'pickup_otp_attempts'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE returns ADD COLUMN pickup_otp_attempts INT NOT NULL DEFAULT 0 AFTER pickup_otp',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
