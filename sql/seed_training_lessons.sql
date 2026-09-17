-- Seeds the Staff Training module with a lesson for every part of Golden Crust Bakery.
-- Safe to re-run: uses fixed IDs with INSERT IGNORE, so it will never
-- duplicate rows if you run it more than once.
-- Usage: mysql -u root -p bakery_db < sql/seed_training_lessons.sql
-- Requires migrate_training.sql to have been run first.

INSERT IGNORE INTO training_materials (id, title, category, description, resource_url, duration_minutes) VALUES
('11111111-1111-1111-1111-100000000001', 'Getting Started with Golden Crust Bakery', 'Basics',
 'Overview of the sidebar, roles (Admin/Staff/Delivery/Customer/Supplier), and how permissions differ between them. Start here if you are new to the system.',
 '', 5),

('11111111-1111-1111-1111-100000000002', 'Taking Orders at the POS', 'Orders',
 'How to use the POS panel to create a new order: pick a customer from the dropdown or add a walk-in, add items, choose pickup or delivery, and take payment (online/offline).',
 '', 8),

('11111111-1111-1111-1111-100000000003', 'Managing Orders & Order Statuses', 'Orders',
 'How the order pipeline works: pending -> baking -> ready -> out for delivery -> delivered. Admin/Staff move an order up to "ready"; for home-delivery orders, only the assigned delivery partner can mark it out for delivery and delivered.',
 '', 8),

('11111111-1111-1111-1111-100000000004', 'Assigning a Delivery Partner', 'Orders',
 'Once a delivery order is marked "ready", use the Assign button to hand it to a delivery partner. The system generates an OTP that the customer sees on Track Order; the partner must enter it to mark the order delivered.',
 '', 5),

('11111111-1111-1111-1111-100000000005', 'Delivery Partner Workflow', 'Delivery',
 'For delivery-role users: your Orders page only shows orders assigned to you. Tap "Start Delivery" when you leave the shop, and "Mark Delivered" once you hand over the order and the customer gives you their OTP.',
 '', 5),

('11111111-1111-1111-1111-100000000006', 'Product Catalog: Add, Edit, Delete', 'Product Catalog',
 'How to manage the public-facing product catalog: add a new product with an image, edit price/description, and remove discontinued items. Separate from raw-material Inventory.',
 '', 6),

('11111111-1111-1111-1111-100000000007', 'Inventory & Stock Management', 'Inventory',
 'Tracking raw materials and stock levels, uploading item images, understanding stock status (In Stock / Low / Out of Stock), and how stock auto-updates when a Purchase Order is received.',
 '', 7),

('11111111-1111-1111-1111-100000000008', 'Creating Purchase Orders', 'Purchase Orders',
 'How to raise a Purchase Order to a supplier for restocking, track its status (Draft -> Ordered -> Received -> Cancelled), and how receiving a PO automatically updates inventory quantities.',
 '', 6),

('11111111-1111-1111-1111-100000000009', 'Managing Suppliers', 'Suppliers',
 'Adding and editing supplier records, linking suppliers to purchase orders, and reviewing supplier order history and amounts.',
 '', 4),

('11111111-1111-1111-1111-100000000010', 'Recipes & Production Batches', 'Production',
 'Defining recipes (ingredients per product) and planning production batches through their lifecycle: Planned -> In Progress -> Completed.',
 '', 6),

('11111111-1111-1111-1111-100000000011', 'Handling Returns & Refunds', 'Returns',
 'The damage/return flow modeled on e-commerce returns: customer requests a return, admin approves and assigns a pickup partner (with pickup OTP), partner confirms pickup, and the refund is issued to the customer bank account.',
 '', 7),

('11111111-1111-1111-1111-100000000012', 'Restock Alerts', 'Inventory',
 'Understanding restock alerts: how items get flagged (Low/Critical severity), acknowledging an alert, and marking it resolved once restocked.',
 '', 3),

('11111111-1111-1111-1111-100000000013', 'Reports Dashboard', 'Reports',
 'Walkthrough of all six report tabs: Daily Sales, Monthly Sales, Inventory, Production, Purchase, and Profit — what each one shows and how to read it.',
 '', 8),

('11111111-1111-1111-1111-100000000014', 'Customer Management', 'Customers',
 'Viewing customer records, order history and total spend, and how customers link to their online accounts for order tracking.',
 '', 4),

('11111111-1111-1111-1111-100000000015', 'Store Settings', 'Settings',
 'Configuring the bakery''s public-facing contact details and other store-wide settings shown to customers.',
 '', 3),

('11111111-1111-1111-1111-100000000016', 'User Roles & Permissions', 'Basics',
 'How to change a user''s role (Admin, Staff, Customer, Delivery, Supplier) and what each role can see and do across the system.',
 '', 4),

