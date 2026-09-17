-- Adds/updates the "Adding an Inventory Item or Product: Every Field
-- Explained" training lesson -- a field-by-field walkthrough of the
-- Inventory Add Item form and the Product Catalog Add Product form, so
-- admins/staff know exactly what to type into each box.
-- Safe to re-run. Usage: mysql -u root -p bakery_db < sql/migrate_training_add_image_lesson.sql
-- Requires migrate_training.sql to have been run first.

INSERT INTO training_materials (id, title, category, description, resource_url, duration_minutes) VALUES
('11111111-1111-1111-1111-100000000020', 'Adding an Inventory Item or Product: Every Field Explained', 'Basics',
 'This lesson walks through both "Add" forms field by field, so you know exactly what to type into each box. There are two similar-looking forms in the system -- Inventory (raw materials/stock) and Product Catalog (what customers see and order) -- and they ask for slightly different things.

INVENTORY FORM (Sidebar -> Inventory -> + Add Item):
- Item name: what the ingredient/stock item is called, e.g. "All-purpose Flour". Keep it short and consistent so it is easy to search later.
- Product image (required for new items): click Choose File and pick a photo from your device. The system automatically resizes and compresses it for you -- you do not need to shrink it yourself. This image is what shows on the New Order product grid instead of a generic icon.
- Quantity: how much of this item is currently in stock, as a plain number (e.g. 25).
- Unit: pick the unit that number is measured in -- kg, g, L, ml, pcs, doz, or pack.
- Min stock (reorder level): the quantity below which this item should be flagged as Low/Critical stock and trigger a restock alert. Set this to whatever level means "we are about to run out."
- Cost per unit (Rs): how much the bakery pays per single unit when buying this item -- used to calculate stock value and the suggested selling price.
- Preferred supplier (optional): pick which supplier you usually restock this item from. Leave as "None" if there is no fixed supplier yet.

PRODUCT CATALOG FORM (Sidebar -> Product Catalog -> + New Product):
- Product name: the customer-facing name of the finished item being sold, e.g. "Chocolate Cake".
- SKU: a short unique code to identify this product internally, e.g. "CAKE-CHOC-001". Make it unique -- no two products should share an SKU.
- Product image (required): same as Inventory -- Choose File, pick a photo, and it is auto-compressed. This is the photo customers see in the catalog and on the New Order page.
- Category: which group this product belongs to, e.g. Cakes, Breads, Cookies. Used for filtering the catalog.
- Selling price (Rs): the price charged to the customer for one unit of this product.
- Linked recipe (optional): connect this product to a Recipe so the system knows which raw ingredients/inventory it consumes when produced. Leave as "Not linked" if there is no recipe set up yet.
- Description (optional): a short sentence shown to customers describing the product.
- Available for sale (checkbox): tick this on to let the product appear and be orderable in the catalog; untick to hide it (e.g. temporarily out of season) without deleting it.

QUICK RULE OF THUMB: use Inventory for raw materials and ingredients you track stock levels for; use Product Catalog for the finished items customers actually order. A photo is mandatory on both forms when adding a brand-new entry -- editing an existing item keeps its current photo unless you replace it.',
 '', 6)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = VALUES(category),
  description = VALUES(description),
  resource_url = VALUES(resource_url),
  duration_minutes = VALUES(duration_minutes);
