<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

// Reading recipes (the method for each baked good) is useful to anyone who
// bakes, so any staff/admin account can view them. Only admins can
// create/edit/delete recipes.
require_staff_or_admin();
if ($method !== 'GET') {
    require_admin();
}

// Suggested retail price for the finished batch — same "cost + healthy
// bakery margin" formula used for inventory items (fmt_item in
// inventory.php), so the two stay consistent.
function suggested_price($cost) {
    return $cost > 0 ? max(10, round(($cost * 2.6) / 5) * 5) : 0;
}

// Turns a recipe name into a unique, URL/SKU-safe code, e.g.
// "Chicken Biriyani" -> "CHICKEN-BIRIYANI", disambiguated with -2, -3... if
// that base is already taken by another product.
function unique_product_sku($pdo, $name) {
    $base = strtoupper(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $name), '-'));
    if ($base === '') $base = 'ITEM';
    $sku = $base;
    $n = 2;
    $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ?");
    while (true) {
        $stmt->execute(array($sku));
        if (!$stmt->fetch()) return $sku;
        $sku = $base . '-' . $n;
        $n++;
    }
}

// Every recipe is a sellable item once it's saved, so a matching Product
// Catalog entry (linked back via recipe_id) is created alongside it —
// same name/category, priced at the recipe's suggested price, available by
// default. Staff can still edit price/availability/description afterward;
// this just removes the extra manual step of re-entering the same recipe
// as a product by hand every time.
function create_linked_product($pdo, $recipeId, $name, $category, $costPerUnit) {
    $sku = unique_product_sku($pdo, $name);
    $productId = uuid4();
    $pdo->prepare(
        "INSERT INTO products (id, name, sku, category, selling_price, image_url, is_available, recipe_id, description)
         VALUES (?, ?, ?, ?, ?, '', 1, ?, '')"
    )->execute(array(
        $productId, $name, $sku, $category, suggested_price($costPerUnit), $recipeId,
    ));
    return $productId;
}


function fmt_recipe($r) {
    $costPerBatch = isset($r['cost_per_batch']) ? (float)$r['cost_per_batch'] : 0;
    $yieldQty = (float)$r['yield_qty'] > 0 ? (float)$r['yield_qty'] : 1;
    $costPerUnit = $costPerBatch / $yieldQty;
    return array(
        'id' => $r['id'],
        'name' => $r['name'],
        'category' => $r['category'],
        'linkedItemId' => $r['linked_item_id'],
        'linkedItemName' => isset($r['linked_item_name']) ? $r['linked_item_name'] : '',
        'yieldQty' => $yieldQty,
        'yieldUnit' => $r['yield_unit'],
        'prepTimeMinutes' => (int)$r['prep_time_minutes'],
        'bakeTimeMinutes' => (int)$r['bake_time_minutes'],
        'instructions' => $r['instructions'],
        'notes' => $r['notes'],
        'imageUrl' => isset($r['image_url']) ? $r['image_url'] : '',
        'ingredientCount' => isset($r['ingredient_count']) ? (int)$r['ingredient_count'] : 0,
        'costPerBatch' => round($costPerBatch, 2),
        'costPerUnit' => round($costPerUnit, 2),
        'suggestedPrice' => suggested_price($costPerUnit),
        'createdAt' => $r['created_at'],
    );
}

