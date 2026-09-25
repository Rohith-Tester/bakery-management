<?php
/**
 * Razorpay payment gateway helpers — plain cURL against Razorpay's REST API,
 * so there's no Composer/SDK to install (same no-build-step approach as the
 * rest of the app). Keys live in config/payment.php.
 *
 * How an online payment flows:
 *   1. api/payments.php prices the cart server-side and opens a Razorpay
 *      order for exactly that amount (a `payments` row, status 'created').
 *   2. The browser runs Razorpay Checkout (UPI / card / netbanking /
 *      wallet) — card and bank details go straight to Razorpay, never here.
 *   3. api/orders.php checks Razorpay's signature on the result before it
 *      saves the order and marks the invoice paid (status 'completed').
 *   4. api/razorpay_webhook.php marks the row 'paid' if Razorpay reports the
 *      capture itself, so a payment is never lost if the tab is closed.
 */
if (file_exists(__DIR__ . '/../config/payment.php')) {
    require_once __DIR__ . '/../config/payment.php';
}
if (!defined('RAZORPAY_KEY_ID')) define('RAZORPAY_KEY_ID', '');
if (!defined('RAZORPAY_KEY_SECRET')) define('RAZORPAY_KEY_SECRET', '');
if (!defined('RAZORPAY_WEBHOOK_SECRET')) define('RAZORPAY_WEBHOOK_SECRET', '');
if (!defined('RAZORPAY_CA_BUNDLE')) define('RAZORPAY_CA_BUNDLE', __DIR__ . '/../config/cacert.pem');

define('RAZORPAY_API_BASE', 'https://api.razorpay.com/v1');
define('PAYMENT_CURRENCY', 'INR');

function razorpay_configured() {
    return RAZORPAY_KEY_ID !== '' && RAZORPAY_KEY_SECRET !== '';
}

/** Calls the Razorpay REST API and returns the decoded JSON body. Throws a
 *  RuntimeException with a readable message on network or API errors. */
function razorpay_request($method, $path, $body = null) {
    $opts = array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_USERPWD        => RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT        => 45,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    );
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($body);
        $opts[CURLOPT_HTTPHEADER] = array('Content-Type: application/json');
    }
    if (RAZORPAY_CA_BUNDLE && file_exists(RAZORPAY_CA_BUNDLE)) {
        $opts[CURLOPT_CAINFO] = RAZORPAY_CA_BUNDLE;
    }

    $ch = curl_init(RAZORPAY_API_BASE . $path);
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        curl_close($ch);
        // 51 = peer failed verification, 60 = no/untrusted CA, 77 = bad CA file
        if (in_array($errno, array(51, 60, 77), true)) {
            throw new RuntimeException('Could not verify Razorpay\'s SSL certificate (' . $error . '). Save https://curl.se/ca/cacert.pem as config/cacert.pem.');
        }
        throw new RuntimeException('Could not reach Razorpay: ' . $error);
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($raw, true);
    if ($status >= 400 || !is_array($data)) {
        $reason = (is_array($data) && isset($data['error']['description'])) ? $data['error']['description'] : ('HTTP ' . $status);
        throw new RuntimeException('Razorpay: ' . $reason);
    }
    return $data;
}

/** True if Razorpay Checkout's signature proves this payment belongs to this
 *  order — i.e. Razorpay, not the browser, says it was paid. */
function razorpay_verify_payment_signature($orderId, $paymentId, $signature) {
    $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, RAZORPAY_KEY_SECRET);
    return is_string($signature) && hash_equals($expected, $signature);
}

/** True if a webhook body really came from Razorpay. */
function razorpay_verify_webhook_signature($rawBody, $signature) {
    if (RAZORPAY_WEBHOOK_SECRET === '') return false;
    $expected = hash_hmac('sha256', $rawBody, RAZORPAY_WEBHOOK_SECRET);
    return is_string($signature) && hash_equals($expected, $signature);
}

/** Fetches a payment (with its card details, for the receipt) and captures
 *  it if the Razorpay account is set to manual capture — an uncaptured
 *  payment is only "authorized" and Razorpay refunds it after a few days. */
function razorpay_fetch_and_capture($paymentId, $amountPaise, $currency) {
    $path = '/payments/' . rawurlencode($paymentId);
    $payment = razorpay_request('GET', $path . '?expand%5B%5D=card');
    if ($payment['status'] === 'authorized') {
        try {
            razorpay_request('POST', $path . '/capture', array('amount' => $amountPaise, 'currency' => $currency));
        } catch (RuntimeException $e) {
            // Razorpay's own auto-capture may have got there first.
            $again = razorpay_request('GET', $path);
            if ($again['status'] !== 'captured') throw $e;
        }
        $payment['status'] = 'captured';
    }
    return $payment;
}
