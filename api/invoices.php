<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$orderId = ga($_GET, 'orderId', null);
$action = ga($_GET, 'action', null);

// Receipt lookups are allowed for the order's own customer (so they can
// view/download their own slip) as well as admin/staff. Everything else
// on this endpoint (the invoice list, marking paid, deleting) stays
// admin-only.
if ($method === 'GET' && $action === 'receipt' && ($id || $orderId)) {
    if (empty($_SESSION['user_id'])) send_error('Not authenticated', 401);
} else {
    require_admin();
}

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
        'paymentMethod' => isset($r['payment_method']) ? $r['payment_method'] : null,
        'paymentTxnId' => isset($r['payment_txn_id']) ? $r['payment_txn_id'] : null,
        'paymentCardLast4' => isset($r['payment_card_last4']) ? $r['payment_card_last4'] : null,
        'paymentMode' => isset($r['payment_mode']) ? $r['payment_mode'] : '',
        'customerPhone' => isset($r['customer_phone']) ? $r['customer_phone'] : '',
        'customerEmail' => isset($r['customer_email']) ? $r['customer_email'] : '',
    );
}

if ($method === 'GET' && !$id && !$orderId) {
    $rows = $pdo->query(
        "SELECT inv.*, o.payment_method, o.payment_txn_id, o.payment_card_last4, o.payment_mode, o.customer_phone, o.customer_email
         FROM invoices inv
         LEFT JOIN orders o ON o.id = inv.order_id
         ORDER BY inv.created_at DESC"
    )->fetchAll();
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

if ($method === 'GET' && ($id || $orderId) && $action === 'receipt') {
    if ($orderId) {
        $stmt = $pdo->prepare(
            "SELECT inv.*, o.payment_method, o.payment_txn_id, o.payment_card_last4, o.payment_mode, o.customer_phone, o.customer_email,
                    o.delivery_type, o.delivery_address, o.delivery_charge, o.discount_amount, o.coupon_code,
                    o.id AS order_pk, o.user_id AS order_user_id
             FROM invoices inv
             LEFT JOIN orders o ON o.id = inv.order_id
             WHERE inv.order_id = ?
             ORDER BY inv.created_at DESC LIMIT 1"
        );
        $stmt->execute(array($orderId));
    } else {
        $stmt = $pdo->prepare(
            "SELECT inv.*, o.payment_method, o.payment_txn_id, o.payment_card_last4, o.payment_mode, o.customer_phone, o.customer_email,
                    o.delivery_type, o.delivery_address, o.delivery_charge, o.discount_amount, o.coupon_code,
                    o.id AS order_pk, o.user_id AS order_user_id
             FROM invoices inv
             LEFT JOIN orders o ON o.id = inv.order_id
             WHERE inv.id = ?"
        );
        $stmt->execute(array($id));
    }
    $inv = $stmt->fetch();
    if (!$inv) send_error('Not found', 404);

    // Customers may only ever view their own receipt.
    if (current_role() === 'customer' && $inv['order_user_id'] !== $_SESSION['user_id']) {
        send_error('Not found', 404);
    }

    $items = array();
    if ($inv['order_pk']) {
        $itemsStmt = $pdo->prepare("SELECT name, qty, price FROM order_items WHERE order_id = ?");
        $itemsStmt->execute(array($inv['order_pk']));
        foreach ($itemsStmt->fetchAll() as $r) {
            $items[] = array('name' => $r['name'], 'qty' => (int)$r['qty'], 'price' => (float)$r['price']);
        }
    }

    $receipt = fmt_invoice($inv);
    $receipt['items'] = $items;
    $receipt['deliveryType'] = isset($inv['delivery_type']) ? $inv['delivery_type'] : null;
    $receipt['deliveryAddress'] = isset($inv['delivery_address']) ? $inv['delivery_address'] : '';
    $receipt['deliveryCharge'] = isset($inv['delivery_charge']) ? (float)$inv['delivery_charge'] : 0;
    $receipt['discountAmount'] = isset($inv['discount_amount']) ? (float)$inv['discount_amount'] : 0;
    $receipt['couponCode'] = isset($inv['coupon_code']) ? $inv['coupon_code'] : null;
    send($receipt);
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

if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT id FROM invoices WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM invoices WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
