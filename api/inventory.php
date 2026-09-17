<?php
require __DIR__ . '/_bootstrap.php';
// Reading the inventory (to show real bakery items in the order form's item
// picker, and their live stock) is available to ANY logged-in account —
// admin, staff, or customer. Only admins can add/edit/remove stock.
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

function fmt_item($r) {
    // sellPrice is a suggested retail price (cost + healthy bakery margin),
    // rounded to a friendly number — used to prefill the order form so
    // customers/staff aren't asked to price items themselves from cost.
    // Formula lives once in api/_bootstrap.php (computed_sell_price) so
    // api/orders.php can use the exact same trusted number when pricing
    // an order server-side.
    $cost = (float)$r['cost_per_unit'];
    $sell = computed_sell_price($cost);
    return array(
        'id' => $r['id'],
        'name' => $r['name'],
        'quantity' => (float)$r['quantity'],
        'unit' => $r['unit'],
        'minStock' => (float)$r['min_stock'],
        'costPerUnit' => $cost,
        'sellPrice' => $sell,
        'imageUrl' => isset($r['image_url']) ? $r['image_url'] : '',
        'supplierId' => isset($r['supplier_id']) ? $r['supplier_id'] : null,
        'supplierName' => isset($r['supplier_name']) ? $r['supplier_name'] : '',
        'status' => stock_status((float)$r['quantity'], (float)$r['min_stock']),
    );
}

if ($method === 'GET' && !$id) {
    $rows = $pdo->query(
        "SELECT i.*, s.name AS supplier_name FROM inventory i
         LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name"
    )->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_item($r);
    send($out);
}

// Everything past this point mutates stock — admin only.
require_admin();

if ($method === 'POST') {
    $body = json_body();
    $name = trim(ga($body, 'name', ''));
    $quantity = ga($body, 'quantity', '');
    $imageUrl = trim(ga($body, 'imageUrl', ''));
    if (!$name || $quantity === '' || $quantity === null) {
        send_error('name and quantity required');
    }
    // Product photo is mandatory when adding a new item — it's what shows
    // on the New Order product grid instead of the generic emoji icon.
    if ($imageUrl === '') {
        send_error('Product image is required');
    }
    $newId = uuid4();
    $unit = ga($body, 'unit', '');
    $minStock = ga($body, 'minStock', '');
    $costPerUnit = ga($body, 'costPerUnit', '');
    $supplierId = ga($body, 'supplierId', '');
    $stmt = $pdo->prepare(
        "INSERT INTO inventory (id, name, quantity, unit, min_stock, cost_per_unit, image_url, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute(array(
        $newId,
        $name,
        (float)$quantity,
        $unit !== '' ? $unit : 'kg',
        ($minStock !== '' && $minStock !== null) ? (float)$minStock : 1,
        ($costPerUnit !== '' && $costPerUnit !== null) ? (float)$costPerUnit : 0,
        $imageUrl,
        $supplierId !== '' ? $supplierId : null,
    ));
    $row = $pdo->prepare(
        "SELECT i.*, s.name AS supplier_name FROM inventory i LEFT JOIN suppliers s ON s.id = i.supplier_id WHERE i.id = ?"
    );
    $row->execute(array($newId));
    $created = $row->fetch();

    // Log this as a stock import so it counts toward the weekly spend report.
    $qtyFloat = (float)$created['quantity'];
    if ($qtyFloat > 0) {
        $costFloat = (float)$created['cost_per_unit'];
        $pdo->prepare(
            "INSERT INTO inventory_purchases (id, item_id, item_name, quantity, cost_per_unit, total_cost) VALUES (?, ?, ?, ?, ?, ?)"
        )->execute(array(uuid4(), $newId, $created['name'], $qtyFloat, $costFloat, $qtyFloat * $costFloat));
    }

    send(fmt_item($created), 201);
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

    $supplierIdRaw = ga($body, 'supplierId', null);
    $merged = array(
        'name' => ga($body, 'name', $existing['name']),
        'quantity' => ($quantity !== '' && $quantity !== null) ? (float)$quantity : (float)$existing['quantity'],
        'unit' => ga($body, 'unit', $existing['unit']),
        'min_stock' => ($minStock !== '' && $minStock !== null) ? (float)$minStock : (float)$existing['min_stock'],
        'cost_per_unit' => ($costPerUnit !== '' && $costPerUnit !== null) ? (float)$costPerUnit : (float)$existing['cost_per_unit'],
        'image_url' => ga($body, 'imageUrl', isset($existing['image_url']) ? $existing['image_url'] : ''),
        'supplier_id' => $supplierIdRaw !== null ? ($supplierIdRaw !== '' ? $supplierIdRaw : null) : (isset($existing['supplier_id']) ? $existing['supplier_id'] : null),
    );
    $upd = $pdo->prepare(
        "UPDATE inventory SET name=?, quantity=?, unit=?, min_stock=?, cost_per_unit=?, image_url=?, supplier_id=? WHERE id = ?"
    );
    $upd->execute(array($merged['name'], $merged['quantity'], $merged['unit'], $merged['min_stock'], $merged['cost_per_unit'], $merged['image_url'], $merged['supplier_id'], $id));

    // If this edit increased stock, it's a restock/import — log the money
    // spent on the added quantity for the weekly spend report.
    $qtyDelta = $merged['quantity'] - (float)$existing['quantity'];
    if ($qtyDelta > 0) {
        $pdo->prepare(
            "INSERT INTO inventory_purchases (id, item_id, item_name, quantity, cost_per_unit, total_cost) VALUES (?, ?, ?, ?, ?, ?)"
        )->execute(array(uuid4(), $id, $merged['name'], $qtyDelta, $merged['cost_per_unit'], $qtyDelta * $merged['cost_per_unit']));
    }

    $row = $pdo->prepare(
        "SELECT i.*, s.name AS supplier_name FROM inventory i LEFT JOIN suppliers s ON s.id = i.supplier_id WHERE i.id = ?"
    );
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
