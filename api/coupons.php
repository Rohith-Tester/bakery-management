<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$validateCode = ga($_GET, 'validate', null);
$role = current_role();
$userId = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;

function fmt_coupon($c) {
    return array(
        'id' => $c['id'],
        'code' => $c['code'],
        'description' => $c['description'],
        'discountType' => $c['discount_type'],
        'discountValue' => (float)$c['discount_value'],
        'minOrderAmount' => (float)$c['min_order_amount'],
        'maxDiscountAmount' => isset($c['max_discount_amount']) && $c['max_discount_amount'] !== null ? (float)$c['max_discount_amount'] : null,
        'usageLimit' => isset($c['usage_limit']) && $c['usage_limit'] !== null ? (int)$c['usage_limit'] : null,
        'usedCount' => (int)$c['used_count'],
        'perCustomerLimit' => isset($c['per_customer_limit']) && $c['per_customer_limit'] !== null ? (int)$c['per_customer_limit'] : null,
        'validFrom' => $c['valid_from'],
        'validUntil' => $c['valid_until'],
        'active' => (bool)$c['active'],
        'isWelcome' => isset($c['is_welcome']) ? (bool)$c['is_welcome'] : false,
        'autoApply' => isset($c['auto_apply']) ? (bool)$c['auto_apply'] : false,
        'createdAt' => $c['created_at'],
    );
}

// evaluate_coupon() lives in _bootstrap.php so orders.php can reuse the
// exact same validation/discount-calculation logic when it actually places
// the order — never trusting a discount amount computed in the browser.


// ── GET /api/coupons.php?validate=CODE&subtotal=NNN  (anyone logged in —
//     checked live as a customer/staff member types a code in at checkout) ──
if ($method === 'GET' && $validateCode !== null) {
    $subtotal = (float)ga($_GET, 'subtotal', 0);
    $result = evaluate_coupon($pdo, $validateCode, $subtotal, $userId);
    if (!$result['ok']) send_error($result['error'], 400);
    send(array(
        'valid' => true,
        'code' => strtoupper(trim($validateCode)),
        'discountAmount' => $result['discountAmount'],
        'description' => $result['coupon']['description'],
    ));
}

// True if a coupon is something a customer could actually redeem right now
// (active flag on, within its date window, and hasn't hit its total usage cap).
function coupon_is_live($c) {
    if (!$c['active']) return false;
    $today = date('Y-m-d');
    if ($c['valid_from'] && $today < $c['valid_from']) return false;
    if ($c['valid_until'] && $today > $c['valid_until']) return false;
    if ($c['usage_limit'] !== null && (int)$c['used_count'] >= (int)$c['usage_limit']) return false;
    return true;
}

// ── GET /api/coupons.php?active=1  (any logged-in user — powers the
//     "Available Coupons" list shown on the New Order / checkout page) ──
if ($method === 'GET' && !$id && ga($_GET, 'active', null) !== null) {
    $rows = $pdo->query("SELECT * FROM coupons ORDER BY is_welcome DESC, created_at DESC")->fetchAll();
    $live = array_values(array_filter($rows, 'coupon_is_live'));
    send(array('coupons' => array_map('fmt_coupon', $live)));
}

// ── GET /api/coupons.php?welcomeCheck=1  (logged-in customer — powers the
//     "Welcome!" popup shown after login: is there a welcome coupon right
//     now, and has this customer already used it) ──────────────────────
if ($method === 'GET' && !$id && ga($_GET, 'welcomeCheck', null) !== null) {
    if ($role !== 'customer') send(array('coupon' => null));
    $rows = $pdo->query("SELECT * FROM coupons WHERE is_welcome = 1 ORDER BY created_at DESC")->fetchAll();
    $live = array_values(array_filter($rows, 'coupon_is_live'));
    if (!count($live)) send(array('coupon' => null));
    $c = $live[0];
    $usedStmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE user_id = ? AND coupon_code = ?");
    $usedStmt->execute(array($userId, $c['code']));
    $alreadyUsed = (int)$usedStmt->fetchColumn() > 0;
    send(array('coupon' => fmt_coupon($c), 'alreadyUsed' => $alreadyUsed));
}

// ── GET /api/coupons.php  (admin/staff: list every coupon for management) ──
if ($method === 'GET' && !$id) {
    require_staff_or_admin();
    $rows = $pdo->query("SELECT * FROM coupons ORDER BY created_at DESC")->fetchAll();
    send(array('coupons' => array_map('fmt_coupon', $rows)));
}

