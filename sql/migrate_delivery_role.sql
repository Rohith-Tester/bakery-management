-- Run this on an EXISTING bakery_db database to add the 'delivery' role
-- and let orders be linked to a real delivery-partner login account
-- (instead of just a free-text name/phone).
-- Usage: mysql -u root -p bakery_db < migrate_delivery_role.sql

USE bakery_db;

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','staff','customer','delivery') NOT NULL DEFAULT 'customer';

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_partner_user_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN delivery_partner_user_id CHAR(36) NULL AFTER delivery_partner_phone, ADD FOREIGN KEY (delivery_partner_user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
