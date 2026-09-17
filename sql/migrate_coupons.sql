-- Adds Discounts & Coupons to an existing database.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS + guarded ALTERs below).
-- Usage: mysql -u root -p bakery_db < sql/migrate_coupons.sql

CREATE TABLE IF NOT EXISTS coupons (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  description VARCHAR(200) DEFAULT '',
  -- 'percent'  -> discount_value is a % off the subtotal (e.g. 10 = 10% off)
  -- 'fixed'    -> discount_value is a flat ₹ amount off the subtotal
  discount_type ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Cart subtotal must be at least this much for the code to apply at all.
  min_order_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Only meaningful for discount_type='percent' — caps the ₹ discount so a
  -- "20% off" coupon can't blow out on a huge order. NULL = no cap.
  max_discount_amount DECIMAL(10,2) NULL,
  -- Total number of times this code can EVER be redeemed, across all
  -- customers combined. NULL = unlimited.
  usage_limit INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  -- How many times ONE customer account may redeem this code. NULL = unlimited
  -- (still counts toward usage_limit above). Doesn't apply to walk-in/POS
  -- orders with no linked customer account.
  per_customer_limit INT NULL,
  valid_from DATE NULL,
  valid_until DATE NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  -- When set, this coupon is advertised to customers as a "Welcome Offer"
  -- (banner on New Order + a popup after login) until they place an order
  -- using it.
  is_welcome TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_coupon_code (code)
) ENGINE=InnoDB;

SET @col_exists2 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupons' AND COLUMN_NAME = 'is_welcome'
);
SET @sql2 := IF(@col_exists2 = 0,
  'ALTER TABLE coupons ADD COLUMN is_welcome TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- "Special Day Sale" coupons: when auto_apply is on, the discount is applied
-- automatically to every customer's cart the moment it's non-empty — no code
-- needs to be typed in. Used for festival/site-wide sale days.
SET @col_exists3 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupons' AND COLUMN_NAME = 'auto_apply'
);
SET @sql3 := IF(@col_exists3 = 0,
  'ALTER TABLE coupons ADD COLUMN auto_apply TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- Adds coupon/discount tracking to each order. Wrapped so re-running this
-- file is safe even after the columns already exist.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'coupon_code'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(30) DEFAULT NULL, ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
