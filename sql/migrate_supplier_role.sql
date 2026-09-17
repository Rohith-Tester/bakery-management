-- Run this on an EXISTING bakery_db database to add a 'supplier' login role.
-- Lets a supplier sign in with their own credentials and see only their own
-- low-stock items / restock alerts (Restock Alerts module), without any
-- access to the rest of the admin panel.
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_supplier_role.sql

USE bakery_db;

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','staff','customer','delivery','supplier') NOT NULL DEFAULT 'customer';

-- Link a supplier record to the login account created for them. One
-- supplier account per supplier row (UNIQUE), nullable so existing/staff-
-- managed suppliers with no login of their own are unaffected.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suppliers' AND COLUMN_NAME = 'user_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE suppliers ADD COLUMN user_id CHAR(36) NULL UNIQUE AFTER status, ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
