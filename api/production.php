<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

// Viewing the production schedule and moving a batch through its
// planned -> in_progress -> completed lifecycle is staff/admin work (the
// bakers running the batches). Creating, editing, or deleting the schedule
// itself is admin-only, same tier as Purchase Orders.
require_staff_or_admin();

function fmt_batch($r) {
    return array(
        'id' => $r['id'],
        'batchNumber' => $r['batch_number'],
        'recipeId' => $r['recipe_id'],
        'recipeName' => $r['recipe_name'],
        'multiplier' => (float)$r['multiplier'],
        'outputItemId' => $r['output_item_id'],
        'outputItemName' => $r['output_item_name'],
        'plannedQty' => (float)$r['planned_qty'],
        'yieldUnit' => $r['yield_unit'],
        'status' => $r['status'],
        'scheduledDate' => $r['scheduled_date'],
        'notes' => $r['notes'],
        'totalCost' => (float)$r['total_cost'],
        'createdBy' => $r['created_by'],
        'ingredientCount' => isset($r['ingredient_count']) ? (int)$r['ingredient_count'] : 0,
        'startedAt' => $r['started_at'],
        'completedAt' => $r['completed_at'],
        'createdAt' => $r['created_at'],
    );
}

function fetch_batch_with_ingredients($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM production_batches WHERE id = ?");
    $stmt->execute(array($id));
    $batch = $stmt->fetch();
    if (!$batch) return null;
    $itemsStmt = $pdo->prepare("SELECT * FROM production_batch_ingredients WHERE batch_id = ? ORDER BY id");
    $itemsStmt->execute(array($id));
    $ingredients = array();
    foreach ($itemsStmt->fetchAll() as $r) {
        $ingredients[] = array(
            'id' => (int)$r['id'],
            'itemId' => $r['item_id'],
            'name' => $r['item_name'],
            'quantity' => (float)$r['quantity'],
            'unit' => $r['unit'],
            'costPerUnit' => (float)$r['cost_per_unit'],
            'totalCost' => (float)$r['total_cost'],
        );
    }
    $out = fmt_batch($batch);
    $out['ingredients'] = $ingredients;
    return $out;
}

// ── GET /api/production.php[?id=...] ─────────────────────────────────────
if ($method === 'GET' && !$id) {
    $status = ga($_GET, 'status', null);
    $where = '';
    $params = array();
    if ($status && $status !== 'all') { $where = ' WHERE b.status = ?'; $params[] = $status; }
    $stmt = $pdo->prepare(
        "SELECT b.*, (SELECT COUNT(*) FROM production_batch_ingredients i WHERE i.batch_id = b.id) AS ingredient_count
         FROM production_batches b" . $where . " ORDER BY b.created_at DESC"
    );
    $stmt->execute($params);
    $out = array();
    foreach ($stmt->fetchAll() as $r) $out[] = fmt_batch($r);

    $activeCount = (int) $pdo->query(
        "SELECT COUNT(*) FROM production_batches WHERE status IN ('planned','in_progress')"
    )->fetchColumn();
    $completedCost = (float) $pdo->query(
        "SELECT COALESCE(SUM(total_cost),0) FROM production_batches WHERE status = 'completed'"
    )->fetchColumn();
    $completedToday = (int) $pdo->query(
        "SELECT COUNT(*) FROM production_batches WHERE status = 'completed' AND DATE(completed_at) = CURDATE()"
    )->fetchColumn();

    send(array(
        'batches' => $out,
        'activeCount' => $activeCount,
        'completedCost' => $completedCost,
        'completedToday' => $completedToday,
    ));
}

if ($method === 'GET' && $id) {
    $batch = fetch_batch_with_ingredients($pdo, $id);
    if (!$batch) send_error('Not found', 404);
    send($batch);
}

