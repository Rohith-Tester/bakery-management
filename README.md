# Golden Crust Bakery — Bakery Management System

A complete bakery management application built in plain **PHP + MySQL** on the
backend and a **vanilla JavaScript single-page app** on the frontend — no
framework, no build step, no Node.js required. Everything from taking an
order to scheduling a production batch to reordering flour from a supplier
lives in one app, gated behind five different account roles.

---

## Table of contents

1. [Requirements](#requirements)
2. [Setup — fresh install](#setup--fresh-install)
3. [Setup — updating an existing database](#setup--updating-an-existing-database)
4. [Roles & logging in](#roles--logging-in)
5. [Quick-start walkthrough by role](#quick-start-walkthrough-by-role)
6. [How to use each module](#how-to-use-each-module)
7. [Payment methods & the delivery charge](#payment-methods--the-delivery-charge)
8. [Security notes](#security-notes)
9. [Project structure](#project-structure)
10. [API reference](#api-reference)
11. [Migration reference](#migration-reference)

---

## Requirements
- PHP 7.4+ with the `pdo_mysql` extension
- MySQL 5.7+ / MariaDB 10.3+
- Any web server — PHP's built-in server, Apache, Nginx, XAMPP, WAMP, MAMP, etc.

## Setup — fresh install

**1. Create the database and import the schema (tables, plus a small starter set of Inventory ingredients — no demo customers/orders):**
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bakery_db"
mysql -u root -p bakery_db < sql/schema.sql
```
(`schema.sql` also contains `CREATE DATABASE IF NOT EXISTS`, so you can instead
just run `mysql -u root -p < sql/schema.sql`.)

**2. Point the app at your database** — edit `config/db.php`:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'bakery_db');
define('DB_USER', 'root');
define('DB_PASS', '');
```

**3. Run it.**

Quickest way, from the project root:
```bash
php -S localhost:8000
```
Then open `http://localhost:8000`.

Or with XAMPP/WAMP/MAMP: copy the whole `bakery_php` folder into `htdocs`
(or `www`), start Apache + MySQL from the control panel, then visit
`http://localhost/bakery_php/`.

**4. Log in** with the seeded admin account (see [Roles](#roles--logging-in)
below) and **change the password immediately**.

## Setup — updating an existing database

If you already have data in an older copy of this app, don't re-run
`schema.sql` (it drops and recreates tables). Instead run only the migrations
you're missing, in this order:

```bash
mysql -u root -p bakery_db < sql/migrate_users_roles.sql
mysql -u root -p bakery_db < sql/migrate_payment.sql
mysql -u root -p bakery_db < sql/migrate_customer_orders.sql
mysql -u root -p bakery_db < sql/migrate_login_security.sql
mysql -u root -p bakery_db < sql/migrate_recipes.sql
mysql -u root -p bakery_db < sql/migrate_production.sql
mysql -u root -p bakery_db < sql/migrate_restock_alerts.sql
mysql -u root -p bakery_db < sql/migrate_settings_extended.sql
mysql -u root -p bakery_db < sql/migrate_suppliers.sql
mysql -u root -p bakery_db < sql/migrate_supplier_role.sql
mysql -u root -p bakery_db < sql/migrate_inventory_purchases.sql
mysql -u root -p bakery_db < sql/migrate_purchase_orders.sql
mysql -u root -p bakery_db < sql/migrate_inventory_image.sql
mysql -u root -p bakery_db < sql/migrate_inventory_image_upload.sql
mysql -u root -p bakery_db < sql/migrate_delivery_role.sql
mysql -u root -p bakery_db < sql/migrate_delivery_partner.sql
mysql -u root -p bakery_db < sql/migrate_out_for_delivery.sql
mysql -u root -p bakery_db < sql/migrate_delivery_timing.sql
mysql -u root -p bakery_db < sql/migrate_return_pickup.sql
mysql -u root -p bakery_db < sql/migrate_returns_delivery_otp.sql
mysql -u root -p bakery_db < sql/migrate_notifications.sql
mysql -u root -p bakery_db < sql/migrate_invoice_cascade.sql
mysql -u root -p bakery_db < sql/migrate_customer_user_link.sql
mysql -u root -p bakery_db < sql/migrate_product_catalog.sql
mysql -u root -p bakery_db < sql/migrate_delivery_charge.sql
mysql -u root -p bakery_db < sql/migrate_training.sql
mysql -u root -p bakery_db < sql/seed_training_lessons.sql
mysql -u root -p bakery_db < sql/migrate_product_reviews.sql
```

**If your database still has the old placeholder demo customers**
(Priya Sharma, Ravi Menon, Ananya Krishnan, Deepak Reddy, or Meera Tiwari,
plus their sample orders/invoices), remove them with:
```bash
mysql -u root -p bakery_db < sql/cleanup_demo_data.sql
```
This only deletes those specific named/emailed demo customer rows and their
orders/invoices — it does **not** touch Inventory or the Product Catalog,
and won't touch any real data you've added. The starter ingredient rows in
Inventory (flour, butter, sugar, etc.) are left in place on fresh installs
too — they're stock/product data, not "users," and give the Inventory
screen something real to look at instead of opening to a blank table. Edit
or delete them from the Inventory page if you don't want them.
Every migration is written to be **safe to re-run** — running one twice, or
running it on a database that already has the column/table, is a no-op. See
the [migration reference](#migration-reference) table for what each one adds
and whether it has a dependency on another migration running first.

---

## Roles & logging in

There is one seeded **admin** account (from `sql/schema.sql`):
```
Username: admin
Password: admin123
```
**Change this immediately** — either in-app (`POST /api/auth.php?action=change-password`
with `{ currentPassword, newPassword }` while logged in) or directly in MySQL:
```sql
UPDATE users SET password_hash = '<bcrypt hash>' WHERE username = 'admin';
```

Everyone else signs up from the **Register** tab on the login page, picking
one of: **Customer** (default), **Bakery Staff**, **Delivery Partner**, or
**Supplier**. There is no way to self-register as admin — an existing admin
must promote an account from the **Users** page, or you can run:
```sql
UPDATE users SET role = 'admin' WHERE username = 'that_username';
```

The five roles and what each one can see:

| Role | Can access |
|---|---|
| **Admin** | Everything — the full sidebar, all modules, Users, Settings. |
| **Staff** | New Order, Order Details, Production Management, Track Order, Returns & Refunds. |
| **Customer** | New Order (for themselves only), Order Details (their own orders only), Track Order. |
| **Delivery Partner** | Order Details (only orders assigned to them), Track Order, Returns & Refunds (pickup assignments). |
| **Supplier** | Supplier Restock Alerts only — sees the alerts raised against items they supply. |

Every restriction shown/hidden in the sidebar is **also enforced on the
server** in `api/_bootstrap.php` and each endpoint (`require_admin()`,
`require_staff_or_admin()`, `require_delivery()`, `require_supplier()`) — so
hiding a nav link isn't the only thing standing between a role and data it
shouldn't see.

---

## Quick-start walkthrough by role

The app ships with **no demo data** — every list (Customers, Inventory,
Orders, Product Catalog, Staff Training, etc.) is intentionally empty on a
fresh install, including right after you first log in as admin. That's not
a bug: it means nobody has to hunt down and delete placeholder rows like
"Ravi Menon" or a sample flour stock before putting real data in. Here's
the order to set things up in and what each role should actually click on.

### First login (admin)
Nothing else in the app will have anything meaningful to show until an
admin does this first-time setup, roughly in this order:
1. **Settings** — enter your real Bakery Name, phone, email, address, tax
   percentage, and business hours.
2. **Inventory** — add your real raw ingredients/stock items (name,
   quantity, unit, minimum stock, cost per unit).
3. **Suppliers** — add the suppliers you actually buy from, and link them
   to inventory items.
4. **Recipe Management** — build recipes from your real ingredients.
5. **Product Catalog** — create the sellable products customers will
   actually order (name, SKU, price, photo, optionally linked to a recipe).
6. **Staff Training** *(this is why it looked empty)* — the table starts
   empty by design; nobody pre-writes your onboarding material for you.
   Run `sql/seed_training_lessons.sql` to load a starter set of lessons
   covering how to use every module (POS, Orders, Delivery handover,
   Product Catalog, Inventory, Purchase Orders, Suppliers, Recipes &
   Production, Returns, Reports, Customers, Settings, Roles, Invoices,
   Reviews). Admins can then add/edit/remove lessons freely from the
   Staff Training screen itself.
7. **Users** — create staff/delivery-partner accounts directly here, or
   have them self-register from the login page's Register tab and then
   promote/verify their role here if needed.

Once that's done, **New Order** actually has products to sell and
inventory to deduct from, and the rest of the app comes alive.

### Staff — day to day
Log in → **New Order** to ring up a sale (pick items, delivery or pickup,
online or cash) → **Order Details** to move it through Pending → Baking →
Ready → (Out for Delivery) → Delivered, and assign a delivery partner once
it's ready → **Production Management** to schedule a batch when stock of a
finished item runs low → **Staff Training** to work through whatever the
admin has assigned and tick items off as completed.

### Customer
Register (or ask staff to place the order for you) → **New Order** to
browse the catalog and check out → **Order Details** to see your own order
history → **Track Order** with your order number to watch it move from
Pending to Delivered, including the delivery OTP once it's out for
delivery. Once an order is **Delivered**, click **⭐ Rate** on it in Order
Details (or click the product itself in New Order) to leave a star rating
and review.

### Delivery Partner
Register as a Delivery Partner → wait for staff to assign you to a ready
order in **Order Details** → mark it **Out for Delivery** (this generates
an OTP the customer sees on their Track Order page) → hand it over and
mark **Delivered** using the OTP the customer reads out to you →
**Returns & Refunds** works the same way for pickup collections.

### Supplier
Register as a Supplier → **Restock Alerts** is the only page you'll see —
it shows only the low-stock alerts raised against items you supply, so you
know what to prepare a delivery for.



### 📊 Dashboard *(admin only)*
Landing page for admins: today's orders, today's revenue, customer count,
low-stock item count, a weekly revenue chart, and a list of recent orders
with quick links.

### 🧾 New Order *(admin, staff, customer)*
The point-of-sale style order screen. Browse real inventory items as tiles
(with photos), add them to a cart, and check out:
1. Pick items — out-of-stock items are shown disabled.
2. **Click a product's photo/name** (not the Add to Cart button) to open its
   detail panel below the grid — price, average star rating, and every
   customer review, Flipkart-style. See
   [Customer Reviews & Ratings](#-customer-reviews--ratings) below for how
   reviews get there and who can leave one.
3. Enter/select the customer (staff/admin can search existing customers or
   type a new name; customers order as themselves automatically).
4. Choose **Store Pickup** or **Home Delivery** (delivery needs an address).
5. Choose **Cash/Offline** or **Pay Online**. See
   [Payment methods & the delivery charge](#payment-methods--the-delivery-charge)
   below — home delivery paid online adds a flat delivery charge to the total.
6. Place the order. This deducts the ordered quantities from real inventory
   stock immediately and creates an invoice (`paid` for online orders,
   `unpaid` for offline until settled at Sales & Billing).

### ⭐ Customer Reviews & Ratings *(customers write; everyone reads)*
Lets real buyers rate and review the items they've actually received —
shown right on the product itself, the way Flipkart or Amazon shows
reviews on a product page.

**How a customer leaves a review:**
1. Wait until an order is marked **Delivered** (Track Order will confirm
   this — see [Track Order](#-track-order-everyone-including-the-public-style-lookup)).
2. There are two ways in:
   - Go to **New Order**, click that product's photo/name to open its
     detail panel, and if you have a delivered order containing it, a
     **"Rate this product"** box appears with a 5-star picker and an
     optional comment.
   - Or go to **Order Details**, find the delivered order, and click
     **⭐ Rate** — this opens every item from that order that you haven't
     already reviewed, each with its own star picker and comment box.
3. Submit. The review appears immediately under that product for everyone
   to see, and the product's average rating (e.g. "★★★★☆ 4.2 (18)") updates
   everywhere that item is shown.

**Rules enforced server-side (not just hidden in the UI):**
- Only a **customer** account can submit a review — staff/admin/delivery/
  supplier accounts can't post one.
- The order must belong to you and be **Delivered** — you can't review
  something still Pending or Baking, and you can't review someone else's
  order.
- One review per item **per order** — order the same croissant again later
  and that's a fresh, independent review opportunity; you can't review the
  same delivered item from the same order twice.
- You can delete your own review at any time from the product detail
  panel; **admins can also delete any review** (moderation for
  inappropriate content) — nobody else can touch another customer's review.

This module is read-only for everyone who isn't the review's author or an
admin — there's no "helpful/unhelpful" voting or seller replies, just
straightforward star ratings and comments.

### 🛒 Order Details *(admin, staff, customer, delivery)*
A filterable table of every order (or, for customers/delivery partners, only
the orders relevant to them). Staff/admin can:
- Move an order through its status pipeline: **Pending → Baking → Ready →
  (Out for Delivery, if home delivery) → Delivered**.
- Assign a delivery partner to a home-delivery order once it's ready.
- View/print/download a receipt for any order.
- Delete an order (admin only).

Delivery partners see only orders assigned to them and can advance
**Ready → Out for Delivery → Delivered**; marking an order *Delivered*
requires the OTP shown to the customer on their Track Order page, so a
parcel can't be closed out without actually handing it to the right person.

### 📍 Track Order *(everyone, including the public-style lookup)*
Look up any order by its order number to see a visual status timeline, and
— once delivered — whether it arrived early, on time, or late against the
requested date.

### ↩️ Returns & Refunds *(admin, staff, delivery)*
Log a return/refund against a delivered order, move it through its own
status pipeline, and — for pickup returns — assign a delivery partner to
collect the item back, confirmed with an OTP the same way deliveries are.

### 🧁 Product Catalog *(admin only)*
The **sellable listing** for each finished product — separate from a
recipe, which is the *method* for making it. For every product you store:
- **Name** (e.g. "Chocolate Cake", "Chicken Biriyani")
- **SKU** (unique product code)
- **Category** (Cakes, Breads, Cookies, …) — filterable in the catalog view
- **Selling price**
- **Product image** (upload a photo — stored directly with the product, no
  separate file server needed)
- **Availability** (a toggle for "available for sale" vs. temporarily pulled)
- An optional **linked recipe**, so a product can point at the recipe that
  makes it without being forced to have one

Use this to manage what's actually being sold, independent of whether a
recipe or inventory tie-in exists yet for it.

### 📖 Recipe Management *(admin creates/edits, staff/admin can view)*
The *method* for making a baked good: name, category, yield (e.g. "1
batch" or "12 loaves"), prep/bake time, step-by-step instructions, and a
list of ingredient lines. Each ingredient line can link to a real inventory
item (its cost is pulled live from that item's current cost-per-unit) or be
a free-text ingredient not carried in stock. Cost per batch, cost per unit,
and a suggested retail price are computed automatically. A recipe can
optionally link to the finished-goods inventory item it produces.

### 🥖 Production Management *(admin schedules; staff/admin run it)*
Schedule a **production batch** from a recipe, scaling the yield up or down
with a multiplier. The ingredients and their cost are snapshotted onto the
batch the moment it's scheduled, so a later recipe edit never rewrites a
batch already in flight. Move a batch through **Planned → In Progress →
Completed** (or cancel it). Completing a batch is the only step that
touches real stock — it deducts every ingredient from inventory (rejecting
the whole request up front if anything would go negative) and adds the
finished quantity to the linked output item.

### 📦 Inventory *(everyone can view; admin writes)*
Add/edit/delete raw ingredients and stock items: name, product image,
quantity, unit, minimum stock (reorder level), cost per unit, and a
preferred supplier. Shows a live stock-level bar and a low/critical status
badge. Any logged-in account can *view* stock (it powers the New Order item
picker); only admins can add, edit, or delete items.

### 🔔 Supplier Restock Alerts *(admin manages; supplier accounts view their own)*
A live, always-current view of every low/critical-stock inventory item,
grouped by its preferred supplier. From here staff/admin can raise an alert
for one item (or raise alerts for everything low in one click) — this logs
the alert and pings the notification bell. A **Create Purchase Order**
shortcut per supplier opens a new PO pre-filled with that supplier's low
items at a suggested reorder quantity. Alerts move through **Open →
Acknowledged → Resolved**, so the same low item won't keep getting
re-flagged. Supplier accounts see only alerts for items they supply.

### 🚚 Suppliers *(admin only)*
Add/edit/delete suppliers: name, contact details, and the items they
provide. Inventory items reference a preferred supplier, and Restock Alerts
groups by this.

### 📋 Purchase Orders *(admin only)*
Create a purchase order against a supplier — a list of items, quantities,
and costs — and move it through **Draft → Ordered → Received** (or
Cancelled). Marking a PO **Received** adds the ordered quantities straight
into inventory stock, so restocking from a supplier and updating stock
levels is one action instead of two.

### 👥 Customers *(read: admin + staff; write: admin only)*
Add/edit/delete customer records, search, and see each customer's total
spend (admin only) to spot your top spenders.

### 💳 Sales & Billing *(admin only)*
Every invoice generated from an order, with revenue totals. Mark an offline
invoice as paid once payment is actually collected in person; delete an
invoice if needed.

### 📈 Reports *(admin only)*
A reporting dashboard: revenue and order trends, best-selling items, and
other summary breakdowns pulled from historical order/invoice data.

### 🔑 Users *(admin only)*
Promote or demote any account between Admin / Staff / Customer / Delivery
Partner / Supplier, filter the list by role, and delete accounts.

### ⚙️ Settings *(admin only)*
Configure the business itself: Bakery Name, GST Number, Phone, Email,
Address, Tax Percentage, Currency, and Business Hours. Phone/Email/Address
also surface publicly on the login page and Order Details for customers who
would rather call in an order than place it online.

### 🚚 About "Delivery Management"
This app does **not** have a page called Delivery Management, and this
README doesn't document one — a separate module wasn't added because it
would duplicate data already covered by existing modules. If you're
looking for delivery-related features, here's where each piece actually
lives:

| Delivery step | Where it happens |
|---|---|
| Customer/staff chooses home delivery + address | New Order |
| Order marked Ready, then assigned to a delivery partner | Order Details (staff/admin) |
| Delivery partner marks Out for Delivery / Delivered | Order Details, filtered to their own assigned orders (OTP-confirmed) |
| Customer sees delivery OTP + on-time/late status | Track Order |
| Pickup for a return | Returns & Refunds |
| Managing delivery partner accounts | Users (filter by role `delivery`) |

A dedicated module would only be worth building if you need something none
of the above already gives you — e.g. one screen showing every partner's
current workload, delivery turnaround-time reports, or performance
ratings. None of that exists in the app today.


### 🔔 Notifications *(admin, staff)*
A notification bell in the top bar surfaces events like new orders, low
stock, and raised restock alerts, with an unread badge and mark-as-read /
mark-all-as-read actions.

### 🎓 Staff Training *(admin manages content; staff/admin track their own progress)*
A simple training library so onboarding and refresher material lives in
the app instead of scattered PDFs or WhatsApp messages. It ships **empty**
— see [Quick-start walkthrough by role](#quick-start-walkthrough-by-role)
for why. Here's exactly how to use it:

**As admin — adding a training item:**
1. Go to **Administration → Staff Training** in the sidebar.
2. Click **+ New Material** (top right of the table).
3. Fill in:
   - **Title** — e.g. "Food Hygiene Basics"
   - **Category** — e.g. "Safety" (free text — used to power the category
     filter dropdown, so reuse the same word across related items)
   - **Duration (minutes)** — a rough estimate, e.g. `15`
   - **Resource link** *(optional)* — a URL to a video, PDF, or doc you
     host elsewhere (Google Drive, YouTube, etc.) — shown as a clickable
     "🔗 Open resource" link in the table
   - **Description / instructions** — the actual content, or a summary of
     what the resource covers
4. Click **Add Material**. It now appears in the table for every staff and
   admin account immediately — nothing further to publish or activate.
5. To fix a mistake later, click **Edit** on that row; to remove it
   entirely, click the **✕** delete button (this also wipes everyone's
   completion record for it).

**As staff (or admin) — working through training:**
1. Go to **Staff Training**. Every item added by an admin is listed with
   its category, estimated duration, how many of the team have completed
   it so far ("Team Progress"), and your own status ("My Status").
2. Read the description and/or open the resource link.
3. Click **Mark Complete**. Your row instantly flips to "✓ Completed" and
   the team progress count goes up by one. This is personal to your own
   account — you can't mark it complete for a co-worker.
4. If you need to redo it later (e.g. a quarterly refresher), click
   **Mark Incomplete** to reset your own status, then **Mark Complete**
   again once you've redone it.
5. Use the category dropdown or the search box to narrow down a long list.

A few things worth knowing:
- This module intentionally does **not** gate any other part of the app —
  it's a tracked library, not an enforced prerequisite. Staff can still
  take orders whether or not they've completed a given training item.
- If you later want to *require* certain training before, say, a staff
  account can process orders, that would need to be built as an explicit
  check in `New Order` or at login, which doesn't exist today.

---

## Payment methods & the delivery charge

When placing an order, the person picks **Cash/Offline** or **Pay Online**:

- **Offline** — the invoice is created `unpaid`; mark it paid later from
  Sales & Billing once cash/card is actually collected.
- **Online** — a realistic (but fully simulated) checkout: a **Card** tab
  with a live card preview and formatted number/expiry/CVV inputs, or a
  **UPI** tab with a UPI ID field and a QR code. "Pay" shows a genuine
  processing state for ~1.5s, then success with a generated transaction ID.
  **No real card or bank details are transmitted or stored** — only a fake
  transaction ID and the card's last 4 digits are saved
  (`payment_txn_id` / `payment_card_last4`) for the receipt. The invoice is
  marked `paid` immediately. To wire up a real payment gateway (Razorpay,
  PayU, Stripe, etc.) later, swap the simulated "Pay" handler in
  `assets/app.js` (`wirePaymentPanel`) for that gateway's SDK, and use its
  real transaction ID/webhook instead of `fakeTxnId()`.

**Delivery charge:** a flat ₹50 delivery charge is automatically added to
the order total whenever **both** of these are true:
- the customer chose **Home Delivery** (not store pickup), **and**
- they're paying **Online** (not cash/offline)

Cash/offline delivery orders and all store-pickup orders are never charged
this — offline delivery is settled in person, where the shop can handle
delivery costs however it likes. The charge is calculated and enforced
**server-side** in `api/orders.php` (the `DELIVERY_CHARGE` constant — change
the amount there if ₹50 isn't right for you), shown live on the order form
before checkout (subtotal, delivery charge, and grand total broken out
separately), and itemized on the printable receipt and the Order Details
table (a small "incl. ₹50 delivery" note under the total). It's stored per
order in `orders.delivery_charge` so historical orders keep their original
charge even if you change the constant later.

---

## Security notes
- **Admin accounts can never be created via Register.** The endpoint
  validates `role` against a strict allow-list (`customer`/`staff`/
  `delivery`/`supplier`) and rejects anything else with `403` — it never
  silently downgrades an unexpected value.
- **Reserved usernames** (`admin`, `root`, `system`, etc.) can't be
  self-registered, so nobody can impersonate the real admin account by name.
- **Username/password rules are enforced server-side**: usernames 3–30
  chars (letters/numbers/`._-` only); passwords need 8+ characters with at
  least one letter and one number.
- **Login is rate-limited** — 5 failed attempts for a given username+IP
  locks further attempts out for 15 minutes.
- **Session cookies are hardened**: `HttpOnly`, `SameSite=Lax`, and
  `Secure` automatically over HTTPS. The session ID is regenerated on every
  successful login/register to prevent session fixation.
- **CORS never uses a wildcard** — the API only ever echoes back the exact
  request origin when it matches the app's own host, never combined with a
  wildcard `Allow-Credentials`.
- **All database queries use PDO prepared statements** — no
  string-concatenated SQL anywhere.
- Every role check shown/hidden in the UI is **also enforced on the API**
  (`require_admin()`, `require_staff_or_admin()`, `require_delivery()`,
  `require_supplier()` in `api/_bootstrap.php`), so hiding a button is never
  the only thing stopping an unauthorized request.

---

## Project structure
```
bakery_php/
├── index.php               # SPA shell (sidebar + loads assets/app.js) — requires login
├── login.php                # Login + Register page
├── assets/
│   ├── style.css            # All styling
│   └── app.js                 # SPA logic: routing, rendering, API calls, all modals
├── api/                      # PHP REST endpoints (JSON in/out)
│   ├── _bootstrap.php        # shared headers/helpers/session guard/role checks
│   ├── auth.php               # login / register / logout / session check / change password
│   ├── dashboard.php          # admin only
│   ├── orders.php              # create/list/update orders (delivery charge lives here)
│   ├── returns.php             # returns & refunds
│   ├── products.php            # Product Catalog
│   ├── recipes.php             # Recipe Management
│   ├── production.php          # Production Management
│   ├── inventory.php           # stock items
│   ├── restock_alerts.php      # low-stock alert log
│   ├── suppliers.php           # supplier directory
│   ├── purchase_orders.php     # supplier purchase orders
│   ├── delivery_partners.php   # delivery partner directory
│   ├── customers.php           # customer directory
│   ├── invoices.php            # billing
│   ├── reports.php             # reporting dashboard
│   ├── notifications.php       # notification bell
│   ├── users.php               # admin: manage accounts/roles
│   ├── settings.php            # public read / admin write business settings
│   └── track.php               # public — no login required
├── config/
│   ├── db.php                # PDO/MySQL connection settings
│   └── session.php           # session bootstrap/cookie hardening
└── sql/
    ├── schema.sql              # full schema + starter Inventory rows, no demo customers (fresh installs)
    ├── cleanup_demo_data.sql   # one-time cleanup for DBs still holding old demo customers
    └── migrate_*.sql           # one migration per feature, safe to re-run
```

## API reference
All endpoints return JSON, base path `/api`. Endpoints not listed here
(`auth.php`, `dashboard.php`, `inventory.php`, `customers.php`,
`invoices.php`, `track.php`) behave as previously documented and are
unchanged. Newer/updated endpoints:

| Endpoint | Method | Notes |
|---|---|---|
| `orders.php` | GET | List orders, optional `?status=pending\|baking\|ready\|out_for_delivery\|delivered` |
| `orders.php` | POST | Create order `{ customerName, items:[{name,qty,price}], deliveryType:'pickup'\|'delivery', deliveryAddress?, paymentMethod:'online'\|'offline', payment? }`. Response includes `deliveryCharge` and a `total` that already has it added. |
| `orders.php?id=X&action=status` | PATCH | Update status `{ status, otp? }` |
| `orders.php?id=X&action=delivery-partner` | PATCH | Assign a delivery partner |
| `reviews.php` | GET | No params: bulk `{ itemName: {averageRating, reviewCount} }` summary for every item (product tile badges) |
| `reviews.php?item=NAME` | GET | Full detail + review list for one item |
| `reviews.php?reviewableItem=NAME` / `?reviewableForOrder=ID` | GET | **Customer only.** What's eligible to review right now |
| `reviews.php` | POST | **Customer only.** `{ orderId, itemName, rating, comment }` — order must be theirs and `delivered` |
| `reviews.php?id=X` | PATCH / DELETE | Review author only (DELETE also allowed for admin moderation) |
| `returns.php` | GET / POST / PATCH | Returns & refunds, incl. pickup-partner assignment |
| `products.php` | GET / POST / PATCH / DELETE | **Admin writes; staff/admin read.** Product Catalog CRUD |
| `recipes.php` | GET / POST / PATCH / DELETE | **Admin writes; staff/admin read.** Recipe CRUD with computed costs |
| `production.php` | GET / POST / PATCH / DELETE | Schedule/run production batches |
| `restock_alerts.php` | GET / POST / PATCH / DELETE | Raise/track low-stock alerts |
| `suppliers.php` | GET / POST / PATCH / DELETE | **Admin only.** Supplier directory |
| `purchase_orders.php` | GET / POST / PATCH / DELETE | **Admin only.** PO lifecycle, Received restocks inventory |
| `delivery_partners.php` | GET | Directory of delivery-partner accounts |
| `reports.php` | GET | `?type=...` reporting breakdowns |
| `notifications.php` | GET / PATCH | List / mark read |
| `users.php` | GET / POST / PATCH / DELETE | **Admin only.** Manage accounts + roles |
| `settings.php` | GET | Public — business name/contact/tax/hours |
| `settings.php` | PATCH | **Admin only.** Update business settings |
| `training.php` | GET / POST / PATCH / DELETE | Staff/admin read; **admin writes materials**. `?id=X&action=complete` (PATCH) lets any staff/admin toggle *their own* completion — no admin check on that one action |

## Migration reference

| Migration | Adds | Depends on |
|---|---|---|
| `migrate_users_roles.sql` | `users` table with roles | — |
| `migrate_payment.sql` | `payment_method` on orders | — |
| `migrate_customer_orders.sql` | `customer` role, order↔account link, payment columns | `migrate_users_roles.sql` |
| `migrate_login_security.sql` | brute-force login lockout table | — |
| `migrate_recipes.sql` | `recipes`, `recipe_ingredients` | — |
| `migrate_production.sql` | `production_batches`, `production_batch_ingredients` | `migrate_recipes.sql` |
| `migrate_restock_alerts.sql` | `restock_alerts` | — |
| `migrate_settings_extended.sql` | Bakery Name/GST/Tax/Currency/Hours on `store_settings` | `migrate_store_settings.sql` (only if `store_settings` doesn't exist yet) |
| `migrate_suppliers.sql` | `suppliers` table | — |
| `migrate_supplier_role.sql` | `supplier` account role | `migrate_users_roles.sql` |
| `migrate_inventory_purchases.sql` | supplier link + purchase history on inventory | `migrate_suppliers.sql` |
| `migrate_purchase_orders.sql` | `purchase_orders`, `purchase_order_items` | `migrate_suppliers.sql` |
| `migrate_inventory_image.sql` | `image_url` on inventory | — |
| `migrate_inventory_image_upload.sql` | widens `image_url` to `LONGTEXT` for uploaded photos | `migrate_inventory_image.sql` |
| `migrate_delivery_role.sql` | `delivery` account role | `migrate_users_roles.sql` |
| `migrate_delivery_partner.sql` | delivery partner assignment columns on orders | `migrate_delivery_role.sql` |
| `migrate_out_for_delivery.sql` | `out_for_delivery` order status | `migrate_delivery_partner.sql` |
| `migrate_delivery_timing.sql` | `delivered_at` timestamp, early/on-time/late tracking | `migrate_out_for_delivery.sql` |
| `migrate_return_pickup.sql` | `returns` table + pickup-partner assignment | `migrate_delivery_partner.sql` |
| `migrate_returns_delivery_otp.sql` | OTP confirmation on return pickups | `migrate_return_pickup.sql` |
| `migrate_notifications.sql` | `notifications` table | — |
| `migrate_invoice_cascade.sql` | cascading delete behavior on invoices | — |
| `migrate_customer_user_link.sql` | back-fills `customers` rows for customer accounts | `migrate_customer_orders.sql` |
| `migrate_product_catalog.sql` | `products` table (Product Catalog) | `migrate_recipes.sql` (for the optional recipe link) |
| `migrate_delivery_charge.sql` | `delivery_charge` column on orders | `migrate_payment.sql`, `migrate_delivery_partner.sql` |
| `migrate_training.sql` | `training_materials`, `training_completions` | `migrate_users_roles.sql` |
| `migrate_product_reviews.sql` | `product_reviews` table | `migrate_customer_orders.sql`, `migrate_delivery_timing.sql` (needs `orders.user_id` and delivered-order tracking) |

---

## Notes on the conversion
This is a plain PHP + MySQL app end to end — no Node.js, no React, no build
step. The frontend is a small vanilla-JS single-page app (hash-based
routing in `assets/app.js`) that talks to the PHP API with `fetch()`, so you
can literally just open `index.php` in a browser once the database and
`config/db.php` are set up.
