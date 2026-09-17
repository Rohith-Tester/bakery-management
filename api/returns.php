<?php
// Return / Refund workflow (Flipkart-style):
//   1. Order is delivered, OTP-confirmed.
//   2. Customer says the product is damaged (or another reason) and files a
//      return ("requested"), giving bank details to receive the refund.
//   3. Staff/admin review it — approve ("approved") or reject.
//   4. Staff/admin assign a delivery partner to collect the damaged product
//      ("pickup_assigned") — this can be reassigned to a different partner
//      at any point before pickup is confirmed.
//   5. At pickup, the partner enters the OTP shown to the customer on Track
//      Order to confirm they received the product back ("picked_up") —
//      same OTP-confirmation pattern as delivery.
//   6. Staff/admin confirm the product has physically arrived back at the
//      bakery ("received") — a separate step from the delivery partner's
//      pickup confirmation, since picking it up from the customer and it
//      actually reaching the bakery aren't the same moment.
//   7. Staff/admin mark it refunded with a bank transfer reference. Refunds
//      always go out to the customer's bank account (1-3 business days),
//      whether the original order was paid online or offline.
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

$REASONS = array('damaged', 'wrong_item', 'quality_issue', 'missing_item', 'other');

// $viewerRole lets us decide whether to include the pickup OTP in the
// response: the delivery partner must be told the OTP by the customer in
// person, not read it off their own screen, so it's stripped for them.
function fetch_return($pdo, $id, $viewerRole = null) {
    $stmt = $pdo->prepare("SELECT * FROM returns WHERE id = ?");
    $stmt->execute(array($id));
    $r = $stmt->fetch();
    if (!$r) return null;
    $out = array(
        'id' => $r['id'],
        'returnNumber' => $r['return_number'],
        'orderId' => $r['order_id'],
        'orderNumber' => $r['order_number'],
        'customerId' => $r['customer_id'],
        'userId' => $r['user_id'],
        'customerName' => $r['customer_name'],
        'reason' => $r['reason'],
        'description' => $r['description'],
        'originalPaymentMethod' => $r['original_payment_method'],
        'refundAmount' => (float)$r['refund_amount'],
        'refundMethod' => $r['refund_method'],
        'bankAccountHolder' => $r['bank_account_holder'],
        'bankAccountNumber' => $r['bank_account_number'],
        'bankIfsc' => $r['bank_ifsc'],
        'bankName' => $r['bank_name'],
        'status' => $r['status'],
        'adminNotes' => $r['admin_notes'],
        'pickupPartnerName' => $r['pickup_partner_name'],
        'pickupPartnerPhone' => $r['pickup_partner_phone'],
        'pickupPartnerUserId' => $r['pickup_partner_user_id'],
        'pickedUpAt' => $r['picked_up_at'],
        'refundTxnId' => $r['refund_txn_id'],
        'processedBy' => $r['processed_by'],
        'requestedAt' => $r['requested_at'],
        'processedAt' => $r['processed_at'],
        'refundedAt' => $r['refunded_at'],
        'pickupOtpAttempts' => isset($r['pickup_otp_attempts']) ? (int)$r['pickup_otp_attempts'] : 0,
    );
    if ($viewerRole === 'admin' || $viewerRole === 'staff' || $viewerRole === 'customer') {
        $out['pickupOtp'] = $r['pickup_otp'];
    }
    $itemsStmt = $pdo->prepare("SELECT order_item_id, name, qty, price FROM return_items WHERE return_id = ?");
    $itemsStmt->execute(array($id));
    $out['items'] = array();
    foreach ($itemsStmt->fetchAll() as $it) {
        $out['items'][] = array(
            'orderItemId' => (int)$it['order_item_id'],
            'name' => $it['name'],
            'qty' => (int)$it['qty'],
            'price' => (float)$it['price'],
        );
    }
    return $out;
}

