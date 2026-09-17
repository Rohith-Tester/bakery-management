<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

// Flat delivery charge automatically applied when a customer books home
// delivery AND pays online at checkout. Store-pickup orders and
// cash/offline orders are never charged this (offline delivery orders are
// settled in person, where the shop can collect delivery costs however it
// likes without needing it itemized here).
define('DELIVERY_CHARGE', 50.00);

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
    $invStmt = $pdo->prepare("SELECT invoice_number, status FROM invoices WHERE order_id = ? ORDER BY created_at DESC LIMIT 1");
    $invStmt->execute(array($id));
    $invRow = $invStmt->fetch();
    return array(
        'id' => $o['id'],
        'orderNumber' => $o['order_number'],
        'customerId' => $o['customer_id'],
        'userId' => $o['user_id'],
        'customerName' => $o['customer_name'],
        'customerPhone' => $o['customer_phone'],
        'customerEmail' => $o['customer_email'],
        'deliveryType' => $o['delivery_type'],
        'deliveryAddress' => $o['delivery_address'],
        'requestedDate' => $o['requested_date'],
        'notes' => $o['notes'],
        'items' => $items,
        'total' => (float)$o['total'],
        'deliveryCharge' => isset($o['delivery_charge']) ? (float)$o['delivery_charge'] : 0,
        'couponCode' => isset($o['coupon_code']) ? $o['coupon_code'] : null,
        'discountAmount' => isset($o['discount_amount']) ? (float)$o['discount_amount'] : 0,
        'status' => $o['status'],
        'paymentMethod' => $o['payment_method'],
        'paymentTxnId' => $o['payment_txn_id'],
        'paymentCardLast4' => $o['payment_card_last4'],
        'invoiceNumber' => $invRow ? $invRow['invoice_number'] : null,
        'invoiceStatus' => $invRow ? $invRow['status'] : null,
        'deliveryPartnerName' => isset($o['delivery_partner_name']) ? $o['delivery_partner_name'] : '',
        'deliveryPartnerPhone' => isset($o['delivery_partner_phone']) ? $o['delivery_partner_phone'] : '',
        'deliveryPartnerUserId' => isset($o['delivery_partner_user_id']) ? $o['delivery_partner_user_id'] : null,
        'deliveryOtpAttempts' => isset($o['delivery_otp_attempts']) ? (int)$o['delivery_otp_attempts'] : 0,
        'createdAt' => $o['created_at'],
    );
}

