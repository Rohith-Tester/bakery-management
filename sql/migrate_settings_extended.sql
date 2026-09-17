-- Extends store_settings (added by migrate_store_settings.sql / schema.sql)
-- with the full set of business-configuration fields used by the Settings
-- module: bakery name, GST number, tax percentage, currency, and business
-- hours, alongside the existing phone/email/address.
-- Usage: mysql -u root -p bakery_db < sql/migrate_settings_extended.sql

ALTER TABLE store_settings
  ADD COLUMN bakery_name VARCHAR(150) DEFAULT 'Golden Crust Bakery' AFTER id,
  ADD COLUMN gst_number VARCHAR(30) DEFAULT '' AFTER address,
  ADD COLUMN tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER gst_number,
  ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'INR' AFTER tax_percentage,
  ADD COLUMN business_hours VARCHAR(255) DEFAULT '' AFTER currency;

UPDATE store_settings SET bakery_name = 'Golden Crust Bakery' WHERE id = 1 AND (bakery_name IS NULL OR bakery_name = '');
UPDATE store_settings SET currency = 'INR' WHERE id = 1 AND (currency IS NULL OR currency = '');
