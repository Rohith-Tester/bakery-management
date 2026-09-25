<?php
// Never let PHP notices/warnings leak into the JSON response body —
// that's the #1 cause of "undefined is not iterable" style errors on the frontend.
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../config/session.php';

// ── CORS ──────────────────────────────────────────────────────────────────
// This app is served same-origin (the JS in assets/app.js is loaded from the
// same host as these API endpoints), so requests never need to be credentialed
// cross-origin. Echoing "Allow-Origin: *" together with "Allow-Credentials: true"
// is an unsafe combination (browsers reject it, but proxies/older clients may
// not) — instead only ever allow the exact origin the request came from, and
// never a wildcard. If you deploy the frontend on a different origin than the
// API, list it explicitly here instead of trusting the request header.
$__origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$__selfOrigin = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '');
if ($__origin !== '' && $__origin === $__selfOrigin) {
    header('Access-Control-Allow-Origin: ' . $__origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/db.php';

// Every API endpoint requires a logged-in session, except auth.php
// (login/register/logout/check must be reachable while logged out),
// track.php (the public order-tracking lookup customers use without an
// account), and settings.php (bakery contact details shown to anyone
// deciding whether to call in an order instead of ordering online —
// settings.php enforces its own admin check for writes/PATCH), and
// razorpay_webhook.php (called by Razorpay's servers, authenticated by
// its signature instead of a session).
$__self = basename($_SERVER['SCRIPT_NAME']);
$__publicEndpoints = array('auth.php', 'track.php', 'settings.php', 'returns.php', 'razorpay_webhook.php');
if (!in_array($__self, $__publicEndpoints, true) && empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(array('error' => 'Not authenticated'));
    exit;
}

// ── CSRF protection ───────────────────────────────────────────────────────
// SameSite=Lax cookies already stop cross-site requests from carrying the
// session cookie in the common case, but that's not a substitute for an
// explicit check — belt and suspenders. Any state-changing request made
// while logged in must echo back the session's csrf_token in a custom
// header (which a cross-origin page cannot read/set without CORS already
// approving that origin). Login/register are exempt: no authenticated
// session exists yet at that point for a forged request to abuse.
$__isAuthLoginOrRegister = ($__self === 'auth.php' && in_array(ga($_GET, 'action', null), array('login', 'register'), true));
if (!$__isAuthLoginOrRegister && !empty($_SESSION['user_id']) && in_array($_SERVER['REQUEST_METHOD'], array('POST', 'PATCH', 'DELETE'), true)) {
    $__sentToken = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $__sentToken)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Invalid or missing security token. Please refresh the page and try again.'));
        exit;
    }
}

/** Blocks the request unless the logged-in user is an admin. Staff accounts
 *  are restricted to placing/updating orders only — everything else
 *  (inventory, customers management, invoices, dashboard) is admin-only. */
function require_admin() {
    $role = isset($_SESSION['role']) ? $_SESSION['role'] : null;
    if ($role !== 'admin') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Admins only'));
        exit;
    }
}

/** Blocks the request unless the logged-in user is an admin or staff member.
 *  Customer accounts are storefront-only: they can place their own orders
 *  and track them, but never manage other people's orders. */
function require_staff_or_admin() {
    $role = isset($_SESSION['role']) ? $_SESSION['role'] : null;
    if ($role !== 'admin' && $role !== 'staff') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Staff or admin access required'));
        exit;
    }
}

function current_role() {
    return isset($_SESSION['role']) ? $_SESSION['role'] : null;
}

