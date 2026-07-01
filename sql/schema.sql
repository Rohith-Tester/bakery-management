-- Bake & Co Management — MySQL schema + seed data
-- Import this file first: mysql -u root -p bakery_db < schema.sql

CREATE DATABASE IF NOT EXISTS bakery_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bakery_db;

-- ── Customers ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

-- ── Login / accounts ─────────────────────────────────────────────────────
-- role = 'admin'  -> full access to everything
-- role = 'staff'  -> can only view/create orders and update order status
--                    (staff accounts are created via the public Register
--                    form on the login page; that form can never create
--                    an admin account)
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default admin login: username "admin", password "admin123"
-- CHANGE THIS after your first login — see README.
INSERT INTO users (id, username, password_hash, role) VALUES
(UUID(), 'admin', '$2b$12$zfb6..SQmCpCBv5g/lCQGOFeN4YYbibfBP0/cdjp/yzw.Iv8jBTIC', 'admin');

CREATE TABLE customers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) DEFAULT '',
  phone VARCHAR(30) DEFAULT '',
  total_orders INT DEFAULT 0,
  total_spend DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Inventory ────────────────────────────────────────────────────────────
CREATE TABLE inventory (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  min_stock DECIMAL(12,3) NOT NULL DEFAULT 1,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Orders ───────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id CHAR(36) PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL,
  customer_id CHAR(36) NULL,
  customer_name VARCHAR(150) NOT NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('pending','baking','ready','delivered') NOT NULL DEFAULT 'pending',
  payment_method ENUM('online','offline') NOT NULL DEFAULT 'offline',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
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
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Seed: Customers ──────────────────────────────────────────────────────
INSERT INTO customers (id, name, email, phone, total_orders, total_spend) VALUES
(UUID(), 'Priya Sharma',     'priya@example.com',   '9876543210', 14, 18200),
(UUID(), 'Ravi Menon',       'ravi@example.com',    '9876543211', 9,  11500),
(UUID(), 'Ananya Krishnan',  'ananya@example.com',  '9876543212', 22, 28900),
(UUID(), 'Deepak Reddy',     'deepak@example.com',  '9876543213', 7,  6720),
(UUID(), 'Meera Tiwari',     'meera@example.com',   '9876543214', 5,  4100);

-- ── Seed: Inventory ──────────────────────────────────────────────────────
INSERT INTO inventory (id, name, quantity, unit, min_stock, cost_per_unit) VALUES
(UUID(), 'All-purpose Flour', 14.4, 'kg', 5,   40),
(UUID(), 'Butter',            1.8,  'kg', 3,   480),
(UUID(), 'Sugar',             9,    'kg', 5,   45),
(UUID(), 'Eggs',              11,   'pcs',30,  8),
(UUID(), 'Heavy Cream',       6,    'L',  4,   120),
(UUID(), 'Yeast',             0.5,  'kg', 0.3, 200),
(UUID(), 'Cocoa Powder',      2.2,  'kg', 1,   350),
(UUID(), 'Vanilla Extract',   0.3,  'L',  0.2, 600);

-- ── Seed: Orders + items + invoices (uses session variables to link IDs) ──
SET @c1 = (SELECT id FROM customers WHERE name='Priya Sharma');
SET @c2 = (SELECT id FROM customers WHERE name='Ravi Menon');
SET @c3 = (SELECT id FROM customers WHERE name='Ananya Krishnan');
SET @c4 = (SELECT id FROM customers WHERE name='Deepak Reddy');
SET @c5 = (SELECT id FROM customers WHERE name='Meera Tiwari');

SET @o1 = UUID(); SET @o2 = UUID(); SET @o3 = UUID(); SET @o4 = UUID(); SET @o5 = UUID();

INSERT INTO orders (id, order_number, customer_id, customer_name, total, status, payment_method, created_at) VALUES
(@o1, 'ORD-001', @c1, 'Priya Sharma',    1440, 'delivered', 'online',  DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@o2, 'ORD-002', @c2, 'Ravi Menon',      580,  'ready',     'offline', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@o3, 'ORD-003', @c3, 'Ananya Krishnan', 3200, 'baking',    'online',  DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(@o4, 'ORD-004', @c4, 'Deepak Reddy',    960,  'pending',   'offline', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(@o5, 'ORD-005', @c5, 'Meera Tiwari',    430,  'pending',   'offline', NOW());

INSERT INTO order_items (order_id, name, qty, price) VALUES
(@o1, 'Croissant', 2, 120),
(@o1, 'Birthday Cake', 1, 1200),
(@o2, 'Sourdough Loaf', 1, 580),
(@o3, 'Custom Cake', 1, 3200),
(@o4, 'Cookies (doz)', 1, 960),
(@o5, 'Muffin', 3, 90),
(@o5, 'Brownie', 2, 80);

INSERT INTO invoices (id, invoice_number, order_id, order_number, customer_id, customer_name, amount, status, created_at) VALUES
(UUID(), 'INV-001', @o1, 'ORD-001', @c1, 'Priya Sharma',    1440, 'paid',   (SELECT created_at FROM orders WHERE id=@o1)),
(UUID(), 'INV-002', @o2, 'ORD-002', @c2, 'Ravi Menon',      580,  'unpaid', (SELECT created_at FROM orders WHERE id=@o2)),
(UUID(), 'INV-003', @o3, 'ORD-003', @c3, 'Ananya Krishnan', 3200, 'unpaid', (SELECT created_at FROM orders WHERE id=@o3)),
(UUID(), 'INV-004', @o4, 'ORD-004', @c4, 'Deepak Reddy',    960,  'unpaid', (SELECT created_at FROM orders WHERE id=@o4)),
(UUID(), 'INV-005', @o5, 'ORD-005', @c5, 'Meera Tiwari',    430,  'unpaid', (SELECT created_at FROM orders WHERE id=@o5));
