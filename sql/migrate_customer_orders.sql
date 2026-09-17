-- Migration: customer accounts + richer order form + online payment details
-- Run this on an EXISTING bakery_db database (one already created from an
-- older schema.sql). Safe to run once, and safe to re-run -- every change is
-- guarded by an information_schema check first, so it works on older
-- MySQL/MariaDB versions that don't support "ADD COLUMN IF NOT EXISTS"
-- (that syntax needs MySQL 8.0.29+; this script works from MySQL 5.7 /
-- MariaDB 10.x onward).

USE bakery_db;

-- Helper: add a column only if it doesn't already exist.
DROP PROCEDURE IF EXISTS _add_col_if_missing;
DELIMITER $$
CREATE PROCEDURE _add_col_if_missing(
    IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT
)
BEGIN
    DECLARE col_exists INT DEFAULT 0;
    SELECT COUNT(*) INTO col_exists
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column;
    IF col_exists = 0 THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- 1) Allow a 'customer' role and store basic contact info on the account.
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','staff','customer') NOT NULL DEFAULT 'customer';

CALL _add_col_if_missing('users', 'phone', "VARCHAR(30) DEFAULT '' AFTER password_hash");
CALL _add_col_if_missing('users', 'email', "VARCHAR(150) DEFAULT '' AFTER phone");

-- 2) Link orders to the account that placed them, and capture the extra
--    details the new order form collects (contact info, delivery/pickup,
--    requested date, notes) plus lightweight online-payment metadata.
CALL _add_col_if_missing('orders', 'user_id', "CHAR(36) NULL AFTER customer_id");
CALL _add_col_if_missing('orders', 'customer_phone', "VARCHAR(30) DEFAULT '' AFTER customer_name");
CALL _add_col_if_missing('orders', 'customer_email', "VARCHAR(150) DEFAULT '' AFTER customer_phone");
CALL _add_col_if_missing('orders', 'delivery_type', "ENUM('pickup','delivery') NOT NULL DEFAULT 'pickup' AFTER customer_email");
CALL _add_col_if_missing('orders', 'delivery_address', "VARCHAR(255) DEFAULT '' AFTER delivery_type");
CALL _add_col_if_missing('orders', 'requested_date', "DATE NULL AFTER delivery_address");
CALL _add_col_if_missing('orders', 'notes', "VARCHAR(500) DEFAULT '' AFTER requested_date");
CALL _add_col_if_missing('orders', 'payment_txn_id', "VARCHAR(40) DEFAULT '' AFTER payment_method");
CALL _add_col_if_missing('orders', 'payment_card_last4', "VARCHAR(4) DEFAULT '' AFTER payment_txn_id");

DROP PROCEDURE IF EXISTS _add_col_if_missing;

-- Add the FK for user_id only if it doesn't already exist.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND CONSTRAINT_NAME = 'orders_user_fk'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE orders ADD CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
