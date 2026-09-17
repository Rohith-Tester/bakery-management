-- Fix orphaned invoices: when an order is deleted, remove its invoice too
-- (previously invoices stayed in Sales & Billing with order_id set NULL).
-- Usage: mysql -u root -p bakery_db < migrate_invoice_cascade.sql

USE bakery_db;

-- Drop existing FK if present (name may vary on older installs).
SET @fk := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'order_id'
    AND REFERENCED_TABLE_NAME = 'orders'
  LIMIT 1
);
SET @drop := IF(@fk IS NOT NULL, CONCAT('ALTER TABLE invoices DROP FOREIGN KEY ', @fk), 'SELECT 1');
PREPARE stmt FROM @drop;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_order_fk
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- Remove invoices whose order was already deleted (orphans from old behavior).
DELETE FROM invoices WHERE order_id IS NOT NULL AND order_id NOT IN (SELECT id FROM orders);
