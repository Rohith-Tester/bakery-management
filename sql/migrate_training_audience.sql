-- Adds role-based audience targeting to Training materials so each lesson
-- can be shown to a specific set of roles (e.g. a lesson only customers
-- should see, or one only staff/admin should see).
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_training_audience.sql
-- Requires migrate_training.sql to have been run first.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_materials' AND COLUMN_NAME = 'audience'
);

SET @sql := IF(@col_exists = 0,
  "ALTER TABLE training_materials ADD COLUMN audience VARCHAR(150) NOT NULL DEFAULT 'admin,staff' AFTER category",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Existing lessons were all written for staff/admin — keep them that way
-- (this UPDATE is idempotent, harmless to re-run).
UPDATE training_materials SET audience = 'admin,staff' WHERE audience = '' OR audience IS NULL;