// ── GET /api/orders.php[?status=pending] ────────────────────────────────
// Customer accounts only ever see the orders they placed themselves —
// never anyone else's. Admin/staff see everything (optionally filtered).
if ($method === 'GET' && !$id) {
    $status = ga($_GET, 'status', null);
    $isCustomer = current_role() === 'customer';
    $isDelivery = current_role() === 'delivery';
    $where = array();
    $params = array();
    if ($status && $status !== 'all') { $where[] = 'status = ?'; $params[] = $status; }
    if ($isCustomer) { $where[] = 'user_id = ?'; $params[] = $_SESSION['user_id']; }
    if ($isDelivery) { $where[] = 'delivery_partner_user_id = ?'; $params[] = $_SESSION['user_id']; }
    $sql = 'SELECT id FROM orders' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
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
    $customerPhone = trim(ga($body, 'customerPhone', ''));
    $customerEmail = trim(ga($body, 'customerEmail', ''));
    $deliveryType = ga($body, 'deliveryType', 'pickup');
    if (!in_array($deliveryType, array('pickup', 'delivery'), true)) {
        $deliveryType = 'pickup';
    }
    $deliveryAddress = trim(ga($body, 'deliveryAddress', ''));
    $requestedDate = trim(ga($body, 'requestedDate', ''));
    if ($requestedDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $requestedDate)) {
        $requestedDate = null;
    }
    $notes = trim(ga($body, 'notes', ''));
    $couponCode = trim(ga($body, 'couponCode', ''));
    // Simulated online-payment result from the client-side "checkout" —
    // never real card data (see api/orders.php note below), just a
    // transaction reference + last 4 digits for the receipt/invoice.
    $payment = ga($body, 'payment', array());
    $paymentTxnId = $paymentMethod === 'online' ? trim(ga($payment, 'txnId', '')) : '';
    $paymentCardLast4 = $paymentMethod === 'online' ? preg_replace('/\D/', '', ga($payment, 'cardLast4', '')) : '';
    $paymentCardLast4 = substr($paymentCardLast4, -4);

    if (!$customerName || !count($items)) {
        send_error('customerName and items required');
    }
    if ($deliveryType === 'delivery' && !$deliveryAddress) {
        send_error('Delivery address is required for home delivery');
    }
    if ($paymentMethod === 'online' && !$paymentTxnId) {
        send_error('Online payment was not completed');
    }

    // Customer accounts always order for themselves, using their own
    // account contact details unless they typed something more specific.
    $userId = null;
    if (current_role() === 'customer') {
        $userId = $_SESSION['user_id'];
    }

    // ── Validate items against the Product Catalog (not raw inventory —
    //    customers order finished products, e.g. "Chocolate Cake", never
    //    raw ingredients like "Flour"). Stock availability is derived from
    //    each product's linked Recipe: if a product has a recipe, the
    //    order can't exceed how many units that recipe's ingredients can
    //    currently produce. Products with no recipe linked yet are treated
    //    as stock-untracked (always orderable while marked available). ──
    $neededByName = array();
    foreach ($items as $it) {
        $name = trim(ga($it, 'name', ''));
        $qty = (float)ga($it, 'qty', 0);
        if ($name === '' || $qty <= 0) continue;
        $neededByName[$name] = (isset($neededByName[$name]) ? $neededByName[$name] : 0) + $qty;
    }

    // Price is NEVER trusted from the client — it's recomputed here from
    // each item's real Product Catalog selling_price. This closes off the
    // obvious attack of editing the request to set an arbitrary/zero price.
    $trustedPriceByName = array();
    $productByName = array();
    foreach ($neededByName as $name => $need) {
        $prodStmt = $pdo->prepare("SELECT * FROM products WHERE name = ? AND is_available = 1");
        $prodStmt->execute(array($name));
        $prodRow = $prodStmt->fetch();
        $trustedPriceByName[$name] = $prodRow ? (float)$prodRow['selling_price'] : 0;
        $productByName[$name] = $prodRow ?: null;
    }

    foreach ($neededByName as $name => $need) {
        if (!$productByName[$name]) {
            send_error('"' . $name . '" is not a valid or available product');
        }
    }

    // Expand each product's ordered quantity into raw-ingredient demand via
    // its linked recipe (quantity per ingredient is defined per recipe
    // batch, which yields yield_qty finished units).
    $inventoryNeeded = array(); // item_id => quantity needed
    foreach ($neededByName as $name => $need) {
        $prodRow = $productByName[$name];
        if (!$prodRow || !$prodRow['recipe_id']) continue; // stock-untracked product
        $ingStmt = $pdo->prepare(
            "SELECT ri.item_id, ri.quantity, r.yield_qty FROM recipe_ingredients ri
             JOIN recipes r ON r.id = ri.recipe_id WHERE ri.recipe_id = ?"
        );
        $ingStmt->execute(array($prodRow['recipe_id']));
        foreach ($ingStmt->fetchAll() as $ing) {
            $yieldQty = (float)$ing['yield_qty'] > 0 ? (float)$ing['yield_qty'] : 1;
            $perUnit = (float)$ing['quantity'] / $yieldQty;
            $itemId = $ing['item_id'];
            $inventoryNeeded[$itemId] = (isset($inventoryNeeded[$itemId]) ? $inventoryNeeded[$itemId] : 0) + ($perUnit * $need);
        }
    }

    $total = 0;
    foreach ($items as $it) {
        $name = trim(ga($it, 'name', ''));
        $qty = (float)ga($it, 'qty', 0);
        $price = isset($trustedPriceByName[$name]) ? $trustedPriceByName[$name] : 0;
        $total += $price * $qty;
    }

    // Coupon discount applies to the items subtotal, before the delivery
    // charge is added — re-validated here from scratch (never trust a
    // discount amount computed client-side) using the exact same rules the
    // live checkout-time check in api/coupons.php used.
    $discountAmount = 0;
    $appliedCouponCode = null;
    if ($couponCode !== '') {
        $couponResult = evaluate_coupon($pdo, $couponCode, $total, $userId);
        if (!$couponResult['ok']) send_error($couponResult['error']);
        $discountAmount = $couponResult['discountAmount'];
        $appliedCouponCode = $couponResult['coupon']['code'];
        $total -= $discountAmount;
    }

    // Delivery charge applies to any home-delivery order, regardless of
    // payment method (cash/offline or online) — it's a delivery fee, not
    // a payment-method surcharge.
    $deliveryCharge = ($deliveryType === 'delivery') ? DELIVERY_CHARGE : 0.00;
    $total += $deliveryCharge;

    $countStmt = $pdo->query("SELECT COUNT(*) FROM orders");
    $orderNumber = 'ORD-' . str_pad((string)($countStmt->fetchColumn() + 1), 3, '0', STR_PAD_LEFT);

    $newId = uuid4();
    $now = date('Y-m-d H:i:s');

    $pdo->beginTransaction();
    try {
        // Lock every needed inventory row FOR UPDATE first, so concurrent
        // orders serialize on these rows instead of both reading stale
        // "available" quantities and both passing the check.
        $lockStmt = $pdo->prepare("SELECT id, name, quantity FROM inventory WHERE id = ? FOR UPDATE");
        $stockNeeded = array();
        foreach ($inventoryNeeded as $itemId => $need) {
            $lockStmt->execute(array($itemId));
            $invRow = $lockStmt->fetch();
            if (!$invRow) {
                $pdo->rollBack();
                send_error('A required ingredient no longer exists in inventory');
            }
            if ($need > (float)$invRow['quantity']) {
                $pdo->rollBack();
                send_error('Not enough "' . $invRow['name'] . '" in stock to make this order (only ' . $invRow['quantity'] . ' left)');
            }
            $stockNeeded[$invRow['id']] = $need;
        }

        $stmt = $pdo->prepare(
            "INSERT INTO orders (id, order_number, customer_id, user_id, customer_name, customer_phone, customer_email,
                                  delivery_type, delivery_address, requested_date, notes, total, delivery_charge,
                                  coupon_code, discount_amount, status,
                                  payment_method, payment_txn_id, payment_card_last4, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)"
        );
        $stmt->execute(array(
            $newId, $orderNumber, $customerId ? $customerId : null, $userId, $customerName, $customerPhone, $customerEmail,
            $deliveryType, $deliveryAddress, $requestedDate, $notes, $total, $deliveryCharge,
            $appliedCouponCode, $discountAmount,
            $paymentMethod, $paymentTxnId, $paymentCardLast4, $now,
        ));

        // Coupon redemption count is incremented inside the same transaction
        // as the order insert, so a coupon at its very last use can't be
        // double-spent by two near-simultaneous orders.
        if ($appliedCouponCode) {
            $pdo->prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?")->execute(array($appliedCouponCode));
        }

        $itemStmt = $pdo->prepare("INSERT INTO order_items (order_id, name, qty, price) VALUES (?, ?, ?, ?)");
        foreach ($items as $it) {
            $name = trim(ga($it, 'name', ''));
            if (empty($name)) continue;
            $trustedPrice = isset($trustedPriceByName[$name]) ? $trustedPriceByName[$name] : 0;
            $itemStmt->execute(array($newId, $name, (int)ga($it, 'qty', 1), $trustedPrice));
        }

        // Deduct the ordered quantities from real inventory stock.
        $deductStmt = $pdo->prepare("UPDATE inventory SET quantity = quantity - ? WHERE id = ?");
        foreach ($stockNeeded as $invId => $need) {
            $deductStmt->execute(array($need, $invId));
        }

        // Online payments are captured (simulated) at checkout time, so the
        // invoice is paid immediately; offline/cash orders stay unpaid
        // until marked delivered.
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

    notify_management($pdo, $newId, "New order {$orderNumber} from {$customerName} (₹" . number_format($total, 0) . ")");

    send(fetch_order_with_items($pdo, $newId), 201);
}

