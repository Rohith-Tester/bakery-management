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
        'createdAt' => $r['created_at'],
    );
}

// ── GET /api/users.php ───────────────────────────────────────────────────
if ($method === 'GET' && !$id) {
    $rows = $pdo->query("SELECT * FROM users ORDER BY created_at DESC")->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_user($r);
    send($out);
}

// ── PATCH /api/users.php?id=X ────────────────────────────────────────────
// Body: { role: 'admin' | 'staff' }
if ($method === 'PATCH' && $id) {
    $body = json_body();
    $role = ga($body, 'role', null);
    if (!in_array($role, array('admin', 'staff'), true)) {
        send_error('role must be "admin" or "staff"');
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute(array($id));
    $user = $stmt->fetch();
    if (!$user) send_error('Not found', 404);

    // Don't allow the last remaining admin to demote themselves (or anyone
    // to demote the last admin) — that would lock everyone out of admin.
    if ($user['role'] === 'admin' && $role === 'staff') {
        $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
        if ($adminCount <= 1) {
            send_error('Cannot remove the last admin account');
        }
    }

    $pdo->prepare("UPDATE users SET role = ? WHERE id = ?")->execute(array($role, $id));
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

    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
