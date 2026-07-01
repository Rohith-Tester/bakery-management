<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

function fetch_order_with_items($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute(array($id));
    $o = $stmt->fetch();
    if (!$o) return null;
    $itemsStmt = $pdo->prepare("SELECT name, qty, price FROM order_items WHERE order_id = ?");
    $itemsStmt->execute(array($id));
    $items = array();
    foreach ($itemsStmt->fetchAll() as $r) {
        $items[] = array('name' => $r['name'], 'qty' => (int)$r['qty'], 'price' => (float)$r['price']);
    }
    return array(
        'id' => $o['id'],
        'orderNumber' => $o['order_number'],
        'customerId' => $o['customer_id'],
        'customerName' => $o['customer_name'],
        'items' => $items,
        'total' => (float)$o['total'],
        'status' => $o['status'],
        'paymentMethod' => $o['payment_method'],
        'createdAt' => $o['created_at'],
    );
}

// ── GET /api/orders.php[?status=pending] ────────────────────────────────
if ($method === 'GET' && !$id) {
    $status = ga($_GET, 'status', null);
    if ($status && $status !== 'all') {
        $stmt = $pdo->prepare("SELECT id FROM orders WHERE status = ? ORDER BY created_at DESC");
        $stmt->execute(array($status));
    } else {
        $stmt = $pdo->query("SELECT id FROM orders ORDER BY created_at DESC");
    }
    $result = array();
    foreach ($stmt->fetchAll() as $row) {
        $result[] = fetch_order_with_items($pdo, $row['id']);
    }
    send($result);
}

// ── POST /api/orders.php ────────────────────────────────────────────────
if ($method === 'POST') {
    $body = json_body();
    $customerName = trim(ga($body, 'customerName', ''));
    $customerId = ga($body, 'customerId', null);
    $items = ga($body, 'items', array());
    $paymentMethod = ga($body, 'paymentMethod', 'offline');
    if (!in_array($paymentMethod, array('online', 'offline'), true)) {
        $paymentMethod = 'offline';
    }

    if (!$customerName || !count($items)) {
        send_error('customerName and items required');
    }

    $total = 0;
    foreach ($items as $it) {
        $total += (float)ga($it, 'price', 0) * (float)ga($it, 'qty', 0);
    }

    $countStmt = $pdo->query("SELECT COUNT(*) FROM orders");
    $orderNumber = 'ORD-' . str_pad((string)($countStmt->fetchColumn() + 1), 3, '0', STR_PAD_LEFT);

    $newId = uuid4();
    $now = date('Y-m-d H:i:s');

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO orders (id, order_number, customer_id, customer_name, total, status, payment_method, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)"
        );
        $stmt->execute(array($newId, $orderNumber, $customerId ? $customerId : null, $customerName, $total, $paymentMethod, $now));

        $itemStmt = $pdo->prepare("INSERT INTO order_items (order_id, name, qty, price) VALUES (?, ?, ?, ?)");
        foreach ($items as $it) {
            $name = ga($it, 'name', '');
            if (empty($name)) continue;
            $itemStmt->execute(array($newId, $name, (int)ga($it, 'qty', 1), (float)ga($it, 'price', 0)));
        }

        // Dummy online payments (scanned QR) are treated as paid right away;
        // offline/cash-on-delivery orders stay unpaid until marked delivered.
        $invoiceStatus = $paymentMethod === 'online' ? 'paid' : 'unpaid';

        $invCountStmt = $pdo->query("SELECT COUNT(*) FROM invoices");
        $invoiceNumber = 'INV-' . str_pad((string)($invCountStmt->fetchColumn() + 1), 3, '0', STR_PAD_LEFT);
        $invStmt = $pdo->prepare(
            "INSERT INTO invoices (id, invoice_number, order_id, order_number, customer_id, customer_name, amount, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $invStmt->execute(array(uuid4(), $invoiceNumber, $newId, $orderNumber, $customerId ? $customerId : null, $customerName, $total, $invoiceStatus, $now));

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to create order: ' . $e->getMessage(), 500);
    }

    send(fetch_order_with_items($pdo, $newId), 201);
}

// ── PATCH /api/orders.php?id=...&action=status ──────────────────────────
if ($method === 'PATCH' && $id && $action === 'status') {
    $body = json_body();
    $status = ga($body, 'status', null);
    if (!in_array($status, array('pending', 'baking', 'ready', 'delivered'), true)) {
        send_error('Invalid status');
    }
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);

    $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?")->execute(array($status, $id));
    if ($status === 'delivered') {
        $pdo->prepare("UPDATE invoices SET status = 'paid' WHERE order_id = ?")->execute(array($id));
    }
    send(fetch_order_with_items($pdo, $id));
}

// ── DELETE /api/orders.php?id=... ───────────────────────────────────────
if ($method === 'DELETE' && $id) {
    require_admin();
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM orders WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
