-- Adds the missing 'ready' status to restock_alerts.status.
-- migrate_restock_delivery_tracking.sql widened the enum to
-- ('open','acknowledged','dispatched','received','resolved') but the app's
-- lifecycle also passes through 'ready' (ready for pickup, before dispatch).
-- Without this, MySQL silently truncates status='ready' to '' (non-strict
-- mode), which then breaks the "Assign Delivery Partner" step with an
-- "Undefined index" error since '' isn't a recognized status.
-- Safe to run more than once.
-- Usage: mysql -u root -p bakery_db < sql/migrate_restock_ready_status.sql

USE bakery_db;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restock_alerts' AND COLUMN_NAME = 'status'
    AND COLUMN_TYPE LIKE '%ready%'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE restock_alerts MODIFY COLUMN status ENUM('open','acknowledged','ready','dispatched','received','resolved') NOT NULL DEFAULT 'open'",
  "SELECT 'status enum already includes ready'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Repair any rows that already got silently truncated to '' by the missing enum value.
UPDATE restock_alerts SET status = 'acknowledged' WHERE status = '';
