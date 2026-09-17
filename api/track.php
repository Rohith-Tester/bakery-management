<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();

$orderNumber = ga($_GET, 'order_number', '');
if (!$orderNumber) send_error('order_number required');

$stmt = $pdo->prepare("SELECT * FROM orders WHERE LOWER(order_number) = LOWER(?)");
$stmt->execute(array($orderNumber));
$order = $stmt->fetch();

// Not a customer order number? Fall back to checking whether it's a
// supplier restock tracking number instead, so the same Track Order box
// (on both the admin and supplier pages) can look up either kind of
// shipment. Suppliers only ever see their own tracking numbers.
if (!$order) {
    $raStmt = $pdo->prepare("SELECT * FROM restock_alerts WHERE LOWER(tracking_number) = LOWER(?)");
    $raStmt->execute(array($orderNumber));
    $alert = $raStmt->fetch();
    if ($alert) {
        // Supplier restock tracking is internal to the bakery's supply
        // chain — only admin/staff (who manage restocking) and the
        // supplier who owns the shipment may look it up. Customers and
        // guests must never see supplier tracking info, even if they
        // happen to enter/guess a valid tracking number.
        $role = current_role();
        if ($role === 'supplier') {
            $supplierId = current_supplier_id($pdo);
            if (!$supplierId || $alert['supplier_id'] !== $supplierId) send_error('Order not found', 404);
        } elseif ($role !== 'admin' && $role !== 'staff') {
            send_error('Order not found', 404);
        }
        $raSteps = array('ready', 'dispatched', 'received', 'resolved');
        $raLabels = array('ready' => 'Ready for Pickup', 'dispatched' => 'Dispatched', 'received' => 'Received', 'resolved' => 'Resolved');
        $raIdx = array_search($alert['status'], $raSteps, true);
        if ($raIdx === false) $raIdx = 0;
        $raTimeline = array();
        foreach ($raSteps as $idx => $step) {
            $raTimeline[] = array('step' => $step, 'label' => $raLabels[$step], 'completed' => $idx <= $raIdx, 'active' => $idx === $raIdx);
        }
        send(array(
            'type' => 'supplier_tracking',
            'trackingNumber' => $alert['tracking_number'],
            'itemName' => $alert['item_name'],
            'supplierName' => $alert['supplier_name'],
            'deliveryPartner' => $alert['delivery_partner'],
            'status' => $alert['status'],
            'dispatchedAt' => $alert['dispatched_at'],
            'receivedAt' => $alert['received_at'],
            'timeline' => $raTimeline,
        ));
    }
    send_error('Order not found', 404);
}

// If a customer is logged in, Track Order only works for their own orders —
// someone else's valid order number should look the same as a non-existent
// one to them. Guests with no account (not logged in), and staff/admin/
// delivery roles managing orders, can still look up any order number.
if (!empty($_SESSION['user_id']) && current_role() === 'customer' && $order['user_id'] !== $_SESSION['user_id']) {
    send_error('Order not found', 404);
}

$itemsStmt = $pdo->prepare("SELECT id, name, qty, price FROM order_items WHERE order_id = ?");
$itemsStmt->execute(array($order['id']));
$items = array();
foreach ($itemsStmt->fetchAll() as $r) {
    $items[] = array('id' => (int)$r['id'], 'name' => $r['name'], 'qty' => (int)$r['qty'], 'price' => (float)$r['price']);
}

$invStmt = $pdo->prepare("SELECT status FROM invoices WHERE order_id = ? ORDER BY created_at DESC LIMIT 1");
$invStmt->execute(array($order['id']));
$invRow = $invStmt->fetch();
$paymentStatus = $invRow ? $invRow['status'] : null;

$stepLabels = array(
    'pending' => 'Pending',
    'baking' => 'Baking',
    'ready' => 'Ready',
    'out_for_delivery' => 'Out for Delivery',
    'delivered' => 'Delivered',
);

if ($order['delivery_type'] === 'delivery') {
    $steps = array('pending', 'baking', 'ready', 'out_for_delivery', 'delivered');
} else {
    $steps = array('pending', 'baking', 'ready', 'delivered');
}

$currentIdx = array_search($order['status'], $steps, true);
if ($currentIdx === false) {
    $currentIdx = count($steps) - 1;
}

// Expected delivery date: use the customer's requested date if one was
// given at checkout, otherwise estimate a couple of days out from when the
// order was placed (delivery orders get an extra day over pickup, similar
// to how an e-commerce tracker shows an "arriving by" date).
if (!empty($order['requested_date'])) {
    $expectedDeliveryDate = $order['requested_date'];
} else {
    $daysOut = $order['delivery_type'] === 'delivery' ? 3 : 2;
    $expectedDeliveryDate = date('Y-m-d', strtotime($order['created_at'] . ' +' . $daysOut . ' days'));
}

