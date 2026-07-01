<?php
require __DIR__ . '/_bootstrap.php';
require_admin();
$pdo = db();

$todayOrders = (int) $pdo->query("SELECT COUNT(*) FROM orders")->fetchColumn();

$todayRevenue = (float) $pdo->query(
    "SELECT COALESCE(SUM(amount),0) FROM invoices WHERE status = 'paid'"
)->fetchColumn();

$totalCustomers = (int) $pdo->query("SELECT COUNT(*) FROM customers")->fetchColumn();

$lowStockCount = 0;
foreach ($pdo->query("SELECT quantity, min_stock FROM inventory") as $row) {
    $s = stock_status((float)$row['quantity'], (float)$row['min_stock']);
    if ($s === 'low' || $s === 'critical') $lowStockCount++;
}

$recentOrders = [];
$stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5");
$orderRows = $stmt->fetchAll();
if ($orderRows) {
    $ids = array_column($orderRows, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $itemsStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ($placeholders)");
    $itemsStmt->execute($ids);
    $itemsByOrder = [];
    foreach ($itemsStmt->fetchAll() as $it) {
        if (!isset($itemsByOrder[$it['order_id']])) $itemsByOrder[$it['order_id']] = [];
        $itemsByOrder[$it['order_id']][] = ['name' => $it['name'], 'qty' => (int)$it['qty'], 'price' => (float)$it['price']];
    }
    foreach ($orderRows as $o) {
        $recentOrders[] = [
            'id' => $o['id'],
            'orderNumber' => $o['order_number'],
            'customerName' => $o['customer_name'],
            'items' => ga($itemsByOrder, $o['id'], []),
            'total' => (float)$o['total'],
            'status' => $o['status'],
            'createdAt' => $o['created_at'],
        ];
    }
}

// Static weekly sales sample, mirroring the original Node implementation
$weeklySales = [12000, 15000, 10000, 19000, 22000, 25000, 18000];

send([
    'todayOrders' => $todayOrders,
    'todayRevenue' => $todayRevenue,
    'totalCustomers' => $totalCustomers,
    'lowStockCount' => $lowStockCount,
    'recentOrders' => $recentOrders,
    'weeklySales' => $weeklySales,
]);
