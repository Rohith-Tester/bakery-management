<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

// Same tier as Suppliers/Purchase Orders: staff/admin can see the low-stock
// picture and raise/acknowledge alerts (useful while they're restocking);
// only admins can delete an alert from the log. Supplier accounts get
// read-only access scoped to their own items, plus the ability to
// acknowledge/resolve alerts raised against them (e.g. once they've
// delivered a restock).
require_staff_admin_or_supplier();
$__supplierId = current_supplier_id($pdo); // null unless the session is a supplier

function fmt_alert($r) {
    return array(
        'id' => $r['id'],
        'itemId' => $r['item_id'],
        'itemName' => $r['item_name'],
        'supplierId' => $r['supplier_id'],
        'supplierName' => $r['supplier_name'],
        'quantityAtAlert' => (float)$r['quantity_at_alert'],
        'minStock' => (float)$r['min_stock'],
        'severity' => $r['severity'],
        'status' => $r['status'],
        'notes' => $r['notes'],
        'deliveryPartner' => isset($r['delivery_partner']) ? $r['delivery_partner'] : null,
        'trackingNumber' => isset($r['tracking_number']) ? $r['tracking_number'] : null,
        'dispatchedAt' => isset($r['dispatched_at']) ? $r['dispatched_at'] : null,
        'receivedAt' => isset($r['received_at']) ? $r['received_at'] : null,
        'createdBy' => $r['created_by'],
        'createdAt' => $r['created_at'],
        'resolvedAt' => $r['resolved_at'],
    );
}

// The "currently low" picture is always computed live from real inventory
// stock — never cached — so it can never drift from what's actually on the
// shelf. Each row also carries whether an *open* alert already exists for
// it, so the UI doesn't invite raising the same alert twice.
function live_low_stock($pdo, $supplierId = null) {
    if ($supplierId) {
        $stmt = $pdo->prepare(
            "SELECT i.*, s.name AS supplier_name FROM inventory i
             LEFT JOIN suppliers s ON s.id = i.supplier_id
             WHERE i.supplier_id = ? ORDER BY i.name"
        );
        $stmt->execute(array($supplierId));
        $rows = $stmt->fetchAll();
    } else {
        $rows = $pdo->query(
            "SELECT i.*, s.name AS supplier_name FROM inventory i
             LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name"
        )->fetchAll();
    }

    $openStmt = $pdo->query(
        "SELECT item_id, id FROM restock_alerts WHERE status IN ('open','acknowledged')"
    );
    $openByItem = array();
    foreach ($openStmt->fetchAll() as $r) {
        if ($r['item_id']) $openByItem[$r['item_id']] = $r['id'];
    }

    $out = array();
    foreach ($rows as $r) {
        $qty = (float)$r['quantity'];
        $minStock = (float)$r['min_stock'];
        $status = stock_status($qty, $minStock);
        if ($status !== 'low' && $status !== 'critical') continue;
        $out[] = array(
            'itemId' => $r['id'],
            'itemName' => $r['name'],
            'quantity' => $qty,
            'unit' => $r['unit'],
            'minStock' => $minStock,
            'severity' => $status,
            'supplierId' => $r['supplier_id'],
            'supplierName' => isset($r['supplier_name']) ? $r['supplier_name'] : '',
            'costPerUnit' => (float)$r['cost_per_unit'],
            'openAlertId' => isset($openByItem[$r['id']]) ? $openByItem[$r['id']] : null,
        );
    }
    return $out;
}

