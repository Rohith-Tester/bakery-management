-- Run this ONLY if you already imported schema.sql before the store_settings
-- table existed at all, and don't want to lose existing data. It creates
-- the store_settings table (business configuration: bakery name, GST
-- number, tax %, currency, business hours, and contact details).
-- If you already have an older store_settings table with just
-- phone/email/address, run migrate_settings_extended.sql instead.
-- Usage: mysql -u root -p bakery_db < migrate_store_settings.sql

CREATE TABLE IF NOT EXISTS store_settings (
  id INT PRIMARY KEY DEFAULT 1,
  bakery_name VARCHAR(150) DEFAULT 'Golden Crust Bakery',
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(150) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  gst_number VARCHAR(30) DEFAULT '',
  tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  business_hours VARCHAR(255) DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO store_settings (id, bakery_name, phone, email, address, gst_number, tax_percentage, currency, business_hours)
VALUES (1, 'Golden Crust Bakery', '', '', '', '', 0, 'INR', '');
