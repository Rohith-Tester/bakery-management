-- Run this ONLY if you already imported schema.sql before and don't want to
-- lose existing data. It just adds the new payment_method column.
-- Usage: mysql -u root -p bakery_db < migrate_payment.sql

ALTER TABLE orders
  ADD COLUMN payment_method ENUM('online','offline') NOT NULL DEFAULT 'offline' AFTER status;
