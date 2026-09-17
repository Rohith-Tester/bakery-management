-- Adds a full pickup workflow to returns, matching how Flipkart handles a
-- damaged-product return: requested -> approved -> a delivery partner is
-- assigned to collect the item -> the partner enters an OTP (shown to the
-- customer) at pickup time to confirm they received the product back ->
-- refund is then processed within 1-3 business days.
-- Usage: mysql -u root -p bakery_db < migrate_return_pickup.sql

USE bakery_db;

ALTER TABLE returns
  MODIFY COLUMN status ENUM('requested','approved','pickup_assigned','picked_up','rejected','refunded') NOT NULL DEFAULT 'requested',
  ADD COLUMN pickup_partner_name VARCHAR(150) DEFAULT '' AFTER admin_notes,
  ADD COLUMN pickup_partner_phone VARCHAR(30) DEFAULT '' AFTER pickup_partner_name,
  ADD COLUMN pickup_partner_user_id CHAR(36) NULL AFTER pickup_partner_phone,
  ADD COLUMN pickup_otp VARCHAR(6) DEFAULT NULL AFTER pickup_partner_user_id,
  ADD COLUMN pickup_otp_verified_at DATETIME NULL AFTER pickup_otp,
  ADD COLUMN picked_up_at DATETIME NULL AFTER pickup_otp_verified_at,
  ADD FOREIGN KEY (pickup_partner_user_id) REFERENCES users(id) ON DELETE SET NULL;