// ── POST /api/production.php ──────────────────────────────────────────
// Schedules a new batch: pick a recipe + how many times to multiply its
// yield. The recipe's ingredients (and their *current* inventory cost) are
// snapshotted onto the batch now, so editing the recipe later never
// silently rewrites a batch that's already scheduled or in progress.
if ($method === 'POST') {
    require_admin();
    $body = json_body();
    $recipeId = ga($body, 'recipeId', null);
    if (!$recipeId) send_error('recipeId is required');
    $multiplier = (float)ga($body, 'multiplier', 1);
    if ($multiplier <= 0) $multiplier = 1;

    $rStmt = $pdo->prepare("SELECT * FROM recipes WHERE id = ?");
    $rStmt->execute(array($recipeId));
    $recipe = $rStmt->fetch();
    if (!$recipe) send_error('Recipe not found');

    $ingStmt = $pdo->prepare(
        "SELECT ri.*, i.cost_per_unit AS live_cost FROM recipe_ingredients ri
         LEFT JOIN inventory i ON i.id = ri.item_id WHERE ri.recipe_id = ?"
    );
    $ingStmt->execute(array($recipeId));
    $recipeIngredients = $ingStmt->fetchAll();
    if (!count($recipeIngredients)) send_error('This recipe has no ingredients to schedule');

    $outputItemId = ga($body, 'outputItemId', null);
    if (!$outputItemId) $outputItemId = $recipe['linked_item_id'];
    $outputItemName = '';
    if ($outputItemId) {
        $oStmt = $pdo->prepare("SELECT name FROM inventory WHERE id = ?");
        $oStmt->execute(array($outputItemId));
        $oRow = $oStmt->fetch();
        if (!$oRow) send_error('Selected output item not found');
        $outputItemName = $oRow['name'];
    }

    $scheduledDate = trim(ga($body, 'scheduledDate', ''));
    if ($scheduledDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $scheduledDate)) {
        $scheduledDate = null;
    }
    $notes = trim(ga($body, 'notes', ''));

    $totalCost = 0;
    $batchIngredients = array();
    foreach ($recipeIngredients as $ri) {
        $qty = (float)$ri['quantity'] * $multiplier;
        $costPerUnit = $ri['live_cost'] !== null ? (float)$ri['live_cost'] : 0;
        $lineCost = $qty * $costPerUnit;
        $totalCost += $lineCost;
        $batchIngredients[] = array(
            'itemId' => $ri['item_id'], 'name' => $ri['item_name'], 'quantity' => $qty,
            'unit' => $ri['unit'], 'costPerUnit' => $costPerUnit, 'totalCost' => $lineCost,
        );
    }

    $plannedQty = (float)$recipe['yield_qty'] * $multiplier;

    $countStmt = $pdo->query("SELECT COUNT(*) FROM production_batches");
    $batchNumber = 'PB-' . str_pad((string)($countStmt->fetchColumn() + 1), 3, '0', STR_PAD_LEFT);
    $newId = uuid4();

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "INSERT INTO production_batches (id, batch_number, recipe_id, recipe_name, multiplier, output_item_id, output_item_name, planned_qty, yield_unit, status, scheduled_date, notes, total_cost, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?)"
        )->execute(array(
            $newId, $batchNumber, $recipeId, $recipe['name'], $multiplier, $outputItemId ?: null, $outputItemName,
            $plannedQty, $recipe['yield_unit'], $scheduledDate, $notes, $totalCost,
            isset($_SESSION['username']) ? $_SESSION['username'] : '',
        ));
        $itemStmt = $pdo->prepare(
            "INSERT INTO production_batch_ingredients (batch_id, item_id, item_name, quantity, unit, cost_per_unit, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        foreach ($batchIngredients as $it) {
            $itemStmt->execute(array($newId, $it['itemId'], $it['name'], $it['quantity'], $it['unit'], $it['costPerUnit'], $it['totalCost']));
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to schedule batch: ' . $e->getMessage(), 500);
    }

    notify_management($pdo, null, "New production batch {$batchNumber} scheduled ({$recipe['name']} ×{$multiplier})");

    send(fetch_batch_with_ingredients($pdo, $newId), 201);
}

// ── PATCH /api/production.php?id=...  (edit while still planned) ────────
if ($method === 'PATCH' && $id && !$action) {
    require_admin();
    $stmt = $pdo->prepare("SELECT * FROM production_batches WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    if ($existing['status'] !== 'planned') {
        send_error('Only planned batches can be edited');
    }

    $body = json_body();
    $scheduledDate = trim(ga($body, 'scheduledDate', ''));
    if ($scheduledDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $scheduledDate)) {
        $scheduledDate = $existing['scheduled_date'];
    }
    $notes = ga($body, 'notes', $existing['notes']);

    $pdo->prepare("UPDATE production_batches SET scheduled_date=?, notes=? WHERE id = ?")
        ->execute(array($scheduledDate, $notes, $id));

    send(fetch_batch_with_ingredients($pdo, $id));
}

