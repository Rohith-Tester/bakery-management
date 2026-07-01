<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$action = ga($_GET, 'action', null);

// ── POST /api/auth.php?action=register ──────────────────────────────────
// Public self sign-up. Always creates a 'staff' account — staff can only
// work with orders. Admin accounts are never created through this form.
if ($method === 'POST' && $action === 'register') {
    $body = json_body();
    $username = trim(ga($body, 'username', ''));
    $password = (string)ga($body, 'password', '');

    if (!$username || strlen($username) < 3) {
        send_error('Username must be at least 3 characters');
    }
    if (strlen($password) < 6) {
        send_error('Password must be at least 6 characters');
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute(array($username));
    if ($stmt->fetch()) {
        send_error('That username is already taken');
    }

    $newId = uuid4();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, 'staff')")
        ->execute(array($newId, $username, $hash));

    $_SESSION['user_id'] = $newId;
    $_SESSION['username'] = $username;
    $_SESSION['role'] = 'staff';
    send(array('username' => $username, 'role' => 'staff'), 201);
}

// ── POST /api/auth.php?action=login ─────────────────────────────────────
if ($method === 'POST' && $action === 'login') {
    $body = json_body();
    $username = trim(ga($body, 'username', ''));
    $password = (string)ga($body, 'password', '');

    if (!$username || !$password) {
        send_error('Username and password required');
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute(array($username));
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        send_error('Invalid username or password', 401);
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'];
    send(array('username' => $user['username'], 'role' => $user['role']));
}

// ── POST /api/auth.php?action=logout ────────────────────────────────────
if ($method === 'POST' && $action === 'logout') {
    $_SESSION = array();
    session_destroy();
    send(array('success' => true));
}

// ── GET /api/auth.php?action=check ──────────────────────────────────────
if ($method === 'GET' && $action === 'check') {
    if (!empty($_SESSION['user_id'])) {
        send(array('loggedIn' => true, 'username' => $_SESSION['username'], 'role' => $_SESSION['role']));
    }
    send(array('loggedIn' => false));
}

// ── POST /api/auth.php?action=change-password ───────────────────────────
if ($method === 'POST' && $action === 'change-password') {
    if (empty($_SESSION['user_id'])) send_error('Not logged in', 401);
    $body = json_body();
    $current = (string)ga($body, 'currentPassword', '');
    $new = (string)ga($body, 'newPassword', '');
    if (strlen($new) < 6) send_error('New password must be at least 6 characters');

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute(array($_SESSION['user_id']));
    $user = $stmt->fetch();
    if (!$user || !password_verify($current, $user['password_hash'])) {
        send_error('Current password is incorrect', 401);
    }

    $newHash = password_hash($new, PASSWORD_DEFAULT);
    $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute(array($newHash, $user['id']));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