function fetch_recipe_with_ingredients($pdo, $id) {
    $stmt = $pdo->prepare(
        "SELECT r.*, li.name AS linked_item_name FROM recipes r
         LEFT JOIN inventory li ON li.id = r.linked_item_id WHERE r.id = ?"
    );
    $stmt->execute(array($id));
    $recipe = $stmt->fetch();
    if (!$recipe) return null;

    $ingStmt = $pdo->prepare(
        "SELECT ri.*, i.cost_per_unit AS live_cost FROM recipe_ingredients ri
         LEFT JOIN inventory i ON i.id = ri.item_id WHERE ri.recipe_id = ? ORDER BY ri.id"
    );
    $ingStmt->execute(array($id));
    $ingredients = array();
    $costPerBatch = 0;
    foreach ($ingStmt->fetchAll() as $r) {
        $qty = (float)$r['quantity'];
        $costPerUnit = $r['live_cost'] !== null ? (float)$r['live_cost'] : 0;
        $lineCost = $qty * $costPerUnit;
        $costPerBatch += $lineCost;
        $ingredients[] = array(
            'id' => (int)$r['id'],
            'itemId' => $r['item_id'],
            'name' => $r['item_name'],
            'quantity' => $qty,
            'unit' => $r['unit'],
            'costPerUnit' => $costPerUnit,
            'lineCost' => round($lineCost, 2),
        );
    }

    $recipe['cost_per_batch'] = $costPerBatch;
    $out = fmt_recipe($recipe);
    $out['ingredients'] = $ingredients;
    return $out;
}

// Recomputes and returns cost_per_batch for the recipe list view (one query
// per recipe would be slow-ish at scale, but this app's data sizes are
// small — a single joined aggregate query keeps it simple and correct).
function list_recipes($pdo) {
    $rows = $pdo->query(
        "SELECT r.*, li.name AS linked_item_name,
                (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count,
                (SELECT COALESCE(SUM(ri.quantity * COALESCE(i.cost_per_unit, 0)), 0)
                   FROM recipe_ingredients ri LEFT JOIN inventory i ON i.id = ri.item_id
                  WHERE ri.recipe_id = r.id) AS cost_per_batch
         FROM recipes r
         LEFT JOIN inventory li ON li.id = r.linked_item_id
         ORDER BY r.name"
    )->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_recipe($r);
    return $out;
}

function clean_ingredients($items) {
    $clean = array();
    foreach ($items as $it) {
        $name = trim(ga($it, 'name', ''));
        $qty = (float)ga($it, 'quantity', 0);
        if ($name === '' || $qty <= 0) continue;
        $itemId = ga($it, 'itemId', null);
        $unit = trim(ga($it, 'unit', ''));
        $clean[] = array('itemId' => $itemId ?: null, 'name' => $name, 'quantity' => $qty, 'unit' => $unit);
    }
    return $clean;
}

// ── GET /api/recipes.php[?id=...] ────────────────────────────────────────
if ($method === 'GET' && !$id) {
    send(array('recipes' => list_recipes($pdo)));
}

if ($method === 'GET' && $id) {
    $recipe = fetch_recipe_with_ingredients($pdo, $id);
    if (!$recipe) send_error('Not found', 404);
    send($recipe);
}

// ── POST /api/recipes.php ────────────────────────────────────────────────
if ($method === 'POST') {
    $body = json_body();
    $name = trim(ga($body, 'name', ''));
    if (!$name) send_error('name is required');
    $ingredients = clean_ingredients(ga($body, 'ingredients', array()));
    if (!count($ingredients)) send_error('Add at least one ingredient with a quantity');

    $linkedItemId = ga($body, 'linkedItemId', null);
    if ($linkedItemId) {
        $chk = $pdo->prepare("SELECT id FROM inventory WHERE id = ?");
        $chk->execute(array($linkedItemId));
        if (!$chk->fetch()) send_error('Linked inventory item not found');
    }

    $newId = uuid4();
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "INSERT INTO recipes (id, name, category, linked_item_id, yield_qty, yield_unit, prep_time_minutes, bake_time_minutes, instructions, notes, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute(array(
            $newId,
            $name,
            trim(ga($body, 'category', '')),
            $linkedItemId ?: null,
            (float)ga($body, 'yieldQty', 1) ?: 1,
            trim(ga($body, 'yieldUnit', '')) ?: 'batch',
            (int)ga($body, 'prepTimeMinutes', 0),
            (int)ga($body, 'bakeTimeMinutes', 0),
            trim(ga($body, 'instructions', '')),
            trim(ga($body, 'notes', '')),
            trim(ga($body, 'imageUrl', '')),
        ));
        $ingStmt = $pdo->prepare(
            "INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit) VALUES (?, ?, ?, ?, ?)"
        );
        foreach ($ingredients as $it) {
            $ingStmt->execute(array($newId, $it['itemId'], $it['name'], $it['quantity'], $it['unit']));
        }

        // Compute this recipe's cost/unit right now (same math as
        // fetch_recipe_with_ingredients) so the auto-created product's
        // price is seeded sensibly instead of ₹0.
        $costPerBatch = 0;
        foreach ($ingredients as $it) {
            if (!$it['itemId']) continue;
            $costStmt = $pdo->prepare("SELECT cost_per_unit FROM inventory WHERE id = ?");
            $costStmt->execute(array($it['itemId']));
            $unitCost = $costStmt->fetchColumn();
            $costPerBatch += $it['quantity'] * ($unitCost !== false ? (float)$unitCost : 0);
        }
        $yieldQty = (float)ga($body, 'yieldQty', 1) ?: 1;
        create_linked_product($pdo, $newId, $name, trim(ga($body, 'category', '')), $costPerBatch / $yieldQty);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to create recipe: ' . $e->getMessage(), 500);
    }

    send(fetch_recipe_with_ingredients($pdo, $newId), 201);
}

