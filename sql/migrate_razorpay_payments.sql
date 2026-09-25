-- Migration: real online payments through Razorpay (replaces the simulated
-- card/UPI checkout). Adds the `payments` table — one row per Razorpay
-- payment the app opens — and orders.payment_mode (upi / card / netbanking
-- / wallet …) for the receipt. Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_razorpay_payments.sql

USE bakery_db;

-- status: created   -> Razorpay order opened; customer hasn't paid (yet)
--         paid      -> money received but no order saved for it yet. If a
--                      row stays like this, refund it from the Razorpay
--                      Dashboard (see api/razorpay_webhook.php)
--         completed -> order saved; order_id points at it
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  gateway VARCHAR(20) NOT NULL DEFAULT 'razorpay',
  gateway_order_id VARCHAR(40) NOT NULL,
  gateway_payment_id VARCHAR(40) DEFAULT NULL,
  amount_paise INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('created','paid','completed') NOT NULL DEFAULT 'created',
  order_id CHAR(36) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_gateway_order (gateway_order_id),
  KEY idx_payments_status (status),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Helper: add a column only if it doesn't already exist (works on MySQL
-- 5.6+/MariaDB, which lack "ADD COLUMN IF NOT EXISTS").
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

CALL _add_col_if_missing('orders', 'payment_mode', "VARCHAR(20) DEFAULT '' AFTER payment_card_last4");

DROP PROCEDURE IF EXISTS _add_col_if_missing;