// ── GET /api/returns.php[?status=requested] ─────────────────────────────
// Staff/admin: the full management queue. Delivery partners: only the
// pickups assigned to them. Customers check their own return's status via
// Track Order (api/track.php), which already surfaces it without login.
if ($method === 'GET' && !$id) {
    $role = current_role();
    if ($role !== 'admin' && $role !== 'staff' && $role !== 'delivery') {
        send_error('Not authorized', 403);
    }
    $status = ga($_GET, 'status', null);
    $where = array();
    $params = array();
    if ($status && $status !== 'all') { $where[] = 'status = ?'; $params[] = $status; }
    if ($role === 'delivery') { $where[] = 'pickup_partner_user_id = ?'; $params[] = $_SESSION['user_id']; }
    $sql = 'SELECT id FROM returns' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY requested_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $result = array();
    foreach ($stmt->fetchAll() as $row) {
        $result[] = fetch_return($pdo, $row['id'], $role);
    }
    send($result);
}

if ($method === 'GET' && $id) {
    $role = current_role();
    $r = fetch_return($pdo, $id, $role);
    if (!$r) send_error('Not found', 404);
    if ($role !== 'admin' && $role !== 'staff') {
        $ownsAsCustomer = $role === 'customer' && !empty($_SESSION['user_id']) && $r['userId'] === $_SESSION['user_id'];
        $ownsAsPickupPartner = $role === 'delivery' && !empty($_SESSION['user_id']) && $r['pickupPartnerUserId'] === $_SESSION['user_id'];
        if (!$ownsAsCustomer && !$ownsAsPickupPartner) {
            send_error('Not authorized to view this return', 403);
        }
    }
    send($r);
}