// ── PATCH /api/production.php?id=...&action=status ──────────────────────
// planned -> in_progress -> completed, or cancel from planned/in_progress.
// Completing a batch is the only transition that touches real stock: it
// deducts each snapshotted ingredient from inventory (rejecting the whole
// request if anything is short) and adds the finished quantity to the
// linked output item, updating its cost_per_unit to reflect what this
// batch actually cost to make.
if ($method === 'PATCH' && $id && $action === 'status') {
    require_staff_or_admin();
    $stmt = $pdo->prepare("SELECT * FROM production_batches WHERE id = ?");
    $stmt->execute(array($id));
    $batch = $stmt->fetch();
    if (!$batch) send_error('Not found', 404);

    $body = json_body();
    $status = ga($body, 'status', null);
    if (!in_array($status, array('planned', 'in_progress', 'completed', 'cancelled'), true)) {
        send_error('Invalid status');
    }

    $allowedTransitions = array(
        'planned' => array('in_progress', 'cancelled'),
        'in_progress' => array('completed', 'cancelled'),
        'completed' => array(),
        'cancelled' => array(),
    );
    if (!in_array($status, $allowedTransitions[$batch['status']], true)) {
        send_error('Cannot move from "' . $batch['status'] . '" to "' . $status . '"');
    }

    $pdo->beginTransaction();
    try {
        if ($status === 'completed') {
            $itemsStmt = $pdo->prepare("SELECT * FROM production_batch_ingredients WHERE batch_id = ?");
            $itemsStmt->execute(array($id));
            $batchItems = $itemsStmt->fetchAll();

            // Lock every ingredient row FOR UPDATE before checking, so two
            // batches (or a batch and an order) completing at the same
            // moment can't both read stale stock and both pass the check.
            $checkStmt = $pdo->prepare("SELECT quantity FROM inventory WHERE id = ? FOR UPDATE");
            foreach ($batchItems as $it) {
                if (!$it['item_id']) continue;
                $checkStmt->execute(array($it['item_id']));
                $invRow = $checkStmt->fetch();
                if (!$invRow || (float)$invRow['quantity'] < (float)$it['quantity']) {
                    $available = $invRow ? $invRow['quantity'] : 0;
                    $pdo->rollBack();
                    send_error('Not enough "' . $it['item_name'] . '" in stock (need ' . $it['quantity'] . ', have ' . $available . ')');
                }
            }

            $deduct = $pdo->prepare("UPDATE inventory SET quantity = quantity - ? WHERE id = ?");
            foreach ($batchItems as $it) {
                if ($it['item_id']) $deduct->execute(array((float)$it['quantity'], $it['item_id']));
            }

            if ($batch['output_item_id']) {
                $plannedQty = (float)$batch['planned_qty'];
                $batchCostPerUnit = $plannedQty > 0 ? (float)$batch['total_cost'] / $plannedQty : 0;

                // Weighted-average the new batch's cost into whatever stock
                // (and cost) of the output item already exists, instead of
                // just overwriting cost_per_unit with this batch's cost —
                // otherwise every earlier purchase/batch's cost basis is
                // silently discarded the moment a new batch completes.
                $outStmt = $pdo->prepare("SELECT quantity, cost_per_unit FROM inventory WHERE id = ? FOR UPDATE");
                $outStmt->execute(array($batch['output_item_id']));
                $outRow = $outStmt->fetch();
                $existingQty = $outRow ? (float)$outRow['quantity'] : 0;
                $existingCost = $outRow ? (float)$outRow['cost_per_unit'] : 0;
                $newTotalQty = $existingQty + $plannedQty;
                $newCostPerUnit = $newTotalQty > 0
                    ? (($existingQty * $existingCost) + ($plannedQty * $batchCostPerUnit)) / $newTotalQty
                    : $batchCostPerUnit;

                $pdo->prepare("UPDATE inventory SET quantity = quantity + ?, cost_per_unit = ? WHERE id = ?")
                    ->execute(array($plannedQty, $newCostPerUnit, $batch['output_item_id']));
            }

            $pdo->prepare("UPDATE production_batches SET status = ?, completed_at = NOW() WHERE id = ?")->execute(array($status, $id));
        } elseif ($status === 'in_progress') {
            $pdo->prepare("UPDATE production_batches SET status = ?, started_at = NOW() WHERE id = ?")->execute(array($status, $id));
        } else {
            $pdo->prepare("UPDATE production_batches SET status = ? WHERE id = ?")->execute(array($status, $id));
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to update status: ' . $e->getMessage(), 500);
    }

    if ($status === 'completed') {
        notify_management($pdo, null, "Production batch {$batch['batch_number']} completed — {$batch['output_item_name']} stock updated");
    }

    send(fetch_batch_with_ingredients($pdo, $id));
}

// ── DELETE /api/production.php?id=... ────────────────────────────────────
if ($method === 'DELETE' && $id) {
    require_admin();
    $stmt = $pdo->prepare("SELECT status FROM production_batches WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    if (!in_array($existing['status'], array('planned', 'cancelled'), true)) {
        send_error('Only planned or cancelled batches can be deleted');
    }
    $pdo->prepare("DELETE FROM production_batches WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
