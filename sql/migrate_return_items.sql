-- Adds per-item return tracking so a return only covers the specific
-- product(s)/quantity the customer selects (e.g. one damaged item out of a
-- two-item order), instead of always refunding the whole order total.
CREATE TABLE IF NOT EXISTS return_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_id CHAR(36) NOT NULL,
  order_item_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;