// ── GET /api/restock_alerts.php ──────────────────────────────────────────
if ($method === 'GET' && !$id) {
    // Supplier accounts only ever see their own linked supplier's slice.
    // If a supplier user isn't linked to a supplier row yet, they simply
    // see nothing rather than erroring.
    if ($_SESSION['role'] === 'supplier' && !$__supplierId) {
        send(array('lowStock' => array(), 'alerts' => array(), 'openCount' => 0, 'criticalCount' => 0, 'suppliersAffected' => 0));
    }

    $lowStock = live_low_stock($pdo, $__supplierId);

    if ($__supplierId) {
        $logStmt = $pdo->prepare(
            "SELECT * FROM restock_alerts WHERE supplier_id = ? ORDER BY
               CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
               created_at DESC LIMIT 100"
        );
        $logStmt->execute(array($__supplierId));
        $openCountStmt = $pdo->prepare("SELECT COUNT(*) FROM restock_alerts WHERE status = 'open' AND supplier_id = ?");
        $openCountStmt->execute(array($__supplierId));
        $openCount = (int) $openCountStmt->fetchColumn();
    } else {
        $logStmt = $pdo->query(
            "SELECT * FROM restock_alerts ORDER BY
               CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
               created_at DESC LIMIT 100"
        );
        $openCount = (int) $pdo->query("SELECT COUNT(*) FROM restock_alerts WHERE status = 'open'")->fetchColumn();
    }
    $log = array();
    foreach ($logStmt->fetchAll() as $r) $log[] = fmt_alert($r);

    $suppliersAffected = count(array_unique(array_filter(array_map(function ($r) { return $r['supplierId']; }, $lowStock))));

    send(array(
        'lowStock' => $lowStock,
        'alerts' => $log,
        'openCount' => $openCount,
        'criticalCount' => count(array_filter($lowStock, function ($r) { return $r['severity'] === 'critical'; })),
        'suppliersAffected' => $suppliersAffected,
    ));
}

if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM restock_alerts WHERE id = ?");
    $stmt->execute(array($id));
    $row = $stmt->fetch();
    if (!$row) send_error('Not found', 404);
    if ($_SESSION['role'] === 'supplier' && $row['supplier_id'] !== $__supplierId) {
        send_error('Not found', 404);
    }
    send(fmt_alert($row));
}

// ── POST /api/restock_alerts.php ─────────────────────────────────────────
// Raises an alert for one item ({ itemId }), or — with { scanAll: true } —
// raises one for every currently low/critical item that doesn't already
// have an open/acknowledged alert. Either way, notifies management once
// per alert raised so it shows up in the notification bell too.
if ($method === 'POST') {
    // Raising an alert is a staff/admin action, not something a supplier
    // account does on their own behalf.
    require_staff_or_admin();
    $body = json_body();
    $itemId = ga($body, 'itemId', null);
    $scanAll = ga($body, 'scanAll', false);

    $lowStock = live_low_stock($pdo);
    $targets = array();
    if ($scanAll) {
        foreach ($lowStock as $r) {
            if (!$r['openAlertId']) $targets[] = $r;
        }
        if (!count($targets)) send_error('No un-alerted low-stock items right now');
    } elseif ($itemId) {
        $match = null;
        foreach ($lowStock as $r) { if ($r['itemId'] === $itemId) { $match = $r; break; } }
        if (!$match) send_error('That item is not currently low on stock');
        if ($match['openAlertId']) send_error('An alert is already open for this item');
        $targets[] = $match;
    } else {
        send_error('itemId or scanAll is required');
    }

    $createdBy = isset($_SESSION['username']) ? $_SESSION['username'] : '';
    $created = array();
    $insert = $pdo->prepare(
        "INSERT INTO restock_alerts (id, item_id, item_name, supplier_id, supplier_name, quantity_at_alert, min_stock, severity, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)"
    );
    foreach ($targets as $t) {
        $newId = uuid4();
        $insert->execute(array(
            $newId, $t['itemId'], $t['itemName'], $t['supplierId'] ?: null, $t['supplierName'],
            $t['quantity'], $t['minStock'], $t['severity'], $createdBy,
        ));
        $created[] = $newId;
        $supplierNote = $t['supplierName'] ? " (supplier: {$t['supplierName']})" : '';
        notify_management($pdo, null, "Restock alert: \"{$t['itemName']}\" is {$t['severity']} on stock{$supplierNote}");
    }

    $out = array();
    foreach ($created as $cid) {
        $stmt = $pdo->prepare("SELECT * FROM restock_alerts WHERE id = ?");
        $stmt->execute(array($cid));
        $out[] = fmt_alert($stmt->fetch());
    }
    send(array('alerts' => $out), 201);
}

