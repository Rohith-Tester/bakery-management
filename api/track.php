<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();

$orderNumber = ga($_GET, 'order_number', '');
if (!$orderNumber) send_error('order_number required');

$stmt = $pdo->prepare("SELECT * FROM orders WHERE LOWER(order_number) = LOWER(?)");
$stmt->execute(array($orderNumber));
$order = $stmt->fetch();
if (!$order) send_error('Order not found', 404);

$itemsStmt = $pdo->prepare("SELECT name, qty, price FROM order_items WHERE order_id = ?");
$itemsStmt->execute(array($order['id']));
$items = array();
foreach ($itemsStmt->fetchAll() as $r) {
    $items[] = array('name' => $r['name'], 'qty' => (int)$r['qty'], 'price' => (float)$r['price']);
}

$steps = array('pending', 'baking', 'ready', 'delivered');
$currentIdx = array_search($order['status'], $steps, true);

$timeline = array();
foreach ($steps as $idx => $step) {
    $timeline[] = array(
        'step' => $step,
        'label' => ucfirst($step),
        'completed' => $idx <= $currentIdx,
        'active' => $idx === $currentIdx,
    );
}

send(array(
    'orderNumber' => $order['order_number'],
    'customerName' => $order['customer_name'],
    'items' => $items,
    'total' => (float)$order['total'],
    'status' => $order['status'],
    'createdAt' => $order['created_at'],
    'timeline' => $timeline,
));
