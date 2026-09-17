-- Adds a delivery charge amount to orders. A flat delivery charge is
-- applied automatically when a customer books home delivery AND pays
-- online (see api/orders.php DELIVERY_CHARGE constant) -- cash/offline and
-- store-pickup orders are unaffected. Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_delivery_charge.sql

USE bakery_db;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_charge'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN delivery_charge DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
