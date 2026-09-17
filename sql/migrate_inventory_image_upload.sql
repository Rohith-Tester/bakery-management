-- Run this if you already applied migrate_inventory_image.sql (or schema.sql)
-- before product photo UPLOADS were supported. The column was originally
-- VARCHAR(500), which is fine for a pasted link but far too small for an
-- uploaded photo (stored as a base64 data URL). This widens it so uploads
-- don't get silently truncated/corrupted, which is what made images fail to
-- show up on the New Order page.
-- Usage: mysql -u root -p bakery_db < migrate_inventory_image_upload.sql

ALTER TABLE inventory
  MODIFY COLUMN image_url LONGTEXT;