// ── POST /api/returns.php ────────────────────────────────────────────────
// Body: { orderNumber, customerPhone? (required for guest orders), reason,
//         description, bankAccountHolder, bankAccountNumber, bankIfsc, bankName }
if ($method === 'POST') {
    $body = json_body();
    $orderNumber = trim(ga($body, 'orderNumber', ''));
    $reason = ga($body, 'reason', '');
    $description = trim(ga($body, 'description', ''));
    $bankAccountHolder = trim(ga($body, 'bankAccountHolder', ''));
    $bankAccountNumber = trim(ga($body, 'bankAccountNumber', ''));
    $bankIfsc = trim(ga($body, 'bankIfsc', ''));
    $bankName = trim(ga($body, 'bankName', ''));
    $customerPhone = trim(ga($body, 'customerPhone', ''));

    $requestedItems = ga($body, 'items', array());

    if (!$orderNumber) send_error('orderNumber required');
    if (!in_array($reason, $REASONS, true)) send_error('A valid reason is required');
    if (!is_array($requestedItems) || count($requestedItems) === 0) {
        send_error('Select at least one item to return');
    }
    if (!$bankAccountHolder || !$bankAccountNumber || !$bankIfsc) {
        send_error('Bank account holder name, account number, and IFSC code are required for the refund');
    }
    if (!preg_match('/^[A-Za-z0-9]{5,34}$/', $bankAccountNumber)) {
        send_error('Bank account number looks invalid');
    }
    if (!preg_match('/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/', $bankIfsc)) {
        send_error('IFSC code looks invalid (expected format e.g. HDFC0001234)');
    }

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE LOWER(order_number) = LOWER(?)");
    $stmt->execute(array($orderNumber));
    $order = $stmt->fetch();
    if (!$order) send_error('Order not found', 404);

    // Ownership check: a logged-in customer must own the order; a guest
    // (or anyone else) must supply the phone number on the order, same
    // trust model as Track Order already uses.
    $role = current_role();
    if ($role === 'customer') {
        if ($order['user_id'] !== $_SESSION['user_id']) {
            send_error('This order does not belong to your account', 403);
        }
    } elseif (!in_array($role, array('admin', 'staff'), true)) {
        if (!$customerPhone || !$order['customer_phone'] || strcasecmp(trim($customerPhone), trim($order['customer_phone'])) !== 0) {
            send_error('Enter the phone number used for this order to verify it\'s yours');
        }
    }

    if ($order['status'] !== 'delivered') {
        send_error('Returns can only be requested once an order has been delivered');
    }

    $existingStmt = $pdo->prepare("SELECT id FROM returns WHERE order_id = ? AND status NOT IN ('rejected')");
    $existingStmt->execute(array($order['id']));
    if ($existingStmt->fetch()) {
        send_error('A return has already been requested for this order');
    }

    // Only refund for the specific item(s)/quantity the customer actually
    // selected (e.g. one damaged product out of a two-product order) —
    // never assume the whole order is being returned.
    $orderItemsStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
    $orderItemsStmt->execute(array($order['id']));
    $orderItemsById = array();
    foreach ($orderItemsStmt->fetchAll() as $oi) {
        $orderItemsById[(int)$oi['id']] = $oi;
    }

    $selectedItems = array();
    $refundAmount = 0.0;
    $seenItemIds = array();
    foreach ($requestedItems as $reqItem) {
        $orderItemId = (int)ga($reqItem, 'orderItemId', 0);
        $qty = (int)ga($reqItem, 'qty', 0);
        if (!$orderItemId || !isset($orderItemsById[$orderItemId])) {
            send_error('One of the selected items does not belong to this order');
        }
        if (isset($seenItemIds[$orderItemId])) {
            send_error('Each item can only be selected once');
        }
        $seenItemIds[$orderItemId] = true;
        $oi = $orderItemsById[$orderItemId];
        if ($qty < 1 || $qty > (int)$oi['qty']) {
            send_error('The return quantity for "' . $oi['name'] . '" must be between 1 and ' . $oi['qty']);
        }
        $lineTotal = (float)$oi['price'] * $qty;
        $refundAmount += $lineTotal;
        $selectedItems[] = array(
            'orderItemId' => $orderItemId,
            'name' => $oi['name'],
            'qty' => $qty,
            'price' => (float)$oi['price'],
        );
    }

    $countStmt = $pdo->query("SELECT COUNT(*) FROM returns");
    $returnNumber = 'RET-' . str_pad((string)($countStmt->fetchColumn() + 1), 3, '0', STR_PAD_LEFT);
    $newId = uuid4();

    $pdo->prepare(
        "INSERT INTO returns (id, return_number, order_id, order_number, customer_id, user_id, customer_name, reason, description,
                               original_payment_method, refund_amount, refund_method,
                               bank_account_holder, bank_account_number, bank_ifsc, bank_name, status, requested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?, 'requested', NOW())"
    )->execute(array(
        $newId, $returnNumber, $order['id'], $order['order_number'], $order['customer_id'], $order['user_id'], $order['customer_name'],
        $reason, $description, $order['payment_method'], $refundAmount,
        $bankAccountHolder, $bankAccountNumber, $bankIfsc, $bankName,
    ));

    $itemInsertStmt = $pdo->prepare(
        "INSERT INTO return_items (return_id, order_item_id, name, qty, price) VALUES (?, ?, ?, ?, ?)"
    );
    foreach ($selectedItems as $si) {
        $itemInsertStmt->execute(array($newId, $si['orderItemId'], $si['name'], $si['qty'], $si['price']));
    }

    notify_management($pdo, $order['id'], "Return requested for order {$order['order_number']} (" . str_replace('_', ' ', $reason) . ")");

    send(fetch_return($pdo, $newId, $role), 201);
}