// Works out the discount for a given coupon code + cart subtotal + customer,
// returning either ['ok'=>true,'discountAmount'=>N,'coupon'=>row] or
// ['ok'=>false,'error'=>msg]. Shared by api/coupons.php (live validation as
// someone types a code in at checkout) and api/orders.php (the real
// order-creation code re-checks everything server-side here too, rather
// than trusting whatever discount amount the browser sends up).
function evaluate_coupon($pdo, $code, $subtotal, $userId) {
    $stmt = $pdo->prepare("SELECT * FROM coupons WHERE code = ?");
    $stmt->execute(array(strtoupper(trim($code))));
    $c = $stmt->fetch();
    if (!$c) return array('ok' => false, 'error' => 'That coupon code does not exist');
    if (!$c['active']) return array('ok' => false, 'error' => 'That coupon is no longer active');

    $today = date('Y-m-d');
    if ($c['valid_from'] && $today < $c['valid_from']) return array('ok' => false, 'error' => 'That coupon is not active yet');
    if ($c['valid_until'] && $today > $c['valid_until']) return array('ok' => false, 'error' => 'That coupon has expired');

    if ($subtotal < (float)$c['min_order_amount']) {
        return array('ok' => false, 'error' => 'Minimum order amount for this coupon is ₹' . number_format((float)$c['min_order_amount'], 0));
    }
    if ($c['usage_limit'] !== null && (int)$c['used_count'] >= (int)$c['usage_limit']) {
        return array('ok' => false, 'error' => 'That coupon has reached its usage limit');
    }
    if ($userId && $c['per_customer_limit'] !== null) {
        $usedStmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE user_id = ? AND coupon_code = ?");
        $usedStmt->execute(array($userId, $c['code']));
        if ((int)$usedStmt->fetchColumn() >= (int)$c['per_customer_limit']) {
            return array('ok' => false, 'error' => 'You have already used this coupon the maximum number of times');
        }
    }

    if ($c['discount_type'] === 'percent') {
        $discount = $subtotal * ((float)$c['discount_value'] / 100.0);
        if ($c['max_discount_amount'] !== null) $discount = min($discount, (float)$c['max_discount_amount']);
    } else {
        $discount = (float)$c['discount_value'];
    }
    $discount = min($discount, $subtotal); // never discount more than the cart is worth
    $discount = round($discount, 2);

    return array('ok' => true, 'discountAmount' => $discount, 'coupon' => $c);
}

// Flat delivery charge added to every home-delivery order, whatever the
// payment method (store pickup is never charged).
define('DELIVERY_CHARGE', 50.00);

