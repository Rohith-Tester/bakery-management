<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

// Reading customers is allowed for any logged-in user (staff need this list
// for the "New Order" customer picker). Creating/editing/deleting customers
// is admin-only.
if ($method !== 'GET') {
    require_admin();
}

function fmt_customer($r) {
    return array(
        'id' => $r['id'],
        'name' => $r['name'],
        'email' => $r['email'],
        'phone' => $r['phone'],
        'address' => $r['address'] ?? '',
        'city' => $r['city'] ?? '',
        'postalCode' => $r['postal_code'] ?? '',
        'deliveryNotes' => $r['delivery_notes'] ?? '',
        'totalOrders' => (int)$r['total_orders'],
        'totalSpend' => (float)$r['total_spend'],
    );
}

if ($method === 'GET' && !$id) {
    $rows = $pdo->query("SELECT * FROM customers ORDER BY name")->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_customer($r);
    send($out);
}

if ($method === 'POST') {
    $body = json_body();
    $name = trim(ga($body, 'name', ''));
    if (!$name) send_error('name required');

    $newId = uuid4();
    $stmt = $pdo->prepare(
        "INSERT INTO customers (id, name, email, phone, address, city, postal_code, delivery_notes, total_orders, total_spend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)"
    );
    $stmt->execute(array(
        $newId,
        $name,
        ga($body, 'email', ''),
        ga($body, 'phone', ''),
        ga($body, 'address', ''),
        ga($body, 'city', ''),
        ga($body, 'postalCode', ''),
        ga($body, 'deliveryNotes', '')
    ));
    $row = $pdo->prepare("SELECT * FROM customers WHERE id = ?");
    $row->execute(array($newId));
    send(fmt_customer($row->fetch()), 201);
}

if ($method === 'PATCH' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM customers WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);

    $body = json_body();
    $merged = array(
        'name' => ga($body, 'name', $existing['name']),
        'email' => ga($body, 'email', $existing['email']),
        'phone' => ga($body, 'phone', $existing['phone']),
        'address' => ga($body, 'address', $existing['address']),
        'city' => ga($body, 'city', $existing['city']),
        'postal_code' => ga($body, 'postalCode', $existing['postal_code']),
        'delivery_notes' => ga($body, 'deliveryNotes', $existing['delivery_notes']),
    );
    $upd = $pdo->prepare("UPDATE customers SET name=?, email=?, phone=?, address=?, city=?, postal_code=?, delivery_notes=? WHERE id = ?");
    $upd->execute(array(
        $merged['name'],
        $merged['email'],
        $merged['phone'],
        $merged['address'],
        $merged['city'],
        $merged['postal_code'],
        $merged['delivery_notes'],
        $id
    ));

    $row = $pdo->prepare("SELECT * FROM customers WHERE id = ?");
    $row->execute(array($id));
    send(fmt_customer($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT id FROM customers WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM customers WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
