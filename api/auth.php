<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$action = ga($_GET, 'action', null);

// Usernames that can never be self-registered, so nobody can sign up as
// "admin" (or a lookalike) to impersonate the real admin account in the UI —
// on top of the fact that registration can never grant the admin *role* below.
$RESERVED_USERNAMES = array('admin', 'administrator', 'root', 'superadmin', 'super_admin', 'system', 'support', 'staffadmin');

// ── POST /api/auth.php?action=register ──────────────────────────────────
// Public self sign-up. Anyone signing up here gets a 'customer' account
// (place & track their own orders, pay online) — that's the only role
// available through public registration. Staff and admin accounts can
// NEVER be created through this endpoint; they're created separately by
// an existing admin from the Users page.
if ($method === 'POST' && $action === 'register') {
    $body = json_body();
    $username = trim(ga($body, 'username', ''));
    $password = (string)ga($body, 'password', '');
    $confirmPassword = (string)ga($body, 'confirmPassword', '');
    $role = 'customer';
    $phone = trim(ga($body, 'phone', ''));
    $email = trim(ga($body, 'email', ''));

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
    if ($password !== $confirmPassword) {
        send_error('Passwords do not match');
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
    ensure_customer_for_user($pdo, $newId, $username, $phone, $email);

    session_regenerate_id(true);
    $_SESSION['user_id'] = $newId;
    $_SESSION['username'] = $username;
    $_SESSION['role'] = $role;
    send(array('username' => $username, 'role' => $role), 201);
}

// ── Login throttling helpers ─────────────────────────────────────────────
// Keyed by username+IP so one attacker can't lock out a legitimate user, but
// repeated wrong-password guesses against one account from one source get
// slowed to a crawl.
function throttle_identifier($username) {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    return strtolower($username) . '|' . $ip;
}
function throttle_check($pdo, $identifier) {
    $stmt = $pdo->prepare("SELECT fail_count, locked_until FROM login_attempts WHERE identifier = ?");
    $stmt->execute(array($identifier));
    $row = $stmt->fetch();
    if ($row && $row['locked_until'] && strtotime($row['locked_until']) > time()) {
        $waitSecs = strtotime($row['locked_until']) - time();
        $waitMins = max(1, (int)ceil($waitSecs / 60));
        send_error("Too many failed attempts. Try again in {$waitMins} minute" . ($waitMins === 1 ? '' : 's') . '.', 429);
    }
}
function throttle_record_failure($pdo, $identifier) {
    $stmt = $pdo->prepare("SELECT fail_count FROM login_attempts WHERE identifier = ?");
    $stmt->execute(array($identifier));
    $row = $stmt->fetch();
    $count = $row ? (int)$row['fail_count'] + 1 : 1;
    // Lock for 15 minutes after 5 failed attempts.
    $lockedUntil = $count >= 5 ? date('Y-m-d H:i:s', time() + 15 * 60) : null;
    if ($row) {
        $pdo->prepare("UPDATE login_attempts SET fail_count = ?, locked_until = ? WHERE identifier = ?")
            ->execute(array($count, $lockedUntil, $identifier));
    } else {
        $pdo->prepare("INSERT INTO login_attempts (identifier, fail_count, locked_until) VALUES (?, ?, ?)")
            ->execute(array($identifier, $count, $lockedUntil));
    }
}
function throttle_reset($pdo, $identifier) {
    $pdo->prepare("DELETE FROM login_attempts WHERE identifier = ?")->execute(array($identifier));
}

// ── POST /api/auth.php?action=login ─────────────────────────────────────
if ($method === 'POST' && $action === 'login') {
    $body = json_body();
    $username = trim(ga($body, 'username', ''));
    $password = (string)ga($body, 'password', '');

    if (!$username || !$password) {
        send_error('Username and password required');
    }

    $identifier = throttle_identifier($username);
    throttle_check($pdo, $identifier);

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute(array($username));
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        throttle_record_failure($pdo, $identifier);
        send_error('Invalid username or password', 401);
    }

    throttle_reset($pdo, $identifier);
    session_regenerate_id(true);
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

// ── GET /api/auth.php?action=profile ────────────────────────────────────
// Logged-in user's account details (used to pre-fill the customer order cart).
if ($method === 'GET' && $action === 'profile') {
    if (empty($_SESSION['user_id'])) send_error('Not logged in', 401);
    $stmt = $pdo->prepare("SELECT username, role, phone, email FROM users WHERE id = ?");
    $stmt->execute(array($_SESSION['user_id']));
    $user = $stmt->fetch();
    if (!$user) send_error('Not found', 404);

    $custStmt = $pdo->prepare("SELECT id, phone, email FROM customers WHERE user_id = ?");
    $custStmt->execute(array($_SESSION['user_id']));
    $cust = $custStmt->fetch();

    $phone = trim($user['phone']);
    $email = trim($user['email']);
    if ($cust) {
        if (!$phone && !empty($cust['phone'])) $phone = trim($cust['phone']);
        if (!$email && !empty($cust['email'])) $email = trim($cust['email']);
    }

    send(array(
        'username' => $user['username'],
        'role' => $user['role'],
        'phone' => $phone,
        'email' => $email,
        'customerId' => $cust ? $cust['id'] : null,
    ));
}

// ── POST /api/auth.php?action=change-password ───────────────────────────
if ($method === 'POST' && $action === 'change-password') {
    if (empty($_SESSION['user_id'])) send_error('Not logged in', 401);
    $body = json_body();
    $current = (string)ga($body, 'currentPassword', '');
    $new = (string)ga($body, 'newPassword', '');
    $pwErr = validate_password_strength($new);
    if ($pwErr) send_error($pwErr);

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
