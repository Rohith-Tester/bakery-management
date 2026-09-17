-- Adds the Product Catalog feature to an existing database.
-- Product Catalog is intentionally separate from `recipes`: a recipe is the
-- *method* for making a baked good (ingredients + instructions), while a
-- product is the *sellable listing* (price, SKU, category, availability).
-- A product can optionally link to a recipe so the two stay connected, but
-- neither one requires the other to exist.
-- Safe to run more than once.
-- Usage: mysql -u root -p bakery_db < sql/migrate_product_catalog.sql

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  image_url LONGTEXT,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  recipe_id CHAR(36) NULL,
  description VARCHAR(500) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_products_sku (sku),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
) ENGINE=InnoDB;
