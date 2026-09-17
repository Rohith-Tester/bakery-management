<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

// Everyone logged in (admin/staff/customer/supplier/delivery) can view the
// catalog — customers need it to place orders on New Order. Only admins
// can create/edit/delete listings.
if ($method !== 'GET') {
    require_admin();
}

function fmt_product($p) {
    return array(
        'id' => $p['id'],
        'name' => $p['name'],
        'sku' => $p['sku'],
        'category' => $p['category'],
        'sellingPrice' => round((float)$p['selling_price'], 2),
        'imageUrl' => isset($p['image_url']) ? $p['image_url'] : '',
        'isAvailable' => (bool)$p['is_available'],
        'recipeId' => $p['recipe_id'],
        'recipeName' => isset($p['recipe_name']) ? $p['recipe_name'] : '',
        'description' => $p['description'],
        // null = stock not tracked (no recipe linked yet, so it's always
        // orderable while marked available). Otherwise: the largest number
        // of units this product's linked recipe can currently produce from
        // real raw-material inventory levels.
        'stockQty' => isset($p['stock_qty']) ? $p['stock_qty'] : null,
        'createdAt' => $p['created_at'],
    );
}

// Given a recipe id, returns the max number of finished units that recipe
// could currently produce, limited by whichever raw ingredient runs out
// first. Returns null if the recipe has no ingredients defined yet.
function recipe_makeable_qty($pdo, $recipeId) {
    $stmt = $pdo->prepare(
        "SELECT ri.quantity, r.yield_qty, i.quantity AS have_qty FROM recipe_ingredients ri
         JOIN recipes r ON r.id = ri.recipe_id
         LEFT JOIN inventory i ON i.id = ri.item_id
         WHERE ri.recipe_id = ?"
    );
    $stmt->execute(array($recipeId));
    $rows = $stmt->fetchAll();
    if (!$rows) return null;
    $maxUnits = null;
    foreach ($rows as $row) {
        $yieldQty = (float)$row['yield_qty'] > 0 ? (float)$row['yield_qty'] : 1;
        $perUnit = (float)$row['quantity'] / $yieldQty;
        $have = $row['have_qty'] !== null ? (float)$row['have_qty'] : 0;
        $possible = $perUnit > 0 ? floor($have / $perUnit) : 0;
        $maxUnits = ($maxUnits === null) ? $possible : min($maxUnits, $possible);
    }
    return (int)$maxUnits;
}

function list_products($pdo) {
    $rows = $pdo->query(
        "SELECT p.*, r.name AS recipe_name FROM products p
         LEFT JOIN recipes r ON r.id = p.recipe_id
         ORDER BY p.name"
    )->fetchAll();
    $out = array();
    foreach ($rows as $r) {
        $r['stock_qty'] = $r['recipe_id'] ? recipe_makeable_qty($pdo, $r['recipe_id']) : null;
        $out[] = fmt_product($r);
    }
    return $out;
}

function fetch_product($pdo, $id) {
    $stmt = $pdo->prepare(
        "SELECT p.*, r.name AS recipe_name FROM products p
         LEFT JOIN recipes r ON r.id = p.recipe_id WHERE p.id = ?"
    );
    $stmt->execute(array($id));
    $row = $stmt->fetch();
    if (!$row) return null;
    $row['stock_qty'] = $row['recipe_id'] ? recipe_makeable_qty($pdo, $row['recipe_id']) : null;
    return fmt_product($row);
}

function sku_taken($pdo, $sku, $excludeId = null) {
    if ($excludeId) {
        $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND id != ?");
        $stmt->execute(array($sku, $excludeId));
    } else {
        $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ?");
        $stmt->execute(array($sku));
    }
    return (bool)$stmt->fetch();
}

