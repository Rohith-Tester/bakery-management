-- Adds the Production Management feature to an existing database.
-- Requires sql/migrate_recipes.sql to have been run first (production
-- batches reference recipes). Safe to run more than once.
-- Usage: mysql -u root -p bakery_db < sql/migrate_production.sql

CREATE TABLE IF NOT EXISTS production_batches (
  id CHAR(36) PRIMARY KEY,
  batch_number VARCHAR(30) NOT NULL,
  recipe_id CHAR(36) NULL,
  recipe_name VARCHAR(150) NOT NULL,
  multiplier DECIMAL(12,3) NOT NULL DEFAULT 1,
  output_item_id CHAR(36) NULL,
  output_item_name VARCHAR(150) DEFAULT '',
  planned_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
  yield_unit VARCHAR(20) NOT NULL DEFAULT 'batch',
  status ENUM('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
  scheduled_date DATE NULL,
  notes VARCHAR(500) DEFAULT '',
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by VARCHAR(60) DEFAULT '',
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
  FOREIGN KEY (output_item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS production_batch_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id CHAR(36) NOT NULL,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT '',
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;
