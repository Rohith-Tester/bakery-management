<?php
/**
 * Starts the PHP session with hardened cookie settings. Included from every
 * entry point (login.php, index.php, api/_bootstrap.php) so the session
 * cookie is *always* HttpOnly + SameSite=Lax + Secure-when-HTTPS, no matter
 * which page the browser hits first.
 */
if (session_status() !== PHP_SESSION_ACTIVE) {
    $__https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    // session_set_cookie_params() only accepts the associative-array form
    // (with 'samesite') from PHP 7.3 onward; older PHP needs the legacy
    // positional signature or it silently mishandles the array (surfacing
    // as an "Array to string conversion" notice) and samesite is simply
    // dropped on those versions since there's no way to set it pre-7.3.
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params(array(
            'lifetime' => 0,
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => $__https,
        ));
    } else {
        session_set_cookie_params(0, '/', '', $__https, true);
    }
    ini_set('session.use_strict_mode', '1');
    session_start();
}

// ── Idle session timeout ──────────────────────────────────────────────────
// The session cookie itself is a "session cookie" (lifetime 0, meant to die
// when the browser fully closes) — but browsers with a "continue where you
// left off" / restore-tabs feature (Chrome, Edge, etc.) can bring session
// cookies back to life on the next launch, so closing and reopening the
// browser isn't a reliable way to force a logout on its own. This enforces
// a real expiry on the server side: if there's been no activity for longer
// than SESSION_IDLE_TIMEOUT_SECONDS, the session is wiped and the person
// has to log in again, no matter what the browser did with the cookie.
define('SESSION_IDLE_TIMEOUT_SECONDS', 10 * 60); // 10 minutes

if (!empty($_SESSION['user_id']) && !empty($_SESSION['last_activity'])
    && (time() - $_SESSION['last_activity']) > SESSION_IDLE_TIMEOUT_SECONDS) {
    $_SESSION = array();
    session_regenerate_id(true);
}
$_SESSION['last_activity'] = time();

// One CSRF token per session, generated once and reused for its lifetime.
// Exposed to the frontend (index.php/login.php embed it, api/auth.php
// returns it) and required as an X-CSRF-Token header on every state-changing
// (POST/PATCH/DELETE) API request once a user is logged in — see the check
// in api/_bootstrap.php. Login/register themselves aren't gated on it since
// there's no authenticated session yet to protect at that point.
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = function_exists('random_bytes') ? bin2hex(random_bytes(32)) : bin2hex(openssl_random_pseudo_bytes(32));
}
