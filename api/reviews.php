<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$itemName = ga($_GET, 'item', null);
$reviewableOrderId = ga($_GET, 'reviewableForOrder', null);
$reviewableItemName = ga($_GET, 'reviewableItem', null);
$role = isset($_SESSION['role']) ? $_SESSION['role'] : null;
$userId = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;

function fmt_review($r, $viewerUserId, $viewerRole) {
    return array(
        'id' => $r['id'],
        'itemName' => $r['item_name'],
        'orderId' => $r['order_id'],
        'customerName' => $r['customer_name'],
        'rating' => (int)$r['rating'],
        'comment' => $r['comment'],
        'imageUrl' => isset($r['image_url']) ? $r['image_url'] : null,
        'createdAt' => $r['created_at'],
        // Only the review's own author (to edit/delete) or an admin/staff
        // member (to moderate/remove inappropriate reviews) gets action buttons.
        'canManage' => ($viewerUserId && $r['user_id'] === $viewerUserId) || $viewerRole === 'admin' || $viewerRole === 'staff',
    );
}

// ── GET /api/reviews.php  (bulk rating summary for every reviewed item —
//     powers the small ★ badge shown on each product tile in New Order) ──
if ($method === 'GET' && !$id && !$itemName && !$reviewableOrderId && !$reviewableItemName) {
    $rows = $pdo->query(
        "SELECT item_name, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
         FROM product_reviews GROUP BY item_name"
    )->fetchAll();
    $summary = array();
    foreach ($rows as $r) {
        $summary[$r['item_name']] = array('averageRating' => (float)$r['avg_rating'], 'reviewCount' => (int)$r['review_count']);
    }
    send(array('summary' => $summary));
}

// ── GET /api/reviews.php?item=NAME  (full detail + review list for one product) ──
if ($method === 'GET' && $itemName) {
    $stmt = $pdo->prepare("SELECT * FROM product_reviews WHERE item_name = ? ORDER BY created_at DESC");
    $stmt->execute(array($itemName));
    $rows = $stmt->fetchAll();
    $reviews = array();
    $sum = 0;
    foreach ($rows as $r) { $reviews[] = fmt_review($r, $userId, $role); $sum += (int)$r['rating']; }
    $count = count($rows);
    send(array(
        'itemName' => $itemName,
        'averageRating' => $count ? round($sum / $count, 1) : 0,
        'reviewCount' => $count,
        'reviews' => $reviews,
    ));
}

// ── GET /api/reviews.php?reviewableItem=NAME  (customer: do I have a
//     delivered order containing this item that I haven't reviewed yet?
//     Powers the "Write a Review" box on the product detail panel.) ──────
if ($method === 'GET' && $reviewableItemName) {
    if ($role !== 'customer') send(array('eligibleOrderId' => null));
    $stmt = $pdo->prepare(
        "SELECT o.id, o.order_number, o.delivered_at FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.user_id = ? AND o.status = 'delivered' AND oi.name = ?
           AND NOT EXISTS (SELECT 1 FROM product_reviews pr WHERE pr.order_id = o.id AND pr.item_name = oi.name)
         ORDER BY o.delivered_at DESC LIMIT 1"
    );
    $stmt->execute(array($userId, $reviewableItemName));
    $row = $stmt->fetch();
    send(array(
        'eligibleOrderId' => $row ? $row['id'] : null,
        'eligibleOrderNumber' => $row ? $row['order_number'] : null,
    ));
}

// ── GET /api/reviews.php?reviewableForOrder=ID  (customer: which items in
//     this delivered order still need a review from them) ──────────────
if ($method === 'GET' && $reviewableOrderId) {
    if ($role !== 'customer') send_error('Only customers can review orders', 403);
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute(array($reviewableOrderId));
    $order = $stmt->fetch();
    if (!$order) send_error('Order not found', 404);
    if ($order['user_id'] !== $userId) send_error('That is not your order', 403);
    if ($order['status'] !== 'delivered') send(array('items' => array()));

    $itemsStmt = $pdo->prepare("SELECT DISTINCT name FROM order_items WHERE order_id = ?");
    $itemsStmt->execute(array($reviewableOrderId));
    $itemNames = array_column($itemsStmt->fetchAll(), 'name');

    $reviewedStmt = $pdo->prepare("SELECT item_name FROM product_reviews WHERE order_id = ? AND user_id = ?");
    $reviewedStmt->execute(array($reviewableOrderId, $userId));
    $reviewed = array_column($reviewedStmt->fetchAll(), 'item_name');

    $out = array();
    foreach ($itemNames as $name) {
        $out[] = array('itemName' => $name, 'alreadyReviewed' => in_array($name, $reviewed, true));
    }
    send(array('items' => $out));
}

