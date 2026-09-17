-- Adds a Staff Training material explaining the full restock workflow:
-- Inventory -> Supplier link -> Restock Alert -> Purchase Order -> Received.
-- Safe to re-run (skips insert if a material with this exact title already exists).
-- Usage: mysql -u root -p bakery_db < sql/migrate_training_restock_workflow.sql

USE bakery_db;

INSERT INTO training_materials (id, title, category, description, resource_url, duration_minutes)
SELECT UUID(), 'Restock Alerts & Purchase Orders Workflow', 'Inventory & Purchasing',
'How stock actually gets replenished, step by step:

1. SETUP (one-time per item)
   - Inventory -> Edit an item -> set its Supplier dropdown. Without this link,
     the item never shows up on that supplier''s own Restock Alerts screen.

2. ITEM GOES LOW (automatic)
   - As soon as an item''s quantity drops below its Min Stock, it appears as
     Low/Critical on the Inventory page and on Restock Alerts -> Low Stock by
     Supplier. This is always calculated live -- nothing to configure.

3. RAISE THE ALERT (staff/admin, manual)
   - Restock Alerts -> Raise Alert (single item) or Raise Alerts for All. This
     creates an open alert, notifies management, and makes the item visible
     on the linked supplier''s own dashboard.

4. SUPPLIER RESPONDS
   - The supplier logs in, sees only their own alerts, and moves it through
     Open -> Acknowledged -> Resolved as they restock.
   - IMPORTANT: Resolving an alert only closes it out. It does NOT change
     inventory quantity by itself.

5. CREATE THE PURCHASE ORDER (staff/admin)
   - From Restock Alerts -> Low Stock by Supplier, click "Create Purchase
     Order" next to that supplier''s group. This opens a new PO already
     filled in with the supplier and a suggested reorder quantity for every
     low item -- no need to re-type anything.
   - Move the PO: Draft -> Ordered once it''s placed with the supplier.

6. RECEIVE THE STOCK (staff/admin) -- the step that actually updates inventory
   - When the delivery physically arrives, open the PO and mark it Received.
   - This is the ONLY action that increases inventory quantity. It also
     recalculates a weighted-average cost per unit automatically.

Remember: Restock Alert = communication/tracking. Purchase Order Received =
the real stock movement. A supplier marking their alert "resolved" is not
the same as inventory being updated -- staff still need to receive the PO.',
'', 6
WHERE NOT EXISTS (
  SELECT 1 FROM training_materials WHERE title = 'Restock Alerts & Purchase Orders Workflow'
);
