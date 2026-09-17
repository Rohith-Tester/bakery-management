-- Run this on an EXISTING bakery_db database to add the new Purchase
-- Orders module: orders the bakery places WITH a supplier to restock
-- ingredients (draft -> ordered -> received, or cancelled).
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < migrate_purchase_orders.sql

USE bakery_db;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id CHAR(36) PRIMARY KEY,
  po_number VARCHAR(30) NOT NULL,
  supplier_id CHAR(36) NULL,
  supplier_name VARCHAR(150) NOT NULL,
  status ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  expected_date DATE NULL,
  notes VARCHAR(500) DEFAULT '',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by VARCHAR(60) DEFAULT '',
  received_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id CHAR(36) NOT NULL,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;
