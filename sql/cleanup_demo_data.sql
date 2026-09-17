-- Removes ONLY the placeholder demo customers (Priya Sharma, Ravi Menon,
-- Ananya Krishnan, Deepak Reddy, Meera Tiwari) and their sample
-- orders/invoices that used to ship in schema.sql's seed section.
--
-- This does NOT touch inventory/products — those are real stock/catalog
-- data, not "users", and are left alone on purpose. Safe to run once
-- against a database that still has this demo data; running it again is
-- a no-op since the rows will already be gone.
-- Usage: mysql -u root -p bakery_db < sql/cleanup_demo_data.sql

USE bakery_db;

-- Invoices and order_items are removed first since they reference orders.
DELETE oi FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.order_number IN ('ORD-001','ORD-002','ORD-003','ORD-004','ORD-005');

DELETE FROM invoices WHERE invoice_number IN ('INV-001','INV-002','INV-003','INV-004','INV-005');

DELETE FROM orders WHERE order_number IN ('ORD-001','ORD-002','ORD-003','ORD-004','ORD-005');

DELETE FROM customers WHERE email IN (
  'priya@example.com', 'ravi@example.com', 'ananya@example.com',
  'deepak@example.com', 'meera@example.com'
);