// ── PATCH /api/orders.php?id=...&action=status ──────────────────────────
// Staff/admin move an order through the full status pipeline. A delivery
// partner can only advance assigned delivery orders: ready → out_for_delivery
// when leaving the shop, then out_for_delivery → delivered on completion.
if ($method === 'PATCH' && $id && $action === 'status') {
    $role = current_role();
    if ($role !== 'admin' && $role !== 'staff' && $role !== 'delivery') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Not authorized to update order status'));
        exit;
    }
    $body = json_body();
    $status = ga($body, 'status', null);
    if (!in_array($status, array('pending', 'baking', 'ready', 'out_for_delivery', 'delivered'), true)) {
        send_error('Invalid status');
    }
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute(array($id));
    $order = $stmt->fetch();
    if (!$order) send_error('Not found', 404);

    if ($status === 'out_for_delivery' && $order['delivery_type'] !== 'delivery') {
        send_error('Out for delivery only applies to delivery orders');
    }

    if ($role === 'delivery') {
        if ($order['delivery_partner_user_id'] !== $_SESSION['user_id']) {
            send_error('This order is not assigned to you', 403);
        }
        $allowed = ($order['status'] === 'ready' && $status === 'out_for_delivery')
            || ($order['status'] === 'out_for_delivery' && $status === 'delivered');
        if (!$allowed) {
            send_error('Start delivery when the order is ready, then mark delivered when done');
        }
        // Marking an order delivered requires the OTP shown to the customer
        // on the Track Order page — same pattern as Flipkart/e-commerce
        // delivery confirmation, so a parcel can't be marked delivered
        // without actually handing it to the right person. Capped at
        // OTP_MAX_ATTEMPTS wrong guesses so the 4-digit code can't just be
        // brute-forced by whoever's holding the parcel.
        if ($status === 'delivered') {
            if ((int)$order['delivery_otp_attempts'] >= OTP_MAX_ATTEMPTS) {
                send_error('Too many incorrect attempts. Tap "Regenerate Code" to send the customer a fresh OTP.', 429);
            }
            $enteredOtp = trim(ga($body, 'otp', ''));
            if (!$enteredOtp) {
                send_error('Enter the OTP given by the customer to confirm delivery');
            }
            if (empty($order['delivery_otp']) || !hash_equals($order['delivery_otp'], $enteredOtp)) {
                $pdo->prepare("UPDATE orders SET delivery_otp_attempts = delivery_otp_attempts + 1 WHERE id = ?")->execute(array($id));
                send_error('Incorrect OTP. Please check with the customer and try again.');
            }
        }
    }

    // Admin/staff can move a delivery order through pending → baking → ready,
    // but once it's ready, only the assigned delivery partner takes it the
    // rest of the way (out_for_delivery, delivered) via the branch above.
    if (($role === 'admin' || $role === 'staff') && $order['delivery_type'] === 'delivery') {
        if ($status === 'out_for_delivery' || $status === 'delivered') {
            send_error('Only the assigned delivery partner can mark this order out for delivery or delivered');
        }
    }

    if ($status === 'delivered') {
        $pdo->prepare("UPDATE orders SET status = ?, delivered_at = NOW(), delivery_otp_verified_at = NOW() WHERE id = ?")->execute(array($status, $id));
        $pdo->prepare("UPDATE invoices SET status = 'paid' WHERE order_id = ?")->execute(array($id));
    } elseif ($status === 'out_for_delivery') {
        // Generate a fresh 4-digit OTP the moment the order leaves the shop
        // (cryptographically random — see generate_otp() in _bootstrap.php),
        // resetting the attempt counter for the new code. It's shown to the
        // customer via Track Order and must be read out to the delivery
        // partner on arrival before the order can be closed out.
        $otp = generate_otp();
        $pdo->prepare("UPDATE orders SET status = ?, delivery_otp = ?, delivery_otp_attempts = 0, delivery_otp_verified_at = NULL WHERE id = ?")->execute(array($status, $otp, $id));
    } else {
        $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?")->execute(array($status, $id));
    }

    $statusLabels = array(
        'pending' => 'received',
        'baking' => 'being baked',
        'ready' => 'ready for pickup/delivery',
        'out_for_delivery' => 'out for delivery',
        'delivered' => 'delivered',
    );
    $statusMessage = "Your order {$order['order_number']} is now " . (isset($statusLabels[$status]) ? $statusLabels[$status] : $status) . ".";
    if ($status === 'out_for_delivery') {
        $freshOtp = $pdo->prepare("SELECT delivery_otp FROM orders WHERE id = ?");
        $freshOtp->execute(array($id));
        $otpVal = $freshOtp->fetchColumn();
        if ($otpVal) {
            $statusMessage .= " Share OTP {$otpVal} with the delivery partner when your order arrives.";
        }
    }
    notify_user($pdo, $order['user_id'], $id, $statusMessage);

    send(fetch_order_with_items($pdo, $id));
}