// Prices an order request exactly the way it will be saved, returning
// ['ok'=>true,'total'=>N,'trustedPriceByName'=>…,'inventoryNeeded'=>…,
//  'discountAmount'=>N,'couponCode'=>…,'deliveryCharge'=>N] or
// ['ok'=>false,'error'=>msg]. Shared by api/orders.php (saving the order)
// and api/payments.php (opening a Razorpay payment for it), so what a
// customer is charged online is always what the order is created for.
function quote_order($pdo, $items, $couponCode, $deliveryType, $userId) {
    // ── Validate items against the Product Catalog (not raw inventory —
    //    customers order finished products, e.g. "Chocolate Cake", never
    //    raw ingredients like "Flour"). Stock availability is derived from
    //    each product's linked Recipe: if a product has a recipe, the
    //    order can't exceed how many units that recipe's ingredients can
    //    currently produce. Products with no recipe linked yet are treated
    //    as stock-untracked (always orderable while marked available). ──
    $neededByName = array();
    foreach ($items as $it) {
        $name = trim(ga($it, 'name', ''));
        $qty = (float)ga($it, 'qty', 0);
        if ($name === '' || $qty <= 0) continue;
        $neededByName[$name] = (isset($neededByName[$name]) ? $neededByName[$name] : 0) + $qty;
    }

    // Price is NEVER trusted from the client — it's recomputed here from
    // each item's real Product Catalog selling_price. This closes off the
    // obvious attack of editing the request to set an arbitrary/zero price.
    $trustedPriceByName = array();
    $productByName = array();
    foreach ($neededByName as $name => $need) {
        $prodStmt = $pdo->prepare("SELECT * FROM products WHERE name = ? AND is_available = 1");
        $prodStmt->execute(array($name));
        $prodRow = $prodStmt->fetch();
        $trustedPriceByName[$name] = $prodRow ? (float)$prodRow['selling_price'] : 0;
        $productByName[$name] = $prodRow ?: null;
    }

    foreach ($neededByName as $name => $need) {
        if (!$productByName[$name]) {
            return array('ok' => false, 'error' => '"' . $name . '" is not a valid or available product');
        }
    }

    // Expand each product's ordered quantity into raw-ingredient demand via
    // its linked recipe (quantity per ingredient is defined per recipe
    // batch, which yields yield_qty finished units).
    $inventoryNeeded = array(); // item_id => quantity needed
    foreach ($neededByName as $name => $need) {
        $prodRow = $productByName[$name];
        if (!$prodRow || !$prodRow['recipe_id']) continue; // stock-untracked product
        $ingStmt = $pdo->prepare(
            "SELECT ri.item_id, ri.quantity, r.yield_qty FROM recipe_ingredients ri
             JOIN recipes r ON r.id = ri.recipe_id WHERE ri.recipe_id = ?"
        );
        $ingStmt->execute(array($prodRow['recipe_id']));
        foreach ($ingStmt->fetchAll() as $ing) {
            $yieldQty = (float)$ing['yield_qty'] > 0 ? (float)$ing['yield_qty'] : 1;
            $perUnit = (float)$ing['quantity'] / $yieldQty;
            $itemId = $ing['item_id'];
            $inventoryNeeded[$itemId] = (isset($inventoryNeeded[$itemId]) ? $inventoryNeeded[$itemId] : 0) + ($perUnit * $need);
        }
    }

    $total = 0;
    foreach ($items as $it) {
        $name = trim(ga($it, 'name', ''));
        $qty = (float)ga($it, 'qty', 0);
        $price = isset($trustedPriceByName[$name]) ? $trustedPriceByName[$name] : 0;
        $total += $price * $qty;
    }

    // Coupon discount applies to the items subtotal, before the delivery
    // charge is added — re-validated here from scratch (never trust a
    // discount amount computed client-side) using the exact same rules the
    // live checkout-time check in api/coupons.php used.
    $discountAmount = 0;
    $appliedCouponCode = null;
    if ($couponCode !== '') {
        $couponResult = evaluate_coupon($pdo, $couponCode, $total, $userId);
        if (!$couponResult['ok']) return $couponResult;
        $discountAmount = $couponResult['discountAmount'];
        $appliedCouponCode = $couponResult['coupon']['code'];
        $total -= $discountAmount;
    }

    $deliveryCharge = ($deliveryType === 'delivery') ? DELIVERY_CHARGE : 0.00;
    $total += $deliveryCharge;

    return array(
        'ok' => true,
        'total' => $total,
        'trustedPriceByName' => $trustedPriceByName,
        'inventoryNeeded' => $inventoryNeeded,
        'discountAmount' => $discountAmount,
        'couponCode' => $appliedCouponCode,
        'deliveryCharge' => $deliveryCharge,
    );
}

// Catch any uncaught error/exception and turn it into a JSON error instead of
// an HTML error page, which is what causes "undefined is not iterable" on the frontend.
set_exception_handler(function ($e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('error' => 'Server error: ' . $e->getMessage()));
    exit;
});
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) return false;
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});

/** Ensures a `customers` row exists for a given customer-role user account,
 *  so the Customers page always reflects everyone who can log in and order
 *  — not just walk-in customers added manually by staff. Safe to call more
 *  than once for the same user (won't create duplicates). */
/** Blocks the request unless the logged-in user is a delivery partner. */
function require_delivery() {
    $role = isset($_SESSION['role']) ? $_SESSION['role'] : null;
    if ($role !== 'delivery') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Delivery partner access required'));
        exit;
    }
}

/** Blocks the request unless the logged-in user is a supplier account. */
function require_supplier() {
    $role = isset($_SESSION['role']) ? $_SESSION['role'] : null;
    if ($role !== 'supplier') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Supplier access required'));
        exit;
    }
}

/** Blocks the request unless logged in as admin, staff, or a supplier
 *  account (used by endpoints suppliers can view their own slice of, like
 *  Restock Alerts). */
