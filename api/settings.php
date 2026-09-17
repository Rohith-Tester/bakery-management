<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

function fmt_settings($r) {
    return array(
        'bakeryName' => $r ? $r['bakery_name'] : 'Golden Crust Bakery',
        'gstNumber' => $r ? $r['gst_number'] : '',
        'phone' => $r ? $r['phone'] : '',
        'email' => $r ? $r['email'] : '',
        'address' => $r ? $r['address'] : '',
        'taxPercentage' => $r ? (float)$r['tax_percentage'] : 0,
        'currency' => $r ? $r['currency'] : 'INR',
        'businessHours' => $r ? $r['business_hours'] : '',
        'updatedAt' => $r ? $r['updated_at'] : null,
    );
}

// ── GET /api/settings.php ────────────────────────────────────────────────
// Public (listed in _bootstrap.php's public endpoints) so the login page
// and Order Details page can show bakery identity / "call to order"
// details to anyone, logged in or not, and so invoices/receipts can pull
// the tax rate and currency without an extra authenticated round trip.
if ($method === 'GET') {
    $row = $pdo->query("SELECT * FROM store_settings WHERE id = 1")->fetch();
    send(fmt_settings($row));
}

// ── PATCH /api/settings.php ──────────────────────────────────────────────
// Admin-only: update the bakery's business configuration. Fields not
// present in the request body keep their existing value — this lets the
// lightweight "Edit Contact" shortcut (phone/email/address only) coexist
// with the full Settings page without one clobbering the other.
if ($method === 'PATCH') {
    if (empty($_SESSION['user_id'])) send_error('Not authenticated', 401);
    require_admin();
    $body = json_body();
    $existing = $pdo->query("SELECT * FROM store_settings WHERE id = 1")->fetch();
    $current = fmt_settings($existing);

    $bakeryName = trim(ga($body, 'bakeryName', $current['bakeryName']));
    if ($bakeryName === '') send_error('Bakery name is required');
    $gstNumber = trim(ga($body, 'gstNumber', $current['gstNumber']));
    $phone = trim(ga($body, 'phone', $current['phone']));
    $email = trim(ga($body, 'email', $current['email']));
    $address = trim(ga($body, 'address', $current['address']));
    $currency = strtoupper(trim(ga($body, 'currency', $current['currency']))) ?: 'INR';
    $businessHours = trim(ga($body, 'businessHours', $current['businessHours']));

    $taxPercentage = ga($body, 'taxPercentage', $current['taxPercentage']);
    if (!is_numeric($taxPercentage) || (float)$taxPercentage < 0 || (float)$taxPercentage > 100) {
        send_error('Tax percentage must be a number between 0 and 100');
    }
    $taxPercentage = round((float)$taxPercentage, 2);

    if ($existing) {
        $pdo->prepare(
            "UPDATE store_settings SET bakery_name=?, gst_number=?, phone=?, email=?, address=?, tax_percentage=?, currency=?, business_hours=? WHERE id = 1"
        )->execute(array($bakeryName, $gstNumber, $phone, $email, $address, $taxPercentage, $currency, $businessHours));
    } else {
        $pdo->prepare(
            "INSERT INTO store_settings (id, bakery_name, gst_number, phone, email, address, tax_percentage, currency, business_hours) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute(array($bakeryName, $gstNumber, $phone, $email, $address, $taxPercentage, $currency, $businessHours));
    }

    $row = $pdo->query("SELECT * FROM store_settings WHERE id = 1")->fetch();
    send(fmt_settings($row));
}

send_error('Unsupported request', 405);