// ── PATCH /api/orders.php?id=...&action=regenerate-otp ──────────────────
// Issues a brand-new delivery OTP for an order that's already out for
// delivery, resetting the attempt counter — the "Regenerate Code" button
// on the Confirm Delivery screen, for when the OTP got locked out after
// too many wrong guesses. Only the delivery partner assigned to the order
// can do this, and only once they've actually hit the attempt limit —
// admin/staff manage orders up to the point of dispatch, but the OTP
// itself belongs to whoever is standing at the door with the customer.
if ($method === 'PATCH' && $id && $action === 'regenerate-otp') {
    $role = current_role();
    if ($role !== 'delivery') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Only the assigned delivery partner can regenerate this OTP'));
        exit;
    }
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute(array($id));
    $order = $stmt->fetch();
    if (!$order) send_error('Not found', 404);
    if ($order['status'] !== 'out_for_delivery') {
        send_error('This order is not currently out for delivery');
    }
    if ($order['delivery_partner_user_id'] !== $_SESSION['user_id']) {
        send_error('This order is not assigned to you', 403);
    }
    if ((int)$order['delivery_otp_attempts'] < OTP_MAX_ATTEMPTS) {
        send_error('The code can only be regenerated after the maximum number of incorrect attempts has been reached');
    }

    $otp = generate_otp();
    $pdo->prepare("UPDATE orders SET delivery_otp = ?, delivery_otp_attempts = 0, delivery_otp_verified_at = NULL WHERE id = ?")
        ->execute(array($otp, $id));
    notify_user($pdo, $order['user_id'], $id, "Your delivery code for order {$order['order_number']} has been refreshed. New OTP: {$otp}. Share it with the delivery partner when your order arrives.");

    send(fetch_order_with_items($pdo, $id));
}

