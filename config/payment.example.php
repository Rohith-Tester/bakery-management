<?php
/**
 * Razorpay payment gateway settings.
 *
 * Copy this file to config/payment.php (git-ignored, so real keys never get
 * committed) and fill in your keys from Razorpay Dashboard → Account &
 * Settings → API Keys. Use the rzp_test_… keys while testing — no real
 * money moves — and swap in the rzp_live_… keys once Razorpay has
 * activated your account.
 */
define('RAZORPAY_KEY_ID', '');
define('RAZORPAY_KEY_SECRET', '');

// Dashboard → Account & Settings → Webhooks → Add New Webhook:
//   URL:    https://<your-domain>/bakery_php/api/razorpay_webhook.php
//   Event:  payment.captured
//   Secret: any long random string — paste the same one here.
// Optional on localhost (Razorpay can't reach it), but set it up in
// production so a customer who pays and then closes the tab is still
// recorded — see api/razorpay_webhook.php.
define('RAZORPAY_WEBHOOK_SECRET', '');

// XAMPP's PHP has no CA certificate bundle, so HTTPS calls to Razorpay fail
// with "SSL certificate problem". Put https://curl.se/ca/cacert.pem at this
// path (or set curl.cainfo in php.ini instead). Ignored if the file is
// missing, e.g. on Linux hosting where the system bundle already works.
define('RAZORPAY_CA_BUNDLE', __DIR__ . '/cacert.pem');
