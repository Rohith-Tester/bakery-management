<?php
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_razorpay.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$action = ga($_GET, 'action', null);

// ── POST /api/payments.php?action=create ────────────────────────────────
// Opens a Razorpay payment for a cart, before the order exists. Takes the
// same body as POST /api/orders.php and prices it with the same
// quote_order() the order will be saved with, so the amount charged is
// exactly the order total. Returns what Razorpay Checkout needs; the
// browser then collects the payment and sends the signed result along with
// the order to orders.php, which verifies it against the row saved here.
if ($method === 'POST' && $action === 'create') {
    if (!razorpay_configured()) {
        send_error('Online payments are not set up yet — add your Razorpay API keys to config/payment.php.', 503);
    }
    $body = json_body();
    $customerName = trim(ga($body, 'customerName', ''));
    $items = ga($body, 'items', array());
    $deliveryType = ga($body, 'deliveryType', 'pickup');
    if (!in_array($deliveryType, array('pickup', 'delivery'), true)) {
        $deliveryType = 'pickup';
    }
    $deliveryAddress = trim(ga($body, 'deliveryAddress', ''));
    $couponCode = trim(ga($body, 'couponCode', ''));

    if (!$customerName || !is_array($items) || !count($items)) {
        send_error('customerName and items required');
    }
    if ($deliveryType === 'delivery' && !$deliveryAddress) {
        send_error('Delivery address is required for home delivery');
    }

    $userId = current_role() === 'customer' ? $_SESSION['user_id'] : null;
    $quote = quote_order($pdo, $items, $couponCode, $deliveryType, $userId);
    if (!$quote['ok']) send_error($quote['error']);

    // Check stock now, not only when the order is saved, so nobody pays for
    // something that can't be made. orders.php re-checks under a row lock;
    // this is just the early version of that check.
    $stockStmt = $pdo->prepare("SELECT name, quantity FROM inventory WHERE id = ?");
    foreach ($quote['inventoryNeeded'] as $itemId => $need) {
        $stockStmt->execute(array($itemId));
        $invRow = $stockStmt->fetch();
        if (!$invRow) {
            send_error('A required ingredient no longer exists in inventory');
        }
        if ($need > (float)$invRow['quantity']) {
            send_error('Not enough "' . $invRow['name'] . '" in stock to make this order (only ' . $invRow['quantity'] . ' left)');
        }
    }

    $amountPaise = (int)round($quote['total'] * 100);
    if ($amountPaise < 100) {
        send_error('Online payments must be at least ₹1');
    }

    $paymentId = uuid4();
    try {
        $rzpOrder = razorpay_request('POST', '/orders', array(
            'amount'   => $amountPaise,
            'currency' => PAYMENT_CURRENCY,
            'receipt'  => str_replace('-', '', $paymentId),
            'notes'    => array('payment_ref' => $paymentId),
        ));
    } catch (RuntimeException $e) {
        send_error($e->getMessage(), 502);
    }

    $pdo->prepare(
        "INSERT INTO payments (id, gateway, gateway_order_id, amount_paise, currency, status, created_by)
         VALUES (?, 'razorpay', ?, ?, ?, 'created', ?)"
    )->execute(array($paymentId, $rzpOrder['id'], $amountPaise, PAYMENT_CURRENCY, $_SESSION['user_id']));

    $settings = $pdo->query("SELECT bakery_name FROM store_settings WHERE id = 1")->fetch();
    send(array(
        'keyId'           => RAZORPAY_KEY_ID,
        'razorpayOrderId' => $rzpOrder['id'],
        'amount'          => $amountPaise,
        'currency'        => PAYMENT_CURRENCY,
        'businessName'    => ($settings && $settings['bakery_name']) ? $settings['bakery_name'] : 'Golden Crust Bakery',
    ), 201);
}

send_error('Unsupported request', 405);