// ── POST /api/coupons.php  (admin creates a new coupon) ──────────────────
if ($method === 'POST') {
    require_admin();
    $body = json_body();
    $code = strtoupper(trim(ga($body, 'code', '')));
    $description = trim(ga($body, 'description', ''));
    $discountType = ga($body, 'discountType', 'percent');
    if (!in_array($discountType, array('percent', 'fixed'), true)) $discountType = 'percent';
    $discountValue = (float)ga($body, 'discountValue', 0);
    $minOrderAmount = (float)ga($body, 'minOrderAmount', 0);
    $maxDiscountAmount = ga($body, 'maxDiscountAmount', null);
    $maxDiscountAmount = ($maxDiscountAmount === null || $maxDiscountAmount === '') ? null : (float)$maxDiscountAmount;
    $usageLimit = ga($body, 'usageLimit', null);
    $usageLimit = ($usageLimit === null || $usageLimit === '') ? null : (int)$usageLimit;
    $perCustomerLimit = ga($body, 'perCustomerLimit', null);
    $perCustomerLimit = ($perCustomerLimit === null || $perCustomerLimit === '') ? null : (int)$perCustomerLimit;
    $validFrom = trim(ga($body, 'validFrom', ''));
    $validFrom = preg_match('/^\d{4}-\d{2}-\d{2}$/', $validFrom) ? $validFrom : null;
    $validUntil = trim(ga($body, 'validUntil', ''));
    $validUntil = preg_match('/^\d{4}-\d{2}-\d{2}$/', $validUntil) ? $validUntil : null;
    $active = ga($body, 'active', true) ? 1 : 0;
    $isWelcome = ga($body, 'isWelcome', false) ? 1 : 0;
    $autoApply = ga($body, 'autoApply', false) ? 1 : 0;

    if (!preg_match('/^[A-Z0-9_-]{3,30}$/', $code)) {
        send_error('Code must be 3-30 characters: letters, numbers, - or _ only');
    }
    if ($discountValue <= 0) send_error('Discount value must be greater than 0');
    if ($discountType === 'percent' && $discountValue > 100) send_error('Percent discount cannot exceed 100');

    $dupStmt = $pdo->prepare("SELECT id FROM coupons WHERE code = ?");
    $dupStmt->execute(array($code));
    if ($dupStmt->fetch()) send_error('A coupon with that code already exists');

    $newId = uuid4();
    $pdo->prepare(
        "INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount,
                               max_discount_amount, usage_limit, per_customer_limit, valid_from, valid_until, active, is_welcome, auto_apply)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute(array(
        $newId, $code, $description, $discountType, $discountValue, $minOrderAmount,
        $maxDiscountAmount, $usageLimit, $perCustomerLimit, $validFrom, $validUntil, $active, $isWelcome, $autoApply,
    ));

    $stmt = $pdo->prepare("SELECT * FROM coupons WHERE id = ?");
    $stmt->execute(array($newId));
    send(fmt_coupon($stmt->fetch()), 201);
}

// ── PATCH /api/coupons.php?id=...  (admin edits a coupon, or flips active) ──
if ($method === 'PATCH' && $id) {
    require_admin();
    $stmt = $pdo->prepare("SELECT * FROM coupons WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);

    $body = json_body();
    $description = trim(ga($body, 'description', $existing['description']));
    $discountType = ga($body, 'discountType', $existing['discount_type']);
    if (!in_array($discountType, array('percent', 'fixed'), true)) $discountType = $existing['discount_type'];
    $discountValue = (float)ga($body, 'discountValue', $existing['discount_value']);
    $minOrderAmount = (float)ga($body, 'minOrderAmount', $existing['min_order_amount']);
    $maxDiscountAmount = ga($body, 'maxDiscountAmount', $existing['max_discount_amount']);
    $maxDiscountAmount = ($maxDiscountAmount === null || $maxDiscountAmount === '') ? null : (float)$maxDiscountAmount;
    $usageLimit = ga($body, 'usageLimit', $existing['usage_limit']);
    $usageLimit = ($usageLimit === null || $usageLimit === '') ? null : (int)$usageLimit;
    $perCustomerLimit = ga($body, 'perCustomerLimit', $existing['per_customer_limit']);
    $perCustomerLimit = ($perCustomerLimit === null || $perCustomerLimit === '') ? null : (int)$perCustomerLimit;
    $validFrom = ga($body, 'validFrom', $existing['valid_from']);
    $validFrom = ($validFrom && preg_match('/^\d{4}-\d{2}-\d{2}$/', $validFrom)) ? $validFrom : null;
    $validUntil = ga($body, 'validUntil', $existing['valid_until']);
    $validUntil = ($validUntil && preg_match('/^\d{4}-\d{2}-\d{2}$/', $validUntil)) ? $validUntil : null;
    $active = array_key_exists('active', $body) ? (ga($body, 'active', true) ? 1 : 0) : $existing['active'];
    $isWelcome = array_key_exists('isWelcome', $body) ? (ga($body, 'isWelcome', false) ? 1 : 0) : $existing['is_welcome'];
    $autoApply = array_key_exists('autoApply', $body) ? (ga($body, 'autoApply', false) ? 1 : 0) : (isset($existing['auto_apply']) ? $existing['auto_apply'] : 0);

    if ($discountValue <= 0) send_error('Discount value must be greater than 0');
    if ($discountType === 'percent' && $discountValue > 100) send_error('Percent discount cannot exceed 100');

    $pdo->prepare(
        "UPDATE coupons SET description = ?, discount_type = ?, discount_value = ?, min_order_amount = ?,
                             max_discount_amount = ?, usage_limit = ?, per_customer_limit = ?,
                             valid_from = ?, valid_until = ?, active = ?, is_welcome = ?, auto_apply = ? WHERE id = ?"
    )->execute(array(
        $description, $discountType, $discountValue, $minOrderAmount,
        $maxDiscountAmount, $usageLimit, $perCustomerLimit, $validFrom, $validUntil, $active, $isWelcome, $autoApply, $id,
    ));

    $stmt = $pdo->prepare("SELECT * FROM coupons WHERE id = ?");
    $stmt->execute(array($id));
    send(fmt_coupon($stmt->fetch()));
}

// ── DELETE /api/coupons.php?id=...  (admin removes a coupon) ─────────────
if ($method === 'DELETE' && $id) {
    require_admin();
    $stmt = $pdo->prepare("SELECT id FROM coupons WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM coupons WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
