<?php
require __DIR__ . '/_bootstrap.php';
require_admin();
$pdo = db();

$todayOrders = (int) $pdo->query(
    "SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE()"
)->fetchColumn();

$todayRevenue = (float) $pdo->query(
    "SELECT COALESCE(SUM(amount),0) FROM invoices WHERE status = 'paid' AND DATE(created_at) = CURDATE()"
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

// Last 7 days of sales (oldest → newest, today last), 0 for days with no orders.
$stmt = $pdo->prepare(
    "SELECT DATE(created_at) as d, SUM(total) as s FROM orders
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at)"
);
$stmt->execute();
$salesByDay = [];
foreach ($stmt->fetchAll() as $r) $salesByDay[$r['d']] = (float)$r['s'];

$weeklySales = [];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i day"));
    $weeklySales[] = isset($salesByDay[$d]) ? round($salesByDay[$d], 2) : 0.0;
}

send([
    'todayOrders' => $todayOrders,
    'todayRevenue' => $todayRevenue,
    'totalCustomers' => $totalCustomers,
    'lowStockCount' => $lowStockCount,
    'recentOrders' => $recentOrders,
    'weeklySales' => $weeklySales,
]);
