-- Golden Crust Bakery Management — MySQL schema + seed data
-- Import this file first: mysql -u root -p bakery_db < schema.sql

CREATE DATABASE IF NOT EXISTS bakery_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bakery_db;

-- ── Customers ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS production_batch_ingredients;
DROP TABLE IF EXISTS production_batches;
DROP TABLE IF EXISTS recipe_ingredients;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS restock_alerts;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

-- ── Login / accounts ─────────────────────────────────────────────────────
-- role = 'admin'    -> full access to everything
-- role = 'staff'    -> can only view/create orders and update order status
--                      (staff accounts are created via the public Register
--                      form on the login page; that form can never create
--                      an admin account)
-- role = 'customer' -> self-service storefront account: can place their own
--                      orders and pay online, and can only see/track their
--                      own orders (never other customers' or admin screens)
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff','customer','delivery','supplier') NOT NULL DEFAULT 'customer',
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(150) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default admin login: username "admin", password "admin123"
-- CHANGE THIS after your first login — see README.
INSERT INTO users (id, username, password_hash, role) VALUES
(UUID(), 'admin', '$2b$12$zfb6..SQmCpCBv5g/lCQGOFeN4YYbibfBP0/cdjp/yzw.Iv8jBTIC', 'admin');

-- ── Login throttling (brute-force protection) ───────────────────────────
-- Tracks failed sign-in attempts per (username, IP) pair so a locked-out
-- attacker can't just keep guessing the admin password.
CREATE TABLE login_attempts (
  identifier VARCHAR(191) PRIMARY KEY,
  fail_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE customers (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) DEFAULT '',
  phone VARCHAR(30) DEFAULT '',
  total_orders INT DEFAULT 0,
  total_spend DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Inventory ────────────────────────────────────────────────────────────
-- ── Suppliers ────────────────────────────────────────────────────────────
-- Vendors the bakery buys raw ingredients from. Inventory items can
-- optionally point to a preferred supplier for restocking.
CREATE TABLE suppliers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(150) DEFAULT '',
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(150) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  category VARCHAR(100) DEFAULT '',
  notes VARCHAR(500) DEFAULT '',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  user_id CHAR(36) NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inventory (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  min_stock DECIMAL(12,3) NOT NULL DEFAULT 1,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  image_url LONGTEXT,
  supplier_id CHAR(36) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Inventory purchase log ──────────────────────────────────────────────
-- One row per stock import/restock (created whenever an inventory item is
-- added or its quantity is increased), so we can report "money spent
-- importing product" over any date range — separate from sales revenue.
CREATE TABLE inventory_purchases (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Supplier Restock Alerts ──────────────────────────────────────────────
-- A log of low/critical-stock alerts raised against an item (and its
-- supplier, if it has one). The *current* low-stock list is always computed
-- live from `inventory`/`suppliers` — this table is the history/workflow
-- log of alerts that were actually raised and their acknowledge/resolve
-- status, so the same low item doesn't get silently re-flagged forever.
CREATE TABLE restock_alerts (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  supplier_id CHAR(36) NULL,
  supplier_name VARCHAR(150) DEFAULT '',
  quantity_at_alert DECIMAL(12,3) NOT NULL DEFAULT 0,
  min_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  severity ENUM('low','critical') NOT NULL DEFAULT 'low',
  status ENUM('open','acknowledged','ready','dispatched','received','resolved') NOT NULL DEFAULT 'open',
  notes VARCHAR(500) DEFAULT '',
  delivery_partner VARCHAR(150) NULL,
  tracking_number VARCHAR(100) NULL,
  dispatched_at DATETIME NULL,
  received_at DATETIME NULL,
  created_by VARCHAR(60) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Recipes (Recipe Management) ─────────────────────────────────────────
-- A recipe is the standing "how to make it" formula for a baked good:
-- what it costs (computed live from linked ingredients' current
-- cost_per_unit), how long it takes, and the step-by-step method. Optionally
-- linked to the finished-goods inventory item it produces, so its cost can
-- inform that item's pricing.
CREATE TABLE recipes (
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

-- Each ingredient line may point at a real inventory item (cost tracked
-- live) or be a free-text ingredient not carried in stock (cost 0).
CREATE TABLE recipe_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id CHAR(36) NOT NULL,
  item_id CHAR(36) NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT '',
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Product Catalog ──────────────────────────────────────────────────────
-- Kept separate from `recipes`: a recipe is the *method* for making a
-- baked good, a product is the *sellable listing* (price, SKU, category,
-- availability). A product can optionally link to a recipe, but neither
-- requires the other.
CREATE TABLE products (
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

-- ── Production Management ───────────────────────────────────────────────
-- A production batch is a scheduled/actual baking run of a recipe. Creating
-- one snapshots the recipe's ingredients (scaled by `multiplier`) and their
-- cost at that moment, so later recipe edits don't rewrite history.
-- planned -> in_progress -> completed (deducts ingredient stock, adds
-- finished-goods stock), or cancelled at any point before completion.
CREATE TABLE production_batches (
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

CREATE TABLE production_batch_ingredients (
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

-- ── Purchase Orders ──────────────────────────────────────────────────────
-- Orders the bakery places WITH a supplier to restock ingredients (as
-- opposed to `orders`, which are customer orders FROM the bakery).
-- draft -> ordered -> received (stock + cost log updated on receipt), or
-- cancelled at any point before receipt.
CREATE TABLE purchase_orders (
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

CREATE TABLE purchase_order_items (
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

-- ── Orders ───────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id CHAR(36) PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL,
  customer_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(30) DEFAULT '',
  customer_email VARCHAR(150) DEFAULT '',
  delivery_type ENUM('pickup','delivery') NOT NULL DEFAULT 'pickup',
  delivery_address VARCHAR(255) DEFAULT '',
  requested_date DATE NULL,
  notes VARCHAR(500) DEFAULT '',
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
  coupon_code VARCHAR(30) DEFAULT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('pending','baking','ready','out_for_delivery','delivered') NOT NULL DEFAULT 'pending',
  delivered_at DATETIME NULL,
  payment_method ENUM('online','offline') NOT NULL DEFAULT 'offline',
  payment_txn_id VARCHAR(40) DEFAULT '',
  payment_card_last4 VARCHAR(4) DEFAULT '',
  payment_mode VARCHAR(20) DEFAULT '',
  delivery_partner_name VARCHAR(150) DEFAULT '',
  delivery_partner_phone VARCHAR(30) DEFAULT '',
  delivery_partner_user_id CHAR(36) NULL,
  delivery_otp VARCHAR(6) DEFAULT NULL,
  delivery_otp_attempts INT NOT NULL DEFAULT 0,
  delivery_otp_verified_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (delivery_partner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Discounts & Coupons ──────────────────────────────────────────────────
CREATE TABLE coupons (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  description VARCHAR(200) DEFAULT '',
  discount_type ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_discount_amount DECIMAL(10,2) NULL,
  usage_limit INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  per_customer_limit INT NULL,
  valid_from DATE NULL,
  valid_until DATE NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  is_welcome TINYINT(1) NOT NULL DEFAULT 0,
  -- "Special Day Sale" — applies automatically to every customer's cart
  -- with no code needed, for storewide/festival discounts.
  auto_apply TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_coupon_code (code)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Returns / Refunds ────────────────────────────────────────────────────
-- Customer-initiated return (e.g. "product arrived damaged") on a delivered
-- order. Refunds always go out to the customer's bank account — regardless
-- of whether the original order was paid online or offline — mirroring how
-- Flipkart/e-commerce returns work.
CREATE TABLE returns (
  id CHAR(36) PRIMARY KEY,
  return_number VARCHAR(30) NOT NULL,
  order_id CHAR(36) NOT NULL,
  order_number VARCHAR(30) NOT NULL,
  customer_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  customer_name VARCHAR(150) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  original_payment_method ENUM('online','offline') NOT NULL DEFAULT 'offline',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  refund_method ENUM('bank_transfer') NOT NULL DEFAULT 'bank_transfer',
  bank_account_holder VARCHAR(150) DEFAULT '',
  bank_account_number VARCHAR(34) DEFAULT '',
  bank_ifsc VARCHAR(15) DEFAULT '',
  bank_name VARCHAR(150) DEFAULT '',
  status ENUM('requested','approved','pickup_assigned','picked_up','received','rejected','refunded') NOT NULL DEFAULT 'requested',
  admin_notes VARCHAR(500) DEFAULT '',
  pickup_partner_name VARCHAR(150) DEFAULT '',
  pickup_partner_phone VARCHAR(30) DEFAULT '',
  pickup_partner_user_id CHAR(36) NULL,
  pickup_otp VARCHAR(6) DEFAULT NULL,
  pickup_otp_attempts INT NOT NULL DEFAULT 0,
  pickup_otp_verified_at DATETIME NULL,
  picked_up_at DATETIME NULL,
  refund_txn_id VARCHAR(40) DEFAULT '',
  processed_by VARCHAR(60) DEFAULT '',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  refunded_at DATETIME NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (pickup_partner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Which specific order item(s) a return covers, and how many units of each.
-- A return only refunds for the items/quantities listed here (e.g. one
-- damaged product out of a two-product order), not the whole order total.
CREATE TABLE return_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_id CHAR(36) NOT NULL,
  order_item_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Invoices ─────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id CHAR(36) PRIMARY KEY,
  invoice_number VARCHAR(30) NOT NULL,
  order_id CHAR(36) NULL,
  order_number VARCHAR(30) NOT NULL,
  customer_id CHAR(36) NULL,
  customer_name VARCHAR(150) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('paid','unpaid') NOT NULL DEFAULT 'unpaid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Online payments (Razorpay) ───────────────────────────────────────────
-- One row per Razorpay payment the app opens (api/payments.php).
-- status: created   -> Razorpay order opened; customer hasn't paid (yet)
--         paid      -> money received but no order saved for it yet. If a
--                      row stays like this, refund it from the Razorpay
--                      Dashboard (see api/razorpay_webhook.php)
--         completed -> order saved; order_id points at it
CREATE TABLE payments (
  id CHAR(36) PRIMARY KEY,
  gateway VARCHAR(20) NOT NULL DEFAULT 'razorpay',
  gateway_order_id VARCHAR(40) NOT NULL,
  gateway_payment_id VARCHAR(40) DEFAULT NULL,
  amount_paise INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('created','paid','completed') NOT NULL DEFAULT 'created',
  order_id CHAR(36) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_gateway_order (gateway_order_id),
  KEY idx_payments_status (status),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Notifications ────────────────────────────────────────────────────────
-- recipient_role = 'management' means "any admin or staff" (new order
-- alerts). recipient_user_id targets one specific account (a customer's
-- order-status updates, or a delivery partner's new assignment).
CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  recipient_role ENUM('management') NULL,
  recipient_user_id CHAR(36) NULL,
  order_id CHAR(36) NULL,
  message VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Store settings (business configuration) ──────────────────────────────
-- Single-row table (id always 1) holding the business's own configuration:
-- identity/tax details for invoices (bakery name, GST number, tax %,
-- currency), the phone/email/address shown to customers who'd rather call
-- in an order than place it online, and posted business hours.
CREATE TABLE store_settings (
  id INT PRIMARY KEY DEFAULT 1,
  bakery_name VARCHAR(150) DEFAULT 'Golden Crust Bakery',
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(150) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  gst_number VARCHAR(30) DEFAULT '',
  tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  business_hours VARCHAR(255) DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO store_settings (id, bakery_name, phone, email, address, gst_number, tax_percentage, currency, business_hours) VALUES
(1, 'Golden Crust Bakery', '', '', '', '', 0, 'INR', '');

-- ── Customer Reviews & Ratings ───────────────────────────────────────────
-- A customer can rate/review an item once their order containing it is
-- marked Delivered. One review per (order, item) pair.
CREATE TABLE product_reviews (
  id CHAR(36) PRIMARY KEY,
  item_name VARCHAR(150) NOT NULL,
  order_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  rating TINYINT NOT NULL,
  comment VARCHAR(1000) DEFAULT '',
  image_url MEDIUMTEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_review_per_item_order (order_id, item_name),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Staff Training ───────────────────────────────────────────────────────
CREATE TABLE training_materials (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  description TEXT,
  resource_url VARCHAR(500) DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- One row per (material, staff member) who has marked it complete. The
-- unique key makes "mark complete" idempotent.
CREATE TABLE training_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_material_user (material_id, user_id),
  FOREIGN KEY (material_id) REFERENCES training_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- No demo customers, orders, or invoices are seeded — a fresh install
-- starts with zero fake people in it (no "Priya Sharma"/"Ravi Menon"-style
-- placeholder rows to hunt down and delete before going live). Add real
-- customers from the Customers page, or let them register themselves.
--
-- A small starter set of common bakery ingredients IS still seeded below
-- (this is stock/products, not "users" — genuinely useful as a working
-- example of the Inventory screen instead of opening to a blank table).
-- Feel free to edit the quantities/costs to match reality, or delete rows
-- you don't need from the Inventory page.
INSERT INTO inventory (id, name, quantity, unit, min_stock, cost_per_unit) VALUES
(UUID(), 'All-purpose Flour', 14.4, 'kg', 5,   40),
(UUID(), 'Butter',            1.8,  'kg', 3,   480),
(UUID(), 'Sugar',             9,    'kg', 5,   45),
(UUID(), 'Eggs',              11,   'pcs',30,  8),
(UUID(), 'Heavy Cream',       6,    'L',  4,   120),
(UUID(), 'Yeast',             0.5,  'kg', 0.3, 200),
(UUID(), 'Cocoa Powder',      2.2,  'kg', 1,   350),
(UUID(), 'Vanilla Extract',   0.3,  'L',  0.2, 600);
