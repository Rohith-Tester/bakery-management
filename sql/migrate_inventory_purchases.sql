-- Run this on an EXISTING bakery_db database to add restock/import
-- purchase logging, used by the new Weekly Report page (Reports ->
-- "Weekly spent to import products" vs "Selling details").
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < migrate_inventory_purchases.sql

USE bakery_db;

CREATE TABLE IF NOT EXISTS inventory_purchases (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Backfill one entry per existing inventory item at its current stock/cost,
-- so the report isn't empty for stock that predates this feature.
INSERT INTO inventory_purchases (id, item_id, item_name, quantity, cost_per_unit, total_cost, created_at)
SELECT UUID(), id, name, quantity, cost_per_unit, quantity * cost_per_unit, NOW()
FROM inventory
WHERE quantity > 0
  AND NOT EXISTS (SELECT 1 FROM inventory_purchases p WHERE p.item_id = inventory.id);