// ── PATCH /api/restock_alerts.php?id=...&action=status ──────────────────
if ($method === 'PATCH' && $id && $action === 'status') {
    // Full lifecycle: open -> acknowledged -> ready -> dispatched -> received -> resolved.
    // Acknowledge / ready / dispatch are supplier actions (the supplier
    // preps the restock, marks it ready for pickup, then hands it to a
    // courier with a tracking number). Receiving and resolving are now
    // handled by admin/staff instead, once the shipment actually arrives at
    // the bakery — tracked from the admin Track Order page.
    $role = $_SESSION['role'];
    if ($role !== 'supplier' && $role !== 'admin' && $role !== 'staff') {
        send_error('Not allowed to update this alert\'s status', 403);
    }
    $stmt = $pdo->prepare("SELECT * FROM restock_alerts WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    if ($role === 'supplier' && $existing['supplier_id'] !== $__supplierId) {
        send_error('Not found', 404);
    }

    $body = json_body();
    $status = ga($body, 'status', null);
    if (!in_array($status, array('open', 'acknowledged', 'ready', 'dispatched', 'received', 'resolved'), true)) {
        send_error('Invalid status');
    }

    $allowedTransitions = array(
        'open' => array('acknowledged'),
        'acknowledged' => array('ready', 'open'),
        'ready' => array('dispatched'),
        'dispatched' => array('received'),
        'received' => array('resolved'),
        'resolved' => array(),
    );
    if (!array_key_exists($existing['status'], $allowedTransitions)) {
        // Guards against rows left with a stale/unrecognized status (e.g. a
        // value the DB enum doesn't support and silently truncated), instead
        // of surfacing a raw "Undefined index" notice to the user.
        send_error('This alert has an unrecognized status ("' . $existing['status'] . '") and can\'t be updated. Please contact an admin.');
    }
    if (!in_array($status, $allowedTransitions[$existing['status']], true)) {
        send_error('Cannot move from "' . $existing['status'] . '" to "' . $status . '"');
    }

    // Supplier drives open -> acknowledged -> ready -> dispatched.
    // Admin/staff drive dispatched -> received -> resolved.
    $supplierSteps = array('acknowledged', 'ready', 'dispatched', 'open');
    $managementSteps = array('received', 'resolved');
    if ($role === 'supplier' && !in_array($status, $supplierSteps, true)) {
        send_error('Only admin/staff can mark a dispatched restock as received', 403);
    }
    if (($role === 'admin' || $role === 'staff') && !in_array($status, $managementSteps, true)) {
        send_error('Only the supplier can move this alert to "' . $status . '"', 403);
    }

    if ($status === 'dispatched') {
        $deliveryPartner = trim((string) ga($body, 'deliveryPartner', ''));
        $trackingNumber = trim((string) ga($body, 'trackingNumber', ''));
        if ($deliveryPartner === '' || $trackingNumber === '') {
            send_error('Delivery partner and tracking number are required to dispatch');
        }
        $pdo->prepare(
            "UPDATE restock_alerts SET status = ?, delivery_partner = ?, tracking_number = ?, dispatched_at = NOW() WHERE id = ?"
        )->execute(array($status, $deliveryPartner, $trackingNumber, $id));
        // Let admin/staff know a tracking number now exists for this restock,
        // straight in the notification bell, so they can watch for it on the
        // Track Order page.
        $supplierNote = $existing['supplier_name'] ? " from {$existing['supplier_name']}" : '';
        notify_management($pdo, null, "\"{$existing['item_name']}\" restock{$supplierNote} dispatched — tracking number #{$trackingNumber} ({$deliveryPartner})");
    } elseif ($status === 'received') {
        $pdo->prepare("UPDATE restock_alerts SET status = ?, received_at = NOW() WHERE id = ?")->execute(array($status, $id));
    } elseif ($status === 'resolved') {
        $pdo->prepare("UPDATE restock_alerts SET status = ?, resolved_at = NOW() WHERE id = ?")->execute(array($status, $id));
    } else {
        $pdo->prepare("UPDATE restock_alerts SET status = ? WHERE id = ?")->execute(array($status, $id));
    }

    $stmt = $pdo->prepare("SELECT * FROM restock_alerts WHERE id = ?");
    $stmt->execute(array($id));
    send(fmt_alert($stmt->fetch()));
}

// ── DELETE /api/restock_alerts.php?id=... ────────────────────────────────
if ($method === 'DELETE' && $id) {
    require_admin();
    $stmt = $pdo->prepare("SELECT id FROM restock_alerts WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM restock_alerts WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
