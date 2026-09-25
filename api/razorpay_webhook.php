<?php
// ── POST /api/razorpay_webhook.php ──────────────────────────────────────
// Called by Razorpay's servers, not the app (set up in Razorpay Dashboard →
// Webhooks with the event "payment.captured" — see config/payment.example.php).
//
// Normally the browser reports a finished payment itself via orders.php. But
// if the customer closes the tab or loses connection right after paying,
// only Razorpay knows the money arrived. This marks the payments row 'paid'
// so it shows up as paid-without-an-order, ready to be refunded:
//   SELECT * FROM payments WHERE status = 'paid' AND order_id IS NULL;
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_razorpay.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Unsupported request', 405);
}

$raw = file_get_contents('php://input');
$signature = isset($_SERVER['HTTP_X_RAZORPAY_SIGNATURE']) ? $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] : '';
if (!razorpay_verify_webhook_signature($raw, $signature)) {
    send_error('Invalid signature', 400);
}

$event = json_decode($raw, true);
if (is_array($event) && ga($event, 'event') === 'payment.captured' && isset($event['payload']['payment']['entity'])) {
    $payment = $event['payload']['payment']['entity'];
    db()->prepare("UPDATE payments SET status = 'paid', gateway_payment_id = ? WHERE gateway_order_id = ? AND status = 'created'")
        ->execute(array(ga($payment, 'id', ''), ga($payment, 'order_id', '')));
}

send(array('ok' => true));