// ── PATCH /api/returns.php?id=...&action=pickup-partner ─────────────────
// Staff/admin assign (or reassign, to a different partner at any point
// before pickup is confirmed) the delivery partner who will collect the
// damaged product from the customer. Assigning generates a fresh 4-digit
// pickup OTP and (re)notifies both the partner and the customer.
if ($method === 'PATCH' && $id && $action === 'pickup-partner') {
    require_staff_or_admin();
    $body = json_body();
    $partnerId = ga($body, 'partnerId', null);
    $name = trim(ga($body, 'name', ''));
    $phone = trim(ga($body, 'phone', ''));

    $stmt = $pdo->prepare("SELECT * FROM returns WHERE id = ?");
    $stmt->execute(array($id));
    $ret = $stmt->fetch();
    if (!$ret) send_error('Not found', 404);
    if (!in_array($ret['status'], array('approved', 'pickup_assigned'), true)) {
        send_error('Approve the return before assigning a pickup partner');
    }

    if ($partnerId) {
        $pstmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role = 'delivery'");
        $pstmt->execute(array($partnerId));
        $partner = $pstmt->fetch();
        if (!$partner) send_error('Delivery partner account not found');
        $name = $partner['username'];
        $phone = $partner['phone'];
    } elseif (!$name) {
        send_error('Select a delivery partner or enter a name');
    }

    $otp = generate_otp();
    $pdo->prepare(
        "UPDATE returns SET status='pickup_assigned', pickup_partner_name=?, pickup_partner_phone=?, pickup_partner_user_id=?,
                             pickup_otp=?, pickup_otp_attempts=0, pickup_otp_verified_at=NULL, picked_up_at=NULL WHERE id=?"
    )->execute(array($name, $phone, $partnerId ? $partnerId : null, $otp, $id));

    if ($partnerId) {
        notify_user($pdo, $partnerId, $ret['order_id'], "You've been assigned to pick up a damaged-product return for order {$ret['order_number']}.");
    }
    notify_user($pdo, $ret['user_id'], $ret['order_id'], "A pickup has been arranged for your return {$ret['return_number']}. Share the OTP shown on Track Order with {$name} when they arrive.");

    send(fetch_return($pdo, $id, 'admin'));
}

// ── PATCH /api/returns.php?id=...&action=status ──────────────────────────
// requested -> approved -> pickup_assigned (via action=pickup-partner above)
// -> picked_up (delivery partner, OTP-verified) -> received (staff/admin,
// confirms it's physically back at the bakery) -> refunded (staff/admin).
// requested/approved/pickup_assigned -> rejected (staff/admin).
// Body: { status, adminNotes?, refundTxnId?, otp? }
if ($method === 'PATCH' && $id && $action === 'status') {
    $role = current_role();
    $body = json_body();
    $status = ga($body, 'status', null);
    if (!in_array($status, array('approved', 'rejected', 'picked_up', 'received', 'refunded'), true)) {
        send_error('Invalid status');
    }
    $stmt = $pdo->prepare("SELECT * FROM returns WHERE id = ?");
    $stmt->execute(array($id));
    $ret = $stmt->fetch();
    if (!$ret) send_error('Not found', 404);

    if ($status === 'picked_up') {
        // Only the assigned pickup partner can confirm pickup, and only
        // with the OTP the customer reads out to them — mirrors delivery
        // OTP confirmation exactly.
        if ($role !== 'delivery') send_error('Only the assigned delivery partner can confirm pickup', 403);
        if ($ret['pickup_partner_user_id'] !== $_SESSION['user_id']) send_error('This pickup is not assigned to you', 403);
        if ($ret['status'] !== 'pickup_assigned') send_error('This return is not ready for pickup yet');
        if ((int)$ret['pickup_otp_attempts'] >= OTP_MAX_ATTEMPTS) {
            send_error('Too many incorrect attempts. Tap "Regenerate Code" to send the customer a fresh OTP.', 429);
        }
        $enteredOtp = trim(ga($body, 'otp', ''));
        if (!$enteredOtp) send_error('Enter the OTP given by the customer to confirm pickup');
        if (empty($ret['pickup_otp']) || !hash_equals($ret['pickup_otp'], $enteredOtp)) {
            $pdo->prepare("UPDATE returns SET pickup_otp_attempts = pickup_otp_attempts + 1 WHERE id = ?")->execute(array($id));
            send_error('Incorrect OTP. Please check with the customer and try again.');
        }
        $pdo->prepare("UPDATE returns SET status='picked_up', pickup_otp_verified_at=NOW(), picked_up_at=NOW() WHERE id=?")
            ->execute(array($id));
        notify_management($pdo, $ret['order_id'], "Damaged product for return {$ret['return_number']} (order {$ret['order_number']}) has been picked up.");
        notify_user($pdo, $ret['user_id'], $ret['order_id'], "Your returned product for {$ret['return_number']} has been picked up and is on its way back to us. We'll confirm once it arrives, then process your refund.");
        send(fetch_return($pdo, $id, $role));
    }

    require_staff_or_admin();
    $adminNotes = trim(ga($body, 'adminNotes', $ret['admin_notes']));
    $processedBy = isset($_SESSION['username']) ? $_SESSION['username'] : '';

    if ($status === 'approved') {
        if ($ret['status'] !== 'requested') send_error('Only a newly requested return can be approved');
        $pdo->prepare("UPDATE returns SET status='approved', admin_notes=?, processed_by=?, processed_at=NOW() WHERE id=?")
            ->execute(array($adminNotes, $processedBy, $id));
    } elseif ($status === 'rejected') {
        if (in_array($ret['status'], array('picked_up', 'received', 'refunded'), true)) send_error('This return has already progressed too far to reject');
        $pdo->prepare("UPDATE returns SET status='rejected', admin_notes=?, processed_by=?, processed_at=NOW() WHERE id=?")
            ->execute(array($adminNotes, $processedBy, $id));
    } elseif ($status === 'received') {
        // Confirms the item has physically arrived back at the bakery —
        // separate from the delivery partner's OTP pickup confirmation,
        // and a prerequisite for issuing the refund.
        if ($ret['status'] !== 'picked_up') send_error('The delivery partner must confirm pickup before the product can be marked received');
        $pdo->prepare("UPDATE returns SET status='received', admin_notes=?, processed_by=?, processed_at=NOW() WHERE id=?")
            ->execute(array($adminNotes, $processedBy, $id));
    } elseif ($status === 'refunded') {
        if ($ret['status'] !== 'received') send_error('The product must be marked received before the refund can be sent');
        $refundTxnId = trim(ga($body, 'refundTxnId', ''));
        if (!$refundTxnId) send_error('Enter the bank transfer reference to confirm the refund');
        $pdo->prepare("UPDATE returns SET status='refunded', admin_notes=?, processed_by=?, refund_txn_id=?, processed_at=NOW(), refunded_at=NOW() WHERE id=?")
            ->execute(array($adminNotes, $processedBy, $refundTxnId, $id));
    }

    notify_user($pdo, $ret['user_id'], $ret['order_id'], "Your return {$ret['return_number']} for order {$ret['order_number']} is now " . str_replace('_', ' ', $status) . ($status === 'refunded' ? " — ₹" . number_format($ret['refund_amount'], 0) . " sent to your bank account." : "."));

    send(fetch_return($pdo, $id, $role));
}