// A product's photo is the "master" image (it's what customers actually
// see), so when a product is linked to a recipe that in turn is linked to
// an inventory item (i.e. that inventory row is this product's Finished
// Good), reuse the product's photo there too — but only to *fill in* a
// missing inventory photo, never to overwrite one staff already chose.
// One-way, non-destructive: Inventory's own "Choose file" still always wins.
function sync_product_image_to_inventory($pdo, $recipeId, $imageUrl) {
    if (!$recipeId || !$imageUrl) return;
    $stmt = $pdo->prepare("SELECT linked_item_id FROM recipes WHERE id = ?");
    $stmt->execute(array($recipeId));
    $recipe = $stmt->fetch();
    if (!$recipe || !$recipe['linked_item_id']) return;

    $stmt = $pdo->prepare("SELECT id, image_url FROM inventory WHERE id = ?");
    $stmt->execute(array($recipe['linked_item_id']));
    $item = $stmt->fetch();
    if (!$item) return;
    if (!empty($item['image_url'])) return; // staff already set one — don't touch it

    $pdo->prepare("UPDATE inventory SET image_url = ? WHERE id = ?")
        ->execute(array($imageUrl, $item['id']));
}

// ── GET /api/products.php[?id=...] ─────────────────────────────────────────
if ($method === 'GET' && !$id) {
    send(array('products' => list_products($pdo)));
}

if ($method === 'GET' && $id) {
    $product = fetch_product($pdo, $id);
    if (!$product) send_error('Not found', 404);
    send($product);
}

// ── POST /api/products.php ──────────────────────────────────────────────
if ($method === 'POST') {
    $body = json_body();
    $name = trim(ga($body, 'name', ''));
    if (!$name) send_error('name is required');
    $sku = trim(ga($body, 'sku', ''));
    if (!$sku) send_error('SKU is required');
    if (sku_taken($pdo, $sku)) send_error('That SKU is already in use');

    $recipeId = ga($body, 'recipeId', null);
    if ($recipeId) {
        $chk = $pdo->prepare("SELECT id FROM recipes WHERE id = ?");
        $chk->execute(array($recipeId));
        if (!$chk->fetch()) send_error('Linked recipe not found');
    }

    $newId = uuid4();
    $imageUrl = trim(ga($body, 'imageUrl', ''));
    $pdo->prepare(
        "INSERT INTO products (id, name, sku, category, selling_price, image_url, is_available, recipe_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute(array(
        $newId,
        $name,
        $sku,
        trim(ga($body, 'category', '')),
        (float)ga($body, 'sellingPrice', 0),
        $imageUrl,
        ga($body, 'isAvailable', true) ? 1 : 0,
        $recipeId ?: null,
        trim(ga($body, 'description', '')),
    ));
    sync_product_image_to_inventory($pdo, $recipeId, $imageUrl);

    send(fetch_product($pdo, $newId), 201);
}

// ── PATCH /api/products.php?id=... ──────────────────────────────────────
if ($method === 'PATCH' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);

    $body = json_body();
    $name = trim(ga($body, 'name', $existing['name']));
    if (!$name) send_error('name is required');
    $sku = trim(ga($body, 'sku', $existing['sku']));
    if (!$sku) send_error('SKU is required');
    if (sku_taken($pdo, $sku, $id)) send_error('That SKU is already in use');

    $recipeId = ga($body, 'recipeId', $existing['recipe_id']);
    if ($recipeId) {
        $chk = $pdo->prepare("SELECT id FROM recipes WHERE id = ?");
        $chk->execute(array($recipeId));
        if (!$chk->fetch()) send_error('Linked recipe not found');
    }

    $imageUrl = trim(ga($body, 'imageUrl', isset($existing['image_url']) ? $existing['image_url'] : ''));
    $pdo->prepare(
        "UPDATE products SET name=?, sku=?, category=?, selling_price=?, image_url=?, is_available=?, recipe_id=?, description=? WHERE id = ?"
    )->execute(array(
        $name,
        $sku,
        trim(ga($body, 'category', $existing['category'])),
        (float)ga($body, 'sellingPrice', $existing['selling_price']),
        $imageUrl,
        ga($body, 'isAvailable', (bool)$existing['is_available']) ? 1 : 0,
        $recipeId ?: null,
        trim(ga($body, 'description', $existing['description'])),
        $id,
    ));
    sync_product_image_to_inventory($pdo, $recipeId, $imageUrl);

    send(fetch_product($pdo, $id));
}

// ── DELETE /api/products.php?id=... ─────────────────────────────────────
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT id FROM products WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM products WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
