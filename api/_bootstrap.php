<?php
// Never let PHP notices/warnings leak into the JSON response body —
// that's the #1 cause of "undefined is not iterable" style errors on the frontend.
ini_set('display_errors', '0');
error_reporting(E_ALL);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/db.php';

// Every API endpoint requires a logged-in session, except auth.php
// (login/register/logout/check must be reachable while logged out) and
// track.php (the public order-tracking lookup customers use without an account).
$__self = basename($_SERVER['SCRIPT_NAME']);
$__publicEndpoints = array('auth.php', 'track.php');
if (!in_array($__self, $__publicEndpoints, true) && empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(array('error' => 'Not authenticated'));
    exit;
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
