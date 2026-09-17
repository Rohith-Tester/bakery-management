<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

// Purchasing is management-only — same tier as Invoices/Users.
require_admin();

function fmt_po_row($r) {
    return array(
        'id' => $r['id'],
        'poNumber' => $r['po_number'],
        'supplierId' => $r['supplier_id'],
        'supplierName' => $r['supplier_name'],
        'status' => $r['status'],
        'expectedDate' => $r['expected_date'],
        'notes' => $r['notes'],
        'totalAmount' => (float)$r['total_amount'],
        'createdBy' => $r['created_by'],
        'itemCount' => isset($r['item_count']) ? (int)$r['item_count'] : 0,
        'receivedAt' => $r['received_at'],
        'createdAt' => $r['created_at'],
    );
}

function fetch_po_with_items($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE id = ?");
    $stmt->execute(array($id));
    $po = $stmt->fetch();
    if (!$po) return null;
    $itemsStmt = $pdo->prepare("SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY id");
    $itemsStmt->execute(array($id));
    $items = array();
    foreach ($itemsStmt->fetchAll() as $r) {
        $items[] = array(
            'id' => (int)$r['id'],
            'itemId' => $r['item_id'],
            'name' => $r['item_name'],
            'quantity' => (float)$r['quantity'],
            'costPerUnit' => (float)$r['cost_per_unit'],
            'totalCost' => (float)$r['total_cost'],
        );
    }
    $out = fmt_po_row($po);
    $out['items'] = $items;
    return $out;
}

// ── GET /api/purchase_orders.php[?id=...] ────────────────────────────────
if ($method === 'GET' && !$id) {
    $rows = $pdo->query(
        "SELECT po.*, (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.id) AS item_count
         FROM purchase_orders po ORDER BY po.created_at DESC"
    )->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_po_row($r);

    $pendingValue = (float) $pdo->query(
        "SELECT COALESCE(SUM(total_amount),0) FROM purchase_orders WHERE status IN ('draft','ordered')"
    )->fetchColumn();
    $receivedValue = (float) $pdo->query(
        "SELECT COALESCE(SUM(total_amount),0) FROM purchase_orders WHERE status = 'received'"
    )->fetchColumn();
    $openCount = (int) $pdo->query(
        "SELECT COUNT(*) FROM purchase_orders WHERE status IN ('draft','ordered')"
    )->fetchColumn();

    send(array(
        'purchaseOrders' => $out,
        'pendingValue' => $pendingValue,
        'receivedValue' => $receivedValue,
        'openCount' => $openCount,
    ));
}

if ($method === 'GET' && $id) {
    $po = fetch_po_with_items($pdo, $id);
    if (!$po) send_error('Not found', 404);
    send($po);
}

// ── POST /api/purchase_orders.php ────────────────────────────────────────
if ($method === 'POST') {
    $body = json_body();
    $supplierId = ga($body, 'supplierId', null);
    $supplierName = trim(ga($body, 'supplierName', ''));
    $items = ga($body, 'items', array());
    $expectedDate = trim(ga($body, 'expectedDate', ''));
    if ($expectedDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expectedDate)) {
        $expectedDate = null;
    }
    $notes = trim(ga($body, 'notes', ''));
    $status = ga($body, 'status', 'draft');
    if (!in_array($status, array('draft', 'ordered'), true)) $status = 'draft';

    // If a real supplier was picked, use its stored name as the source of
    // truth; otherwise fall back to whatever free-text name was supplied.
    if ($supplierId) {
        $sStmt = $pdo->prepare("SELECT name FROM suppliers WHERE id = ?");
        $sStmt->execute(array($supplierId));
        $sRow = $sStmt->fetch();
        if (!$sRow) send_error('Supplier not found');
        $supplierName = $sRow['name'];
    }
    if (!$supplierName) send_error('supplierName or supplierId required');

    $cleanItems = array();
    $total = 0;
    foreach ($items as $it) {
        $name = trim(ga($it, 'name', ''));
        $qty = (float)ga($it, 'quantity', 0);
        $cost = (float)ga($it, 'costPerUnit', 0);
        if ($name === '' || $qty <= 0) continue;
        $itemId = ga($it, 'itemId', null);
        $lineTotal = $qty * $cost;
        $cleanItems[] = array('itemId' => $itemId ?: null, 'name' => $name, 'quantity' => $qty, 'costPerUnit' => $cost, 'totalCost' => $lineTotal);
        $total += $lineTotal;
    }
    if (!count($cleanItems)) send_error('Add at least one item with a quantity');

    $countStmt = $pdo->query("SELECT COUNT(*) FROM purchase_orders");
    $poNumber = 'PO-' . str_pad((string)($countStmt->fetchColumn() + 1), 3, '0', STR_PAD_LEFT);
    $newId = uuid4();

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name, status, expected_date, notes, total_amount, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute(array($newId, $poNumber, $supplierId ?: null, $supplierName, $status, $expectedDate, $notes, $total, isset($_SESSION['username']) ? $_SESSION['username'] : ''));

        $itemStmt = $pdo->prepare(
            "INSERT INTO purchase_order_items (po_id, item_id, item_name, quantity, cost_per_unit, total_cost) VALUES (?, ?, ?, ?, ?, ?)"
        );
        foreach ($cleanItems as $it) {
            $itemStmt->execute(array($newId, $it['itemId'], $it['name'], $it['quantity'], $it['costPerUnit'], $it['totalCost']));
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to create purchase order: ' . $e->getMessage(), 500);
    }

    notify_management($pdo, null, "New purchase order {$poNumber} to {$supplierName} (₹" . number_format($total, 0) . ")");

    send(fetch_po_with_items($pdo, $newId), 201);
}

