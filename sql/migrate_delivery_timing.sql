-- Run this on an EXISTING bakery_db database to record exactly when an
-- order was marked delivered, so Track Order can tell the customer whether
-- it arrived early, on time, or late against the expected date.
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < migrate_delivery_timing.sql

USE bakery_db;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivered_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: any order that's already delivered but has no delivered_at yet
-- gets stamped with "now" so existing delivered orders don't show a blank
-- delivery-timing badge.
UPDATE orders SET delivered_at = NOW() WHERE status = 'delivered' AND delivered_at IS NULL;