// ── PATCH /api/orders.php?id=...&action=delivery-partner ────────────────
// Staff/admin assign (or clear) the delivery partner handling a home
// delivery order. Preferred: pass partnerId (a 'delivery'-role account) so
// that partner can log in and update the order themselves. name/phone can
// still be set free-text as a fallback for a delivery person without an
// account. Only makes sense for deliveryType = 'delivery'.
if ($method === 'PATCH' && $id && $action === 'delivery-partner') {
    require_staff_or_admin();
    $body = json_body();
    $partnerId = ga($body, 'partnerId', null);
    $name = trim(ga($body, 'name', ''));
    $phone = trim(ga($body, 'phone', ''));

    $stmt = $pdo->prepare("SELECT id, order_number, delivery_type FROM orders WHERE id = ?");
    $stmt->execute(array($id));
    $order = $stmt->fetch();
    if (!$order) send_error('Not found', 404);
    if ($order['delivery_type'] !== 'delivery') {
        send_error('Only home-delivery orders can have a delivery partner assigned');
    }

    if ($partnerId) {
        $pstmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND role = 'delivery'");
        $pstmt->execute(array($partnerId));
        $partner = $pstmt->fetch();
        if (!$partner) send_error('Delivery partner account not found');
        $name = $partner['username'];
        $phone = $partner['phone'];
        $pdo->prepare("UPDATE orders SET delivery_partner_name = ?, delivery_partner_phone = ?, delivery_partner_user_id = ? WHERE id = ?")
            ->execute(array($name, $phone, $partnerId, $id));
        notify_user($pdo, $partnerId, $id, "You've been assigned to deliver order {$order['order_number']}.");
    } else {
        $pdo->prepare("UPDATE orders SET delivery_partner_name = ?, delivery_partner_phone = ?, delivery_partner_user_id = NULL WHERE id = ?")
            ->execute(array($name, $phone, $id));
    }
    send(fetch_order_with_items($pdo, $id));
}

// ── DELETE /api/orders.php?id=... ───────────────────────────────────────
if ($method === 'DELETE' && $id) {
    require_admin();
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    delete_order_with_billing($pdo, $id);
    send(array('success' => true));
}

send_error('Unsupported request', 405);