// ── PATCH /api/purchase_orders.php?id=...  (edit while still a draft) ───
if ($method === 'PATCH' && $id && !$action) {
    $stmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    if ($existing['status'] !== 'draft') {
        send_error('Only draft purchase orders can be edited');
    }

    $body = json_body();
    $supplierId = ga($body, 'supplierId', $existing['supplier_id']);
    $supplierName = trim(ga($body, 'supplierName', $existing['supplier_name']));
    if ($supplierId) {
        $sStmt = $pdo->prepare("SELECT name FROM suppliers WHERE id = ?");
        $sStmt->execute(array($supplierId));
        $sRow = $sStmt->fetch();
        if (!$sRow) send_error('Supplier not found');
        $supplierName = $sRow['name'];
    }
    $items = ga($body, 'items', null);
    $expectedDate = trim(ga($body, 'expectedDate', ''));
    if ($expectedDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expectedDate)) {
        $expectedDate = $existing['expected_date'];
    }
    $notes = ga($body, 'notes', $existing['notes']);

    $cleanItems = null;
    $total = (float)$existing['total_amount'];
    if (is_array($items)) {
        $cleanItems = array();
        $total = 0;
        foreach ($items as $it) {
            $name = trim(ga($it, 'name', ''));
            $qty = (float)ga($it, 'quantity', 0);
            $cost = (float)ga($it, 'costPerUnit', 0);
            if ($name === '' || $qty <= 0) continue;
            $itemId = ga($it, 'itemId', null);
            $lineTotal = $qty * $cost;
            $cleanItems[] = array('itemId' => $itemId ?: null, 'name' => $name, 'quantity' => $qty, 'costPerUnit' => $cost, 'totalCost' => $lineTotal);
            $total += $lineTotal;
        }
        if (!count($cleanItems)) send_error('Add at least one item with a quantity');
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE purchase_orders SET supplier_id=?, supplier_name=?, expected_date=?, notes=?, total_amount=? WHERE id = ?"
        )->execute(array($supplierId ?: null, $supplierName, $expectedDate, $notes, $total, $id));

        if ($cleanItems !== null) {
            $pdo->prepare("DELETE FROM purchase_order_items WHERE po_id = ?")->execute(array($id));
            $itemStmt = $pdo->prepare(
                "INSERT INTO purchase_order_items (po_id, item_id, item_name, quantity, cost_per_unit, total_cost) VALUES (?, ?, ?, ?, ?, ?)"
            );
            foreach ($cleanItems as $it) {
                $itemStmt->execute(array($id, $it['itemId'], $it['name'], $it['quantity'], $it['costPerUnit'], $it['totalCost']));
            }
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to update purchase order: ' . $e->getMessage(), 500);
    }

    send(fetch_po_with_items($pdo, $id));
}

