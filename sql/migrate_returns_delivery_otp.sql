-- Adds OTP-verified delivery confirmation (like Flipkart/e-commerce trackers:
-- the delivery partner must enter the OTP shown to the customer before an
-- order can be marked "delivered"), plus a full Return / Refund workflow so
-- a customer who received a damaged product can request a return and get
-- refunded to their bank account — regardless of whether the original
-- payment was online or offline.
-- Usage: mysql -u root -p bakery_db < migrate_returns_delivery_otp.sql

USE bakery_db;

-- ── Delivery OTP ─────────────────────────────────────────────────────────
-- A fresh 4-digit OTP is generated the moment an order goes out_for_delivery.
-- It's shown to the customer on the Track Order page; the delivery partner
-- must type the same code in to mark the order delivered, confirming the
-- parcel actually reached the right person.
ALTER TABLE orders
  ADD COLUMN delivery_otp VARCHAR(6) DEFAULT NULL AFTER delivery_partner_user_id,
  ADD COLUMN delivery_otp_verified_at DATETIME NULL AFTER delivery_otp;

-- ── Returns / Refunds ────────────────────────────────────────────────────
-- requested  -> customer reported a problem (e.g. damaged product) and asked
--               for a return; refund_amount defaults to the order total.
-- approved   -> staff/admin reviewed and accepted the return.
-- rejected   -> staff/admin declined the return (see admin_notes).
-- refunded   -> money has been sent to the customer's bank account (refund_txn_id
--               records the (simulated) bank transfer reference), whether the
--               original order was paid online or offline.
CREATE TABLE IF NOT EXISTS returns (
  id CHAR(36) PRIMARY KEY,
  return_number VARCHAR(30) NOT NULL,
  order_id CHAR(36) NOT NULL,
  order_number VARCHAR(30) NOT NULL,
  customer_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  customer_name VARCHAR(150) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  original_payment_method ENUM('online','offline') NOT NULL DEFAULT 'offline',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  refund_method ENUM('bank_transfer') NOT NULL DEFAULT 'bank_transfer',
  bank_account_holder VARCHAR(150) DEFAULT '',
  bank_account_number VARCHAR(34) DEFAULT '',
  bank_ifsc VARCHAR(15) DEFAULT '',
  bank_name VARCHAR(150) DEFAULT '',
  status ENUM('requested','approved','rejected','refunded') NOT NULL DEFAULT 'requested',
  -- NOTE: if you're setting this up fresh, also run migrate_return_pickup.sql
  -- afterwards to add the pickup-partner/OTP workflow columns and expand
  -- this status enum with 'pickup_assigned' and 'picked_up'.
  admin_notes VARCHAR(500) DEFAULT '',
  refund_txn_id VARCHAR(40) DEFAULT '',
  processed_by VARCHAR(60) DEFAULT '',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  refunded_at DATETIME NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
