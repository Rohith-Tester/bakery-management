-- Adds an optional customer-uploaded photo to product reviews.
-- Usage: mysql -u root -p bakery_db < sql/migrate_review_image.sql
--
-- Note: older MySQL/MariaDB versions don't support "ADD COLUMN IF NOT
-- EXISTS", so this uses a small procedure to make the script safe to
-- re-run without erroring if the column is already there.

DELIMITER $$
CREATE PROCEDURE add_review_image_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_reviews'
      AND COLUMN_NAME = 'image_url'
  ) THEN
    ALTER TABLE product_reviews ADD COLUMN image_url MEDIUMTEXT DEFAULT NULL AFTER comment;
  END IF;
END$$
DELIMITER ;

CALL add_review_image_column();
DROP PROCEDURE add_review_image_column;
