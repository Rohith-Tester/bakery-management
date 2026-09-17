-- Extends restock_alerts with a full acknowledge -> dispatch -> receive -> resolve
-- workflow so a supplier restock alert tracks an actual delivery, not just a status.
-- Safe to run more than once.
-- Usage: mysql -u root -p bakery_db < sql/migrate_restock_delivery_tracking.sql

USE bakery_db;

-- Widen the status enum to include the two new in-between states.
-- (MySQL 5.7-safe: check information_schema before altering.)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restock_alerts' AND COLUMN_NAME = 'status'
    AND COLUMN_TYPE LIKE '%dispatched%'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE restock_alerts MODIFY COLUMN status ENUM('open','acknowledged','dispatched','received','resolved') NOT NULL DEFAULT 'open'",
  "SELECT 'status enum already widened'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restock_alerts' AND COLUMN_NAME = 'delivery_partner'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE restock_alerts ADD COLUMN delivery_partner VARCHAR(150) NULL AFTER notes",
  "SELECT 'delivery_partner exists'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restock_alerts' AND COLUMN_NAME = 'tracking_number'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE restock_alerts ADD COLUMN tracking_number VARCHAR(100) NULL AFTER delivery_partner",
  "SELECT 'tracking_number exists'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restock_alerts' AND COLUMN_NAME = 'dispatched_at'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE restock_alerts ADD COLUMN dispatched_at DATETIME NULL AFTER tracking_number",
  "SELECT 'dispatched_at exists'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restock_alerts' AND COLUMN_NAME = 'received_at'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE restock_alerts ADD COLUMN received_at DATETIME NULL AFTER dispatched_at",
  "SELECT 'received_at exists'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