// ── PATCH /api/recipes.php?id=... ────────────────────────────────────────
if ($method === 'PATCH' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM recipes WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);

    $body = json_body();
    $name = trim(ga($body, 'name', $existing['name']));
    if (!$name) send_error('name is required');

    $linkedItemId = ga($body, 'linkedItemId', $existing['linked_item_id']);
    if ($linkedItemId) {
        $chk = $pdo->prepare("SELECT id FROM inventory WHERE id = ?");
        $chk->execute(array($linkedItemId));
        if (!$chk->fetch()) send_error('Linked inventory item not found');
    }

    $ingredientsRaw = ga($body, 'ingredients', null);
    $ingredients = null;
    if (is_array($ingredientsRaw)) {
        $ingredients = clean_ingredients($ingredientsRaw);
        if (!count($ingredients)) send_error('Add at least one ingredient with a quantity');
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE recipes SET name=?, category=?, linked_item_id=?, yield_qty=?, yield_unit=?, prep_time_minutes=?, bake_time_minutes=?, instructions=?, notes=?, image_url=? WHERE id = ?"
        )->execute(array(
            $name,
            trim(ga($body, 'category', $existing['category'])),
            $linkedItemId ?: null,
            (float)ga($body, 'yieldQty', $existing['yield_qty']) ?: 1,
            trim(ga($body, 'yieldUnit', $existing['yield_unit'])) ?: 'batch',
            (int)ga($body, 'prepTimeMinutes', $existing['prep_time_minutes']),
            (int)ga($body, 'bakeTimeMinutes', $existing['bake_time_minutes']),
            trim(ga($body, 'instructions', $existing['instructions'])),
            trim(ga($body, 'notes', $existing['notes'])),
            trim(ga($body, 'imageUrl', isset($existing['image_url']) ? $existing['image_url'] : '')),
            $id,
        ));

        if ($ingredients !== null) {
            $pdo->prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?")->execute(array($id));
            $ingStmt = $pdo->prepare(
                "INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit) VALUES (?, ?, ?, ?, ?)"
            );
            foreach ($ingredients as $it) {
                $ingStmt->execute(array($id, $it['itemId'], $it['name'], $it['quantity'], $it['unit']));
            }
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to update recipe: ' . $e->getMessage(), 500);
    }

    send(fetch_recipe_with_ingredients($pdo, $id));
}

// ── DELETE /api/recipes.php?id=... ───────────────────────────────────────
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT id FROM recipes WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM recipes WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
