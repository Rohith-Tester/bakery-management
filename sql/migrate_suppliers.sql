-- Run this on an EXISTING bakery_db database to add the new Supplier
-- Management module: a suppliers table, plus an optional preferred-supplier
-- link on each inventory item.
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < migrate_suppliers.sql

USE bakery_db;

CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(150) DEFAULT '',
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(150) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  category VARCHAR(100) DEFAULT '',
  notes VARCHAR(500) DEFAULT '',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND COLUMN_NAME = 'supplier_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE inventory ADD COLUMN supplier_id CHAR(36) NULL AFTER cost_per_unit, ADD FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
