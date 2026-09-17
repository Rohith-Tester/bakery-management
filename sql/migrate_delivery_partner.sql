-- Run this ONLY if you already imported schema.sql before and don't want to
-- lose existing data. It adds delivery partner columns used by the Track
-- Order page to show who's delivering the order.
-- Usage: mysql -u root -p bakery_db < migrate_delivery_partner.sql

ALTER TABLE orders
  ADD COLUMN delivery_partner_name VARCHAR(150) DEFAULT '' AFTER payment_card_last4,
  ADD COLUMN delivery_partner_phone VARCHAR(30) DEFAULT '' AFTER delivery_partner_name;
