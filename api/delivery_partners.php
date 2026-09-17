<?php
require __DIR__ . '/_bootstrap.php';
// Suppliers need this list too, so they can pick a delivery partner account
// (with its phone number) when assigning who will carry a dispatched restock,
// instead of only being able to type a name in manually. Suppliers can also
// create and remove delivery partner accounts themselves from their own
// Restock Alerts -> Delivery Partners tab.
require_staff_admin_or_supplier();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

$RESERVED_USERNAMES = array('admin', 'administrator', 'root', 'superadmin', 'super_admin', 'system', 'support', 'staffadmin');

// ── GET /api/delivery_partners.php ───────────────────────────────────────
if ($method === 'GET' && !$id) {
    $rows = $pdo->query("SELECT id, username, phone FROM users WHERE role = 'delivery' ORDER BY username")->fetchAll();
    $out = array();
    foreach ($rows as $r) {
        $out[] = array('id' => $r['id'], 'username' => $r['username'], 'phone' => $r['phone']);
    }
    send($out);
}

// ── POST /api/delivery_partners.php ──────────────────────────────────────
// Creates a new delivery-role login. Suppliers, staff, and admins can all
// add as many delivery partner accounts as needed — the list is shared so
// anyone assigning a dispatch can pick from the full pool.
if ($method === 'POST' && !$id) {
    $body = json_body();
    $username = trim(ga($body, 'username', ''));
    $phone = trim(ga($body, 'phone', ''));
    $password = (string) ga($body, 'password', '');

    if (!$username || strlen($username) < 3 || strlen($username) > 30) {
        send_error('Username must be 3–30 characters');
    }
    if (!preg_match('/^[A-Za-z0-9._-]+$/', $username)) {
        send_error('Username can only contain letters, numbers, dots, dashes and underscores');
    }
    if (in_array(strtolower($username), $RESERVED_USERNAMES, true)) {
        send_error('That username is reserved. Please choose a different one.');
    }
    if (strlen($password) < 8) {
        send_error('Password must be at least 8 characters');
    }
    if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        send_error('Password must include at least one letter and one number');
    }
    if ($phone !== '' && !preg_match('/^[0-9+ -]{6,20}$/', $phone)) {
        send_error('Enter a valid phone number');
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute(array($username));
    if ($stmt->fetch()) {
        send_error('That username is already taken');
    }

    $newId = uuid4();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (id, username, password_hash, role, phone) VALUES (?, ?, ?, 'delivery', ?)")
        ->execute(array($newId, $username, $hash, $phone));

    send(array('id' => $newId, 'username' => $username, 'phone' => $phone), 201);
}

// ── DELETE /api/delivery_partners.php?id=... ─────────────────────────────
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role = 'delivery'");
    $stmt->execute(array($id));
    $partner = $stmt->fetch();
    if (!$partner) send_error('Not found', 404);

    // Restock alerts store the delivery partner as a plain username (there's
    // no FK), so match on that. Block removal while a dispatch tied to this
    // partner is still in flight — deleting the account mid-delivery would
    // orphan the tracking info supplier/admin are relying on.
    $raStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM restock_alerts WHERE delivery_partner = ? AND status = 'dispatched'"
    );
    $raStmt->execute(array($partner['username']));
    if ((int) $raStmt->fetchColumn() > 0) {
        send_error('This delivery partner has a restock currently dispatched. Wait until it\'s received before removing them.');
    }

    // Also block while they're actively carrying a customer order.
    $orderStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM orders WHERE delivery_partner_user_id = ? AND status = 'out_for_delivery'"
    );
    $orderStmt->execute(array($id));
    if ((int) $orderStmt->fetchColumn() > 0) {
        send_error('This delivery partner currently has an order out for delivery. Wait until it\'s delivered before removing them.');
    }

    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