function require_staff_admin_or_supplier() {
    $role = isset($_SESSION['role']) ? $_SESSION['role'] : null;
    if ($role !== 'admin' && $role !== 'staff' && $role !== 'supplier') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Staff, admin, or supplier access required'));
        exit;
    }
}

/** Returns the suppliers.id row linked to the logged-in supplier account,
 *  or null if the session isn't a supplier / isn't linked to a supplier row. */
function current_supplier_id($pdo) {
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'supplier') return null;
    $stmt = $pdo->prepare("SELECT id FROM suppliers WHERE user_id = ?");
    $stmt->execute(array($_SESSION['user_id']));
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

/** Notifies every admin/staff account (order placed, needs attention). */
function notify_management($pdo, $orderId, $message) {
    $pdo->prepare("INSERT INTO notifications (id, recipient_role, order_id, message) VALUES (?, 'management', ?, ?)")
        ->execute(array(uuid4(), $orderId, $message));
}

/** Notifies one specific account (order status changed, delivery assigned). */
function notify_user($pdo, $userId, $orderId, $message) {
    if (!$userId) return;
    $pdo->prepare("INSERT INTO notifications (id, recipient_user_id, order_id, message) VALUES (?, ?, ?, ?)")
        ->execute(array(uuid4(), $userId, $orderId, $message));
}

function ensure_customer_for_user($pdo, $userId, $username, $phone = '', $email = '') {
    $stmt = $pdo->prepare("SELECT id FROM customers WHERE user_id = ?");
    $stmt->execute(array($userId));
    if ($stmt->fetch()) return; // already linked

    $newId = uuid4();
    $pdo->prepare(
        "INSERT INTO customers (id, user_id, name, email, phone, total_orders, total_spend) VALUES (?, ?, ?, ?, ?, 0, 0)"
    )->execute(array($newId, $userId, $username, $email, $phone));
}

// A short blocklist of extremely common/breached passwords — rejected even
// though they'd otherwise pass the format rules below (e.g. "Password1!"
// technically has upper/lower/number/symbol but is one of the most-leaked
// passwords on earth).
$GLOBALS['__COMMON_WEAK_PASSWORDS'] = array(
    'password', 'password1', 'password123', 'passw0rd', 'admin123', 'welcome123',
    '12345678', '123456789', '1234567890', 'qwerty123', 'letmein123', 'iloveyou1',
    'abc12345', 'admin@123', 'welcome@123', 'password@123',
);

// Shared password-strength rule used everywhere a password is set: self
// registration, admin-created accounts, and password changes. Returns an
// error string, or null if the password is acceptable.
function validate_password_strength($password) {
    if (strlen($password) < 8) {
        return 'Password must be at least 8 characters';
    }
    if (strlen($password) > 72) {
        return 'Password must be 72 characters or fewer';
    }
    if (!preg_match('/[a-z]/', $password)) {
        return 'Password must include at least one lowercase letter';
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return 'Password must include at least one uppercase letter';
    }
    if (!preg_match('/[0-9]/', $password)) {
        return 'Password must include at least one number';
    }
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        return 'Password must include at least one special character (e.g. ! @ # $ %)';
    }
    if (in_array(strtolower($password), $GLOBALS['__COMMON_WEAK_PASSWORDS'], true)) {
        return 'That password is too common and appears in known data breaches. Please choose a different one.';
    }
    return null;
}

// Shared email-format check. Email is optional throughout this app (phone
// is the primary contact method), so an empty string is always allowed —
// this only rejects a non-empty value that isn't a plausible email address.
function validate_email_format($email) {
    if ($email === '' || $email === null) return null;
    if (strlen($email) > 254) return 'Email is too long';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return 'Please enter a valid email address';
    }
    return null;
}

function json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return array();
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

