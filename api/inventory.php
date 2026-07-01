<?php
require __DIR__ . '/_bootstrap.php';
require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

function fmt_item($r) {
    return array(
        'id' => $r['id'],
        'name' => $r['name'],
        'quantity' => (float)$r['quantity'],
        'unit' => $r['unit'],
        'minStock' => (float)$r['min_stock'],
        'costPerUnit' => (float)$r['cost_per_unit'],
        'status' => stock_status((float)$r['quantity'], (float)$r['min_stock']),
    );
}

if ($method === 'GET' && !$id) {
    $rows = $pdo->query("SELECT * FROM inventory ORDER BY name")->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_item($r);
    send($out);
}

if ($method === 'POST') {
    $body = json_body();
    $name = trim(ga($body, 'name', ''));
    $quantity = ga($body, 'quantity', '');
    if (!$name || $quantity === '' || $quantity === null) {
        send_error('name and quantity required');
    }
    $newId = uuid4();
    $unit = ga($body, 'unit', '');
    $minStock = ga($body, 'minStock', '');
    $costPerUnit = ga($body, 'costPerUnit', '');
    $stmt = $pdo->prepare(
        "INSERT INTO inventory (id, name, quantity, unit, min_stock, cost_per_unit) VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute(array(
        $newId,
        $name,
        (float)$quantity,
        $unit !== '' ? $unit : 'kg',
        ($minStock !== '' && $minStock !== null) ? (float)$minStock : 1,
        ($costPerUnit !== '' && $costPerUnit !== null) ? (float)$costPerUnit : 0,
    ));
    $row = $pdo->prepare("SELECT * FROM inventory WHERE id = ?");
    $row->execute(array($newId));
    send(fmt_item($row->fetch()), 201);
}

if ($method === 'PATCH' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM inventory WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);

    $body = json_body();
    $quantity = ga($body, 'quantity', '');
    $minStock = ga($body, 'minStock', '');
    $costPerUnit = ga($body, 'costPerUnit', '');

    $merged = array(
        'name' => ga($body, 'name', $existing['name']),
        'quantity' => ($quantity !== '' && $quantity !== null) ? (float)$quantity : (float)$existing['quantity'],
        'unit' => ga($body, 'unit', $existing['unit']),
        'min_stock' => ($minStock !== '' && $minStock !== null) ? (float)$minStock : (float)$existing['min_stock'],
        'cost_per_unit' => ($costPerUnit !== '' && $costPerUnit !== null) ? (float)$costPerUnit : (float)$existing['cost_per_unit'],
    );
    $upd = $pdo->prepare(
        "UPDATE inventory SET name=?, quantity=?, unit=?, min_stock=?, cost_per_unit=? WHERE id = ?"
    );
    $upd->execute(array($merged['name'], $merged['quantity'], $merged['unit'], $merged['min_stock'], $merged['cost_per_unit'], $id));

    $row = $pdo->prepare("SELECT * FROM inventory WHERE id = ?");
    $row->execute(array($id));
    send(fmt_item($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT id FROM inventory WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM inventory WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
