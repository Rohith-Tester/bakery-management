-- Run this if you already have a working database and don't want to lose
-- data (customers/orders/inventory/invoices). It adds user accounts with
-- roles: 'admin' (full access) and 'staff' (orders only).
--
-- Safe to run whether you have:
--   (a) no login table yet, or
--   (b) the older `admin_users` table from a previous version.
--
-- Usage: mysql -u root -p bakery_db < migrate_users_roles.sql

-- Case (b): upgrade the old admin_users table in place, if it exists.
SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'admin_users'
);

SET @rename_sql := IF(@tbl_exists = 1, 'RENAME TABLE admin_users TO users', 'SELECT 1');
PREPARE stmt FROM @rename_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Case (a): create it fresh if it still doesn't exist.
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Add the role column if it's missing (e.g. coming from the renamed
-- admin_users table, which had no role column).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'
);
SET @add_col_sql := IF(@col_exists = 0,
  "ALTER TABLE users ADD COLUMN role ENUM('admin','staff') NOT NULL DEFAULT 'staff' AFTER password_hash",
  'SELECT 1');
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make sure the existing admin account (from the old table) is flagged admin.
UPDATE users SET role = 'admin' WHERE username = 'admin';

-- If there was no users/admin_users table at all before, seed the default admin.
INSERT INTO users (id, username, password_hash, role)
SELECT UUID(), 'admin', '$2b$12$zfb6..SQmCpCBv5g/lCQGOFeN4YYbibfBP0/cdjp/yzw.Iv8jBTIC', 'admin'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
