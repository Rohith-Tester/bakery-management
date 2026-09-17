-- Run this ONLY if you already imported schema.sql before and don't want to
-- lose existing data. It adds the image_url column used to show real
-- product photos on the New Order product grid (falls back to an emoji
-- icon when an item has no image set).
-- Usage: mysql -u root -p bakery_db < migrate_inventory_image.sql

ALTER TABLE inventory
  ADD COLUMN image_url VARCHAR(500) DEFAULT '' AFTER cost_per_unit;