// Delivery timing: once the order has actually been delivered, compare the
// calendar date it was delivered on against the expected date so Track
// Order can tell the customer it arrived early, on time, or late.
$deliveryTiming = null;
if ($order['status'] === 'delivered' && !empty($order['delivered_at'])) {
    $deliveredDate = date('Y-m-d', strtotime($order['delivered_at']));
    if ($deliveredDate < $expectedDeliveryDate) {
        $deliveryTiming = 'early';
    } elseif ($deliveredDate > $expectedDeliveryDate) {
        $deliveryTiming = 'late';
    } else {
        $deliveryTiming = 'on_time';
    }
}

$timeline = array();
foreach ($steps as $idx => $step) {
    $timeline[] = array(
        'step' => $step,
        'label' => isset($stepLabels[$step]) ? $stepLabels[$step] : ucfirst($step),
        'completed' => $idx <= $currentIdx,
        'active' => $idx === $currentIdx,
    );
}

// Delivery OTP: only meaningful while the order is actually out for
// delivery and hasn't been confirmed delivered yet. Shown here so the
// customer can read it out to the delivery partner on arrival.
$deliveryOtp = null;
if ($order['status'] === 'out_for_delivery' && !empty($order['delivery_otp'])) {
    $deliveryOtp = $order['delivery_otp'];
}

// Return / refund: a customer can request a return once the order has been
// delivered. Show the latest return request (if any) so Track Order can
// either offer the "Report a problem" action or show the existing request's
// status instead of letting them file a duplicate one.
$retStmt = $pdo->prepare("SELECT * FROM returns WHERE order_id = ? ORDER BY requested_at DESC LIMIT 1");
$retStmt->execute(array($order['id']));
$returnRow = $retStmt->fetch();
$returnInfo = null;
if ($returnRow) {
    $retItemsStmt = $pdo->prepare("SELECT name, qty, price FROM return_items WHERE return_id = ?");
    $retItemsStmt->execute(array($returnRow['id']));
    $retItems = array();
    foreach ($retItemsStmt->fetchAll() as $ri) {
        $retItems[] = array('name' => $ri['name'], 'qty' => (int)$ri['qty'], 'price' => (float)$ri['price']);
    }
    $returnInfo = array(
        'items' => $retItems,
        'returnNumber' => $returnRow['return_number'],
        'reason' => $returnRow['reason'],
        'description' => $returnRow['description'],
        'status' => $returnRow['status'],
        'refundAmount' => (float)$returnRow['refund_amount'],
        'refundTxnId' => $returnRow['refund_txn_id'],
        'adminNotes' => $returnRow['admin_notes'],
        'requestedAt' => $returnRow['requested_at'],
        'refundedAt' => $returnRow['refunded_at'],
        'pickupPartnerName' => $returnRow['pickup_partner_name'],
        'pickupPartnerPhone' => $returnRow['pickup_partner_phone'],
        // The pickup OTP is only meaningful while a pickup is scheduled and
        // not yet confirmed — shown so the customer can read it out to the
        // partner collecting the damaged product.
        'pickupOtp' => ($returnRow['status'] === 'pickup_assigned' && !empty($returnRow['pickup_otp'])) ? $returnRow['pickup_otp'] : null,
        'pickedUpAt' => $returnRow['picked_up_at'],
    );
}
$returnEligible = $order['status'] === 'delivered' && (!$returnRow || $returnRow['status'] === 'rejected');

send(array(
    'orderId' => $order['id'],
    'paymentMethod' => $order['payment_method'],
    'deliveryOtp' => $deliveryOtp,
    'returnEligible' => $returnEligible,
    'returnInfo' => $returnInfo,
    'orderNumber' => $order['order_number'],
    'customerName' => $order['customer_name'],
    'items' => $items,
    'total' => (float)$order['total'],
    'status' => $order['status'],
    'paymentStatus' => $paymentStatus,
    'deliveryType' => $order['delivery_type'],
    'deliveryAddress' => $order['delivery_address'],
    'deliveryPartnerName' => isset($order['delivery_partner_name']) ? $order['delivery_partner_name'] : '',
    'deliveryPartnerPhone' => isset($order['delivery_partner_phone']) ? $order['delivery_partner_phone'] : '',
    'createdAt' => $order['created_at'],
    'expectedDeliveryDate' => $expectedDeliveryDate,
    'deliveredAt' => isset($order['delivered_at']) ? $order['delivered_at'] : null,
    'deliveryTiming' => $deliveryTiming,
    'timeline' => $timeline,
));
