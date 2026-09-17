-- Adds Customer Reviews & Ratings: a customer can rate/review an item
-- once their order containing it is marked Delivered. Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_product_reviews.sql

CREATE TABLE IF NOT EXISTS product_reviews (
  id CHAR(36) PRIMARY KEY,
  item_name VARCHAR(150) NOT NULL,
  order_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  rating TINYINT NOT NULL,
  comment VARCHAR(1000) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- One review per item per order — you can't review the same delivered
  -- croissant twice from the same order (ordering it again on a new order
  -- is a fresh, separate review opportunity).
  UNIQUE KEY uniq_review_per_item_order (order_id, item_name),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
