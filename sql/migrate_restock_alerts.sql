-- Adds the Supplier Restock Alerts feature to an existing database.
-- Safe to run more than once.
-- Usage: mysql -u root -p bakery_db < sql/migrate_restock_alerts.sql

CREATE TABLE IF NOT EXISTS restock_alerts (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  supplier_id CHAR(36) NULL,
  supplier_name VARCHAR(150) DEFAULT '',
  quantity_at_alert DECIMAL(12,3) NOT NULL DEFAULT 0,
  min_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  severity ENUM('low','critical') NOT NULL DEFAULT 'low',
  status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  notes VARCHAR(500) DEFAULT '',
  created_by VARCHAR(60) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;
