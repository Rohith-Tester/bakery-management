<?php
require __DIR__ . '/_bootstrap.php';
require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

function fmt_user($r) {
    return array(
        'id' => $r['id'],
        'username' => $r['username'],
        'role' => $r['role'],
        'phone' => isset($r['phone']) ? $r['phone'] : '',
        'email' => isset($r['email']) ? $r['email'] : '',
        'createdAt' => $r['created_at'],
    );
}

$RESERVED_USERNAMES = array('admin', 'administrator', 'root', 'superadmin', 'super_admin', 'system', 'support', 'staffadmin');

// ── POST /api/users.php ──────────────────────────────────────────────────
// Admin-only: create a new account directly with any role (including
// another admin). Unlike public self-registration, admins can grant any
// role here since only a trusted admin can reach this endpoint.
if ($method === 'POST' && !$id) {
    $body = json_body();
    $username = trim(ga($body, 'username', ''));
    $password = (string)ga($body, 'password', '');
    $role = ga($body, 'role', 'staff');
    $phone = trim(ga($body, 'phone', ''));
    $email = trim(ga($body, 'email', ''));
    $supplierId = ga($body, 'supplierId', null);

    if (!in_array($role, array('admin', 'staff', 'customer', 'delivery', 'supplier'), true)) {
        send_error('role must be "admin", "staff", "customer", "delivery" or "supplier"');
    }
    if (!$username || strlen($username) < 3 || strlen($username) > 30) {
        send_error('Username must be 3–30 characters');
    }
    if (!preg_match('/^[A-Za-z0-9._-]+$/', $username)) {
        send_error('Username can only contain letters, numbers, dots, dashes and underscores');
    }
    if (in_array(strtolower($username), $RESERVED_USERNAMES, true)) {
        send_error('That username is reserved. Please choose a different one.');
    }
    $emailErr = validate_email_format($email);
    if ($emailErr) send_error($emailErr);
    $pwErr = validate_password_strength($password);
    if ($pwErr) send_error($pwErr);

    $supplierRow = null;
    if ($role === 'supplier') {
        if (!$supplierId) send_error('Select which supplier this login belongs to');
        $sstmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
        $sstmt->execute(array($supplierId));
        $supplierRow = $sstmt->fetch();
        if (!$supplierRow) send_error('That supplier could not be found');
        if (!empty($supplierRow['user_id'])) send_error('That supplier already has a login account');
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute(array($username));
    if ($stmt->fetch()) {
        send_error('That username is already taken');
    }

    $newId = uuid4();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (id, username, password_hash, role, phone, email) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute(array($newId, $username, $hash, $role, $phone, $email));
    if ($role === 'customer') ensure_customer_for_user($pdo, $newId, $username, $phone, $email);
    if ($role === 'supplier' && $supplierRow) {
        $pdo->prepare("UPDATE suppliers SET user_id = ? WHERE id = ?")->execute(array($newId, $supplierRow['id']));
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute(array($newId));
    send(fmt_user($stmt->fetch()), 201);
}

// ── GET /api/users.php ───────────────────────────────────────────────────
if ($method === 'GET' && !$id) {
    $rows = $pdo->query("SELECT * FROM users ORDER BY created_at DESC")->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_user($r);
    send($out);
}

// ── PATCH /api/users.php?id=X ────────────────────────────────────────────
// Body: { role: 'admin' | 'staff' | 'customer' }
if ($method === 'PATCH' && $id) {
    $body = json_body();
    $role = ga($body, 'role', null);
    $supplierId = ga($body, 'supplierId', null);
    if (!in_array($role, array('admin', 'staff', 'customer', 'delivery', 'supplier'), true)) {
        send_error('role must be "admin", "staff", "customer", "delivery" or "supplier"');
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute(array($id));
    $user = $stmt->fetch();
    if (!$user) send_error('Not found', 404);

    // Don't allow the last remaining admin to demote themselves (or anyone
    // to demote the last admin) — that would lock everyone out of admin.
    if ($user['role'] === 'admin' && $role !== 'admin') {
        $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
        if ($adminCount <= 1) {
            send_error('Cannot remove the last admin account');
        }
    }

    if ($role === 'supplier') {
        if (!$supplierId) send_error('Select which supplier this login belongs to');
        $sstmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
        $sstmt->execute(array($supplierId));
        $supplierRow = $sstmt->fetch();
        if (!$supplierRow) send_error('That supplier could not be found');
        if (!empty($supplierRow['user_id']) && $supplierRow['user_id'] !== $id) {
            send_error('That supplier already has a login account');
        }
    }

    // Unlink this account from any supplier row it used to be tied to
    // whenever it's no longer (or is being re-pointed away from) a
    // supplier login, so the old supplier row can be linked to someone else.
    $pdo->prepare("UPDATE suppliers SET user_id = NULL WHERE user_id = ?")->execute(array($id));

    $pdo->prepare("UPDATE users SET role = ? WHERE id = ?")->execute(array($role, $id));
    if ($role === 'customer') {
        ensure_customer_for_user($pdo, $id, $user['username'], isset($user['phone']) ? $user['phone'] : '', isset($user['email']) ? $user['email'] : '');
    }
    if ($role === 'supplier') {
        $pdo->prepare("UPDATE suppliers SET user_id = ? WHERE id = ?")->execute(array($id, $supplierId));
    }
    $stmt->execute(array($id));
    send(fmt_user($stmt->fetch()));
}

// ── DELETE /api/users.php?id=X ───────────────────────────────────────────
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute(array($id));
    $user = $stmt->fetch();
    if (!$user) send_error('Not found', 404);

    if ($id === $_SESSION['user_id']) {
        send_error("You can't delete your own account while signed in");
    }
    if ($user['role'] === 'admin') {
        $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
        if ($adminCount <= 1) {
            send_error('Cannot delete the last admin account');
        }
    }

    purge_user_billing($pdo, $id);
    // suppliers.user_id has ON DELETE SET NULL, but clear it explicitly too
    // so the supplier row is immediately reusable for a fresh login.
    $pdo->prepare("UPDATE suppliers SET user_id = NULL WHERE user_id = ?")->execute(array($id));
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