('11111111-1111-1111-1111-100000000017', 'Invoices & Payments', 'Orders',
 'How invoices are generated per order, the difference between online and offline payment status, and how invoice status updates to "paid" on delivery.',
 '', 4),

('11111111-1111-1111-1111-100000000018', 'Product Reviews', 'Product Catalog',
 'How customers rate and review products after delivery, and where to view review scores in the catalog.',
 '', 3),

('11111111-1111-1111-1111-100000000019', 'Discounts & Coupons', 'Orders',
 'How coupon codes work end to end. WHAT IT IS: a coupon is a short code (e.g. WELCOME10) that knocks a percentage or a flat rupee amount off a cart before checkout. Admin creates codes under Sidebar -> Product Catalog -> Discounts & Coupons, setting: discount type (% or flat Rs off), an optional minimum order amount the cart must reach, an optional max Rs cap (so a "20% off" code cannot discount a huge order by too much), an optional total usage limit across all customers, an optional per-customer limit, and an optional valid-from/valid-until date range. A coupon can be disabled at any time without deleting it (its past usage stays on record). HOW TO USE IT (staff/admin at POS, or a customer at online checkout): open the cart, type the code into the "Coupon code" box above the order total, and tap Apply. The system checks the code live (is it active, has it expired, does the cart meet the minimum, has it been used up already) and shows either a green "applied - you saved Rs X" message or a red error explaining why it did not work. The discount line appears between Subtotal and the Delivery charge, and the Total updates immediately. Tap Remove to take a coupon back off before placing the order. WHERE IT SHOWS UP AFTERWARDS: the applied coupon code and discount amount are saved on the order and appear on the Orders table, the printed/emailed receipt, and the on-screen order confirmation - so it is always clear after the fact which orders had a discount and how much it was worth. Every coupon rule (minimum order, usage limits, expiry) is re-checked on the server when the order is actually placed, not just when the code is typed in, so it cannot be tricked by editing the page.',
 '', 6),

('11111111-1111-1111-1111-100000000020', 'Adding an Inventory Item or Product: Every Field Explained', 'Basics',
 'This lesson walks through both "Add" forms field by field, so you know exactly what to type into each box. There are two similar-looking forms in the system — Inventory (raw materials/stock) and Product Catalog (what customers see and order) — and they ask for slightly different things.

INVENTORY FORM (Sidebar -> Inventory -> + Add Item):
- Item name: what the ingredient/stock item is called, e.g. "All-purpose Flour". Keep it short and consistent so it is easy to search later.
- Product image (required for new items): click Choose File and pick a photo from your device. The system automatically resizes and compresses it for you — you do not need to shrink it yourself. This image is what shows on the New Order product grid instead of a generic icon.
- Quantity: how much of this item is currently in stock, as a plain number (e.g. 25).
- Unit: pick the unit that number is measured in — kg, g, L, ml, pcs, doz, or pack.
- Min stock (reorder level): the quantity below which this item should be flagged as Low/Critical stock and trigger a restock alert. Set this to whatever level means "we are about to run out."
- Cost per unit (Rs): how much the bakery pays per single unit when buying this item — used to calculate stock value and the suggested selling price.
- Preferred supplier (optional): pick which supplier you usually restock this item from. Leave as "None" if there is no fixed supplier yet.

PRODUCT CATALOG FORM (Sidebar -> Product Catalog -> + New Product):
- Product name: the customer-facing name of the finished item being sold, e.g. "Chocolate Cake".
- SKU: a short unique code to identify this product internally, e.g. "CAKE-CHOC-001". Make it unique — no two products should share an SKU.
- Product image (required): same as Inventory — Choose File, pick a photo, and it is auto-compressed. This is the photo customers see in the catalog and on the New Order page.
- Category: which group this product belongs to, e.g. Cakes, Breads, Cookies. Used for filtering the catalog.
- Selling price (Rs): the price charged to the customer for one unit of this product.
- Linked recipe (optional): connect this product to a Recipe so the system knows which raw ingredients/inventory it consumes when produced. Leave as "Not linked" if there is no recipe set up yet.
- Description (optional): a short sentence shown to customers describing the product.
- Available for sale (checkbox): tick this on to let the product appear and be orderable in the catalog; untick to hide it (e.g. temporarily out of season) without deleting it.

QUICK RULE OF THUMB: use Inventory for raw materials and ingredients you track stock levels for; use Product Catalog for the finished items customers actually order. A photo is mandatory on both forms when adding a brand-new entry — editing an existing item keeps its current photo unless you replace it.',
 '', 6);
