-- Tags a handful of the existing seeded lessons as also relevant to
-- customers (in addition to admin/staff), since these describe things a
-- customer directly experiences (placing/tracking orders, coupons,
-- leaving reviews). Everything else stays admin/staff-only.
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_training_audience_seed_tags.sql
-- Requires migrate_training_audience.sql to have been run first.

UPDATE training_materials SET audience = 'admin,staff,customer'
WHERE id IN (
  '11111111-1111-1111-1111-100000000019', -- Discounts & Coupons
  '11111111-1111-1111-1111-100000000018', -- Product Reviews
  '11111111-1111-1111-1111-100000000003', -- Managing Orders & Order Statuses
  '11111111-1111-1111-1111-100000000017'  -- Invoices & Payments
);

UPDATE training_materials SET audience = 'admin,staff,delivery'
WHERE id IN (
  '11111111-1111-1111-1111-100000000004', -- Assigning a Delivery Partner
  '11111111-1111-1111-1111-100000000005'  -- Delivery Partner Workflow
);

UPDATE training_materials SET audience = 'admin,staff,supplier'
WHERE id IN (
  '11111111-1111-1111-1111-100000000008', -- Creating Purchase Orders
  '11111111-1111-1111-1111-100000000009', -- Managing Suppliers
  '11111111-1111-1111-1111-100000000012'  -- Restock Alerts
);