function send($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function send_error($message, $code = 400) {
    send(array('error' => $message), $code);
}

function ga($arr, $key, $default = null) {
    return isset($arr[$key]) ? $arr[$key] : $default;
}

/** Remove one order and its invoice(s). order_items/notifications cascade from orders. */
function delete_order_with_billing($pdo, $orderId) {
    $pdo->prepare("DELETE FROM invoices WHERE order_id = ?")->execute(array($orderId));
    $pdo->prepare("DELETE FROM orders WHERE id = ?")->execute(array($orderId));
}

/** Remove all orders/invoices tied to a customer record (Sales & Billing cleanup). */
function purge_customer_billing($pdo, $customerId) {
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE customer_id = ?");
    $stmt->execute(array($customerId));
    foreach ($stmt->fetchAll() as $row) {
        delete_order_with_billing($pdo, $row['id']);
    }
    $pdo->prepare("DELETE FROM invoices WHERE customer_id = ?")->execute(array($customerId));
}

/** Remove orders/invoices for a login account before the user row is deleted. */
function purge_user_billing($pdo, $userId) {
    $stmt = $pdo->prepare("SELECT id FROM customers WHERE user_id = ?");
    $stmt->execute(array($userId));
    $cust = $stmt->fetch();
    if ($cust) {
        purge_customer_billing($pdo, $cust['id']);
        $pdo->prepare("DELETE FROM customers WHERE id = ?")->execute(array($cust['id']));
    }
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE user_id = ?");
    $stmt->execute(array($userId));
    foreach ($stmt->fetchAll() as $row) {
        delete_order_with_billing($pdo, $row['id']);
    }
}

/** Mirrors the Node getStockStatus() helper exactly */
function stock_status($quantity, $minStock) {
    $quantity = (float)$quantity;
    $minStock = (float)$minStock;
    $ratio = $minStock > 0 ? $quantity / ($minStock * 2) : 1;
    if ($quantity <= $minStock * 0.5) return 'critical';
    if ($quantity <= $minStock) return 'low';
    if ($ratio < 0.75) return 'medium';
    return 'good';
}

/** The one authoritative selling-price formula for an inventory item —
 *  cost + a healthy bakery margin, rounded to a friendly number. Used both
 *  to prefill the order form (api/inventory.php) and, critically, to
 *  price every order server-side (api/orders.php) — an order's price per
 *  item is ALWAYS recomputed from real inventory cost here, never trusted
 *  from whatever the browser sends, so editing the request can't get a
 *  discounted or free item. */
function computed_sell_price($costPerUnit) {
    $cost = (float)$costPerUnit;
    return $cost > 0 ? max(10, round(($cost * 2.6) / 5) * 5) : 0;
}

/** Generates a 4-digit OTP using a cryptographically secure random source
 *  where available (random_int, backed by the OS CSPRNG) rather than
 *  mt_rand — used for both the delivery-confirmation OTP (api/orders.php)
 *  and the return pickup OTP (api/returns.php), so it can't be predicted
 *  via a weak PRNG. Falls back to random_bytes (PHP 7.0+) or, on PHP
 *  versions old enough to have neither, mt_rand — same fallback pattern as
 *  uuid4() in config/db.php.
 *  Each of those endpoints also tracks a *_otp_attempts counter column and
 *  checks it against OTP_MAX_ATTEMPTS before accepting a guess, so a
 *  4-digit code can't just be brute-forced. */
function generate_otp() {
    if (function_exists('random_int')) {
        $n = random_int(0, 9999);
    } elseif (function_exists('random_bytes')) {
        $n = unpack('N', str_pad(random_bytes(2), 4, "\0", STR_PAD_LEFT))[1] % 10000;
    } else {
        $n = mt_rand(0, 9999);
    }
    return str_pad((string)$n, 4, '0', STR_PAD_LEFT);
}

// Max wrong OTP guesses allowed before the entered code is rejected outright
// (forcing whoever's checking it to go back and confirm with the customer,
// rather than being able to sit and brute-force a 4-digit code — 10,000
// possibilities is nothing without a limit like this).
define('OTP_MAX_ATTEMPTS', 5);