// ── PATCH /api/purchase_orders.php?id=...&action=status ─────────────────
// draft -> ordered -> received, or cancel from draft/ordered. Receiving a
// PO adds the ordered quantities to real inventory stock and logs each
// line as an inventory purchase (feeds the Weekly Report's spend figure).
if ($method === 'PATCH' && $id && $action === 'status') {
    $stmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE id = ?");
    $stmt->execute(array($id));
    $po = $stmt->fetch();
    if (!$po) send_error('Not found', 404);

    $body = json_body();
    $status = ga($body, 'status', null);
    if (!in_array($status, array('draft', 'ordered', 'received', 'cancelled'), true)) {
        send_error('Invalid status');
    }

    $allowedTransitions = array(
        'draft' => array('ordered', 'cancelled'),
        'ordered' => array('received', 'cancelled'),
        'received' => array(),
        'cancelled' => array(),
    );
    if (!in_array($status, $allowedTransitions[$po['status']], true)) {
        send_error('Cannot move from "' . $po['status'] . '" to "' . $status . '"');
    }

    $pdo->beginTransaction();
    try {
        if ($status === 'received') {
            $itemsStmt = $pdo->prepare("SELECT * FROM purchase_order_items WHERE po_id = ?");
            $itemsStmt->execute(array($id));
            $poItems = $itemsStmt->fetchAll();

            // Lock each inventory row before reading it, both to keep this
            // consistent with concurrent order/production deductions and so
            // the weighted-average cost below is computed from a fresh read.
            $lockStmt = $pdo->prepare("SELECT quantity, cost_per_unit FROM inventory WHERE id = ? FOR UPDATE");
            $bumpStock = $pdo->prepare("UPDATE inventory SET quantity = quantity + ?, cost_per_unit = ? WHERE id = ?");
            $logPurchase = $pdo->prepare(
                "INSERT INTO inventory_purchases (id, item_id, item_name, quantity, cost_per_unit, total_cost) VALUES (?, ?, ?, ?, ?, ?)"
            );
            foreach ($poItems as $it) {
                if ($it['item_id']) {
                    $lockStmt->execute(array($it['item_id']));
                    $invRow = $lockStmt->fetch();
                    $existingQty = $invRow ? (float)$invRow['quantity'] : 0;
                    $existingCost = $invRow ? (float)$invRow['cost_per_unit'] : 0;
                    $receivedQty = (float)$it['quantity'];
                    $receivedCost = (float)$it['cost_per_unit'];
                    $newTotalQty = $existingQty + $receivedQty;
                    // Weighted-average the newly received cost into whatever
                    // stock is already on hand, instead of overwriting
                    // cost_per_unit with just this PO's price — otherwise
                    // every earlier purchase's cost basis is lost the moment
                    // a new PO at a different price comes in.
                    $newCostPerUnit = $newTotalQty > 0
                        ? (($existingQty * $existingCost) + ($receivedQty * $receivedCost)) / $newTotalQty
                        : $receivedCost;
                    $bumpStock->execute(array($receivedQty, $newCostPerUnit, $it['item_id']));
                }
                $logPurchase->execute(array(
                    uuid4(), $it['item_id'], $it['item_name'], (float)$it['quantity'], (float)$it['cost_per_unit'], (float)$it['total_cost']
                ));
            }
            $pdo->prepare("UPDATE purchase_orders SET status = ?, received_at = NOW() WHERE id = ?")->execute(array($status, $id));
        } else {
            $pdo->prepare("UPDATE purchase_orders SET status = ? WHERE id = ?")->execute(array($status, $id));
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        send_error('Failed to update status: ' . $e->getMessage(), 500);
    }

    if ($status === 'received') {
        notify_management($pdo, null, "Purchase order {$po['po_number']} received — inventory restocked");
    }

    send(fetch_po_with_items($pdo, $id));
}

// ── DELETE /api/purchase_orders.php?id=... ───────────────────────────────
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT status FROM purchase_orders WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    if (!in_array($existing['status'], array('draft', 'cancelled'), true)) {
        send_error('Only draft or cancelled purchase orders can be deleted');
    }
    $pdo->prepare("DELETE FROM purchase_orders WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
