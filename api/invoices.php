<?php
require __DIR__ . '/_bootstrap.php';
require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

function fmt_invoice($r) {
    return array(
        'id' => $r['id'],
        'invoiceNumber' => $r['invoice_number'],
        'orderId' => $r['order_id'],
        'orderNumber' => $r['order_number'],
        'customerId' => $r['customer_id'],
        'customerName' => $r['customer_name'],
        'amount' => (float)$r['amount'],
        'status' => $r['status'],
        'createdAt' => $r['created_at'],
    );
}

if ($method === 'GET' && !$id) {
    $rows = $pdo->query("SELECT * FROM invoices ORDER BY created_at DESC")->fetchAll();
    $invoices = array();
    foreach ($rows as $r) $invoices[] = fmt_invoice($r);

    $totalRevenue = (float) $pdo->query("SELECT COALESCE(SUM(amount),0) FROM invoices WHERE status='paid'")->fetchColumn();
    $pendingRevenue = (float) $pdo->query("SELECT COALESCE(SUM(amount),0) FROM invoices WHERE status='unpaid'")->fetchColumn();
    $countAll = (int) $pdo->query("SELECT COUNT(*) FROM invoices")->fetchColumn();
    $sumAll = (float) $pdo->query("SELECT COALESCE(SUM(amount),0) FROM invoices")->fetchColumn();
    $avgOrderValue = $countAll ? (int) round($sumAll / $countAll) : 0;

    send(array(
        'invoices' => $invoices,
        'totalRevenue' => $totalRevenue,
        'pendingRevenue' => $pendingRevenue,
        'avgOrderValue' => $avgOrderValue,
    ));
}

if ($method === 'PATCH' && $id && $action === 'pay') {
    $stmt = $pdo->prepare("SELECT * FROM invoices WHERE id = ?");
    $stmt->execute(array($id));
    $inv = $stmt->fetch();
    if (!$inv) send_error('Not found', 404);

    $pdo->prepare("UPDATE invoices SET status = 'paid' WHERE id = ?")->execute(array($id));
    if ($inv['order_id']) {
        $pdo->prepare("UPDATE orders SET status = 'delivered' WHERE id = ?")->execute(array($inv['order_id']));
    }

    $row = $pdo->prepare("SELECT * FROM invoices WHERE id = ?");
    $row->execute(array($id));
    send(fmt_invoice($row->fetch()));
}

send_error('Unsupported request', 405);