// ── PATCH /api/returns.php?id=...&action=regenerate-otp ──────────────────
// Issues a brand-new pickup OTP for a return that's already pickup_assigned,
// resetting the attempt counter. Only the assigned pickup partner can do
// this, and only once they've hit the attempt limit — mirrors the same
// restriction on orders.php's regenerate-otp.
if ($method === 'PATCH' && $id && $action === 'regenerate-otp') {
    $role = current_role();
    if ($role !== 'delivery') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Only the assigned pickup partner can regenerate this OTP'));
        exit;
    }
    $stmt = $pdo->prepare("SELECT * FROM returns WHERE id = ?");
    $stmt->execute(array($id));
    $ret = $stmt->fetch();
    if (!$ret) send_error('Not found', 404);
    if ($ret['status'] !== 'pickup_assigned') {
        send_error('This return does not currently have a pickup in progress');
    }
    if ($ret['pickup_partner_user_id'] !== $_SESSION['user_id']) {
        send_error('This pickup is not assigned to you', 403);
    }
    if ((int)$ret['pickup_otp_attempts'] < OTP_MAX_ATTEMPTS) {
        send_error('The code can only be regenerated after the maximum number of incorrect attempts has been reached');
    }

    $otp = generate_otp();
    $pdo->prepare("UPDATE returns SET pickup_otp = ?, pickup_otp_attempts = 0, pickup_otp_verified_at = NULL WHERE id = ?")
        ->execute(array($otp, $id));
    notify_user($pdo, $ret['user_id'], $ret['order_id'], "Your pickup code for return {$ret['return_number']} has been refreshed. New OTP: {$otp}. Share it with the pickup partner when they arrive.");

    send(fetch_return($pdo, $id, $role));
}

send_error('Unsupported request', 405);
