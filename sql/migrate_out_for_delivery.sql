-- Add "out_for_delivery" order status so delivery partners can update
-- progress after leaving the shop (ready → out for delivery → delivered).
-- Usage: mysql -u root -p bakery_db < migrate_out_for_delivery.sql

USE bakery_db;

ALTER TABLE orders
  MODIFY COLUMN status ENUM('pending','baking','ready','out_for_delivery','delivered') NOT NULL DEFAULT 'pending';
