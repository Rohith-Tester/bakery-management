<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$action = ga($_GET, 'action', null);
$role = current_role();
$userId = $_SESSION['user_id'];
$isManagement = in_array($role, array('admin', 'staff'), true);

function fmt_notification($r) {
    return array(
        'id' => $r['id'],
        'orderId' => $r['order_id'],
        'message' => $r['message'],
        'isRead' => (bool)$r['is_read'],
        'createdAt' => $r['created_at'],
    );
}

// ── GET /api/notifications.php ──────────────────────────────────────────
// Admins/staff see order-placed alerts (shared) plus anything addressed to
// them personally. Customers/delivery partners only ever see notifications
// addressed to their own account.
if ($method === 'GET' && !$action) {
    if ($isManagement) {
        $stmt = $pdo->prepare(
            "SELECT * FROM notifications WHERE recipient_role = 'management' OR recipient_user_id = ?
             ORDER BY created_at DESC LIMIT 50"
        );
        $stmt->execute(array($userId));
    } else {
        $stmt = $pdo->prepare(
            "SELECT * FROM notifications WHERE recipient_user_id = ? ORDER BY created_at DESC LIMIT 50"
        );
        $stmt->execute(array($userId));
    }
    $rows = $stmt->fetchAll();
    $out = array();
    $unread = 0;
    foreach ($rows as $r) {
        if (!$r['is_read']) $unread++;
        $out[] = fmt_notification($r);
    }
    send(array('notifications' => $out, 'unreadCount' => $unread));
}

// ── PATCH /api/notifications.php?action=read&id=X ────────────────────────
if ($method === 'PATCH' && $action === 'read') {
    $id = ga($_GET, 'id', null);
    if (!$id) send_error('id required');
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE id = ?");
    $stmt->execute(array($id));
    $n = $stmt->fetch();
    if (!$n) send_error('Not found', 404);
    $allowed = ($isManagement && $n['recipient_role'] === 'management') || $n['recipient_user_id'] === $userId;
    if (!$allowed) send_error('Not your notification', 403);
    $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

// ── PATCH /api/notifications.php?action=read-all ─────────────────────────
if ($method === 'PATCH' && $action === 'read-all') {
    if ($isManagement) {
        $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE recipient_role = 'management' OR recipient_user_id = ?")
            ->execute(array($userId));
    } else {
        $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE recipient_user_id = ?")->execute(array($userId));
    }
    send(array('success' => true));
}

send_error('Unsupported request', 405);
