# Bake & Co — Management (PHP + MySQL edition)

This is a full PHP + MySQL rewrite of the original Node.js/React bakery management app.
Same features, same look, no Node.js or React involved — plain PHP on the backend and
vanilla HTML/CSS/JS on the frontend.

## Features (matching the original app)
- **Login with roles** — the whole app sits behind a sign-in page.
  - **Admin** — full access to everything.
  - **Staff** — can sign themselves up from the login page's "Register" tab; staff accounts
    can only view/create orders and update order status. Everything else (Dashboard,
    Inventory, Customers, Sales & Billing) is hidden and blocked at the API level too.
- **Dashboard** — today's orders, revenue, customers, low-stock count, weekly revenue chart, recent orders, quick actions
- **Orders** — create orders (multi-item), choose **Cash/Offline** or **Online (UPI/QR)** payment, filter by status, update status, delete orders (admin only)
- **Inventory** — add/edit/delete ingredients, stock-level bar, low/critical status, search
- **Customers** — add/edit/delete customers, search, top spender
- **Sales & Billing** — invoices auto-created per order, mark invoices as paid, revenue totals
- **Track Order** (public-style page) — look up an order by order number and see a status timeline

## Logins & roles
There is one seeded **admin** account (from `sql/schema.sql`):

```
Username: admin
Password: admin123
```

**Change this immediately after your first login** — either:
- In-app: call `POST /api/auth.php?action=change-password` with `{ currentPassword, newPassword }` while logged in, or
- Directly in MySQL: `UPDATE users SET password_hash = '<bcrypt hash>' WHERE username = 'admin';`
  (generate a hash with `password_hash('yourNewPassword', PASSWORD_DEFAULT)` in a PHP shell).

**Staff accounts** are created by the staff member themselves via the **Register** tab on the
login page — no admin credentials are shown on that page. Every account created through
Register gets the `staff` role automatically; there is no way to self-register as admin.
Staff can only reach the Orders page and the order-status actions; the API rejects any
Dashboard/Inventory/Customers/Invoices request from a staff session with `403 Admins only`,
and rejects order deletion from staff with the same error.

If you want to promote a staff account to admin later, run:
```sql
UPDATE users SET role = 'admin' WHERE username = 'that_username';
```

Already have data and don't want to re-import everything? Run the migration instead:
```bash
mysql -u root -p bakery_db < sql/migrate_users_roles.sql
mysql -u root -p bakery_db < sql/migrate_payment.sql
```
`migrate_users_roles.sql` safely upgrades either a fresh DB or one that already has the
older `admin_users` table (from a previous version of this project) into the new `users`
table with roles.

## Payment method (Online / Offline)
When creating a new order, staff pick **Cash/Offline** or **Online (UPI/QR)**:
- **Offline** — invoice is created `unpaid`, same as before; mark it paid manually from Sales & Billing.
- **Online** — a QR code is shown (generated via `api.qrserver.com`, a free public QR-image service —
  this is a **demo QR**, not wired to a real payment gateway). The order's invoice is marked `paid`
  immediately, simulating a completed UPI payment. To integrate a real gateway (Razorpay, PayU, etc.)
  later, swap the QR image + "paid immediately" logic in `api/orders.php` for that gateway's SDK/webhook.

## Requirements
- PHP 7.4+ (with the `pdo_mysql` extension enabled)
- MySQL 5.7+ / MariaDB 10.3+
- Any web server: PHP's built-in server, Apache, Nginx, XAMPP, WAMP, MAMP, etc.

## 1. Create the database
Import the schema + seed data:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bakery_db"
mysql -u root -p bakery_db < sql/schema.sql
```

(The schema file also contains `CREATE DATABASE IF NOT EXISTS bakery_db`, so you can also just run:
`mysql -u root -p < sql/schema.sql`)

This creates the `customers`, `inventory`, `orders`, `order_items`, and `invoices` tables and
seeds them with the same sample data the original Node app shipped with.

## 2. Configure the DB connection
Edit `config/db.php` and set your MySQL credentials:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'bakery_db');
define('DB_USER', 'root');
define('DB_PASS', '');
```

## 3. Run it

**Quick start with PHP's built-in server** (from the project root):
```bash
php -S localhost:8000
```
Then open http://localhost:8000 in your browser.

**Or with XAMPP/WAMP/MAMP:** copy this whole folder into your `htdocs` (or `www`) directory,
start Apache + MySQL from the control panel, then visit `http://localhost/bakery_php/`.

## Project structure
```
bakery_php/
├── index.php            # Single-page app shell (loads assets/app.js) — requires login
├── login.php             # Admin sign-in page
├── assets/
│   ├── style.css         # All styling (same design as the original)
│   └── app.js             # SPA logic: routing, rendering, API calls
├── api/                   # PHP REST endpoints (JSON in/out)
│   ├── _bootstrap.php     # shared headers/helpers/session guard/require_admin()
│   ├── auth.php           # login / register / logout / session check / change password
│   ├── dashboard.php      # admin only
│   ├── orders.php         # admin + staff (delete is admin only)
│   ├── inventory.php      # admin only
│   ├── customers.php      # read: admin + staff · write: admin only
│   ├── invoices.php       # admin only
│   └── track.php          # public — no login required
├── config/
│   └── db.php             # PDO/MySQL connection settings
└── sql/
    ├── schema.sql               # Tables + seed data (fresh install)
    ├── migrate_users_roles.sql  # Adds users/roles table to an existing DB
    └── migrate_payment.sql      # Adds payment_method column to an existing DB
```

## API reference
All endpoints return JSON. Base path: `/api`

| Endpoint | Method | Notes |
|---|---|---|
| `auth.php?action=login` | POST | `{ username, password }` — starts a session |
| `auth.php?action=register` | POST | `{ username, password }` — public sign-up, always creates a `staff` account |
| `auth.php?action=logout` | POST | Ends the session |
| `auth.php?action=check` | GET | `{ loggedIn: bool, role }` |
| `auth.php?action=change-password` | POST | `{ currentPassword, newPassword }` |
| `dashboard.php` | GET | **Admin only.** Summary metrics + recent orders + weekly sales |
| `orders.php` | GET | List orders, optional `?status=pending\|baking\|ready\|delivered` |
| `orders.php` | POST | Create order `{ customerName, customerId?, items:[{name,qty,price}], paymentMethod: 'online'\|'offline' }` |
| `orders.php?id=X&action=status` | PATCH | Update status `{ status }` |
| `orders.php?id=X` | DELETE | **Admin only.** Delete an order |
| `inventory.php` | GET / POST / PATCH / DELETE | **Admin only.** List / add / update / remove item |
| `customers.php` | GET | List customers (admin + staff, used by the order form) |
| `customers.php` | POST / PATCH / DELETE | **Admin only.** Add / update / remove customer |
| `invoices.php` | GET / PATCH | **Admin only.** List invoices + revenue totals / mark paid |
| `track.php?order_number=ORD-001` | GET | Public order-tracking lookup with a status timeline |

## Notes on the conversion
- The original app kept all data in memory (it reset on every server restart). This version
  persists everything in MySQL, so your data survives restarts — a genuine improvement.
- Business logic (order totals, invoice numbering, stock-status thresholds, status timeline)
  was translated 1:1 from the original Node `server.js` so behavior matches exactly.
- The frontend is a small vanilla-JS single-page app (hash-based routing) that talks to the
  PHP API with `fetch()`, so there's no build step — just open `index.php` in a browser.
