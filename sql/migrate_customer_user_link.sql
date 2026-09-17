-- Run this on an EXISTING bakery_db database to link customer *accounts*
-- (rows in `users` with role='customer') to rows in the `customers` table.
-- Before this, registering/creating a customer login never created a
-- matching Customers-page record, so the two lists (Users vs Customers)
-- drifted apart. Safe to re-run.
-- Usage: mysql -u root -p bakery_db < migrate_customer_user_link.sql

USE bakery_db;

-- 1) Add the link column if it's missing.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'user_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE customers ADD COLUMN user_id CHAR(36) NULL UNIQUE AFTER id',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Backfill: for every existing 'customer'-role user who doesn't already
--    have a linked customer record, create one from their account details.
INSERT INTO customers (id, user_id, name, email, phone, total_orders, total_spend)
SELECT UUID(), u.id, u.username, u.email, u.phone, 0, 0
FROM users u
WHERE u.role = 'customer'
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.user_id = u.id);
