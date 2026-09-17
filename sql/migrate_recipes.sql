-- Adds the Recipe Management feature to an existing database.
-- Safe to run more than once.
-- Usage: mysql -u root -p bakery_db < sql/migrate_recipes.sql

CREATE TABLE IF NOT EXISTS recipes (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  linked_item_id CHAR(36) NULL,
  yield_qty DECIMAL(12,3) NOT NULL DEFAULT 1,
  yield_unit VARCHAR(20) NOT NULL DEFAULT 'batch',
  prep_time_minutes INT NOT NULL DEFAULT 0,
  bake_time_minutes INT NOT NULL DEFAULT 0,
  instructions TEXT,
  notes VARCHAR(500) DEFAULT '',
  image_url LONGTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (linked_item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id CHAR(36) NOT NULL,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT '',
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;