// ── POST /api/reviews.php  (customer submits a review for a delivered order's item) ──
if ($method === 'POST') {
    if ($role !== 'customer') send_error('Only customers can submit reviews', 403);
    $body = json_body();
    $orderId = ga($body, 'orderId', '');
    $name = trim(ga($body, 'itemName', ''));
    $rating = (int)ga($body, 'rating', 0);
    $comment = trim(ga($body, 'comment', ''));
    $imageUrl = trim(ga($body, 'imageUrl', ''));

    if (!$orderId || !$name) send_error('orderId and itemName are required');
    if ($rating < 1 || $rating > 5) send_error('rating must be between 1 and 5');
    if (strlen($comment) > 1000) send_error('Comment is too long (max 1000 characters)');
    if ($imageUrl && strlen($imageUrl) > 4 * 1024 * 1024) send_error('Image is too large');

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute(array($orderId));
    $order = $stmt->fetch();
    if (!$order) send_error('Order not found', 404);
    if ($order['user_id'] !== $userId) send_error('That is not your order', 403);
    if ($order['status'] !== 'delivered') send_error('You can only review items after they have been delivered');

    $itemStmt = $pdo->prepare("SELECT id FROM order_items WHERE order_id = ? AND name = ?");
    $itemStmt->execute(array($orderId, $name));
    if (!$itemStmt->fetch()) send_error('That item is not part of this order');

    $dupStmt = $pdo->prepare("SELECT id FROM product_reviews WHERE order_id = ? AND item_name = ?");
    $dupStmt->execute(array($orderId, $name));
    if ($dupStmt->fetch()) send_error('You already reviewed this item for this order');

    $newId = uuid4();
    $pdo->prepare(
        "INSERT INTO product_reviews (id, item_name, order_id, user_id, customer_name, rating, comment, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute(array($newId, $name, $orderId, $userId, $order['customer_name'], $rating, $comment, $imageUrl ?: null));

    $stmt = $pdo->prepare("SELECT * FROM product_reviews WHERE id = ?");
    $stmt->execute(array($newId));
    send(fmt_review($stmt->fetch(), $userId, $role), 201);
}

// ── PATCH /api/reviews.php?id=...  (author edits their own review) ──────
if ($method === 'PATCH' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM product_reviews WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    if ($existing['user_id'] !== $userId) send_error('You can only edit your own review', 403);

    $body = json_body();
    $rating = (int)ga($body, 'rating', $existing['rating']);
    $comment = trim(ga($body, 'comment', $existing['comment']));
    $imageUrl = ga($body, 'imageUrl', $existing['image_url']);
    if ($rating < 1 || $rating > 5) send_error('rating must be between 1 and 5');
    if (strlen($comment) > 1000) send_error('Comment is too long (max 1000 characters)');

    $pdo->prepare("UPDATE product_reviews SET rating = ?, comment = ?, image_url = ? WHERE id = ?")->execute(array($rating, $comment, $imageUrl ?: null, $id));

    $stmt = $pdo->prepare("SELECT * FROM product_reviews WHERE id = ?");
    $stmt->execute(array($id));
    send(fmt_review($stmt->fetch(), $userId, $role));
}

// ── DELETE /api/reviews.php?id=...  (author, or admin/staff moderating) ──
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM product_reviews WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    if ($existing['user_id'] !== $userId && $role !== 'admin' && $role !== 'staff') send_error('Not allowed', 403);

    $pdo->prepare("DELETE FROM product_reviews WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
