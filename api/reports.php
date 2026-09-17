<?php
require __DIR__ . '/_bootstrap.php';
// Money-in / money-out reporting is sensitive business data — admin only.
require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') send_error('Unsupported request', 405);

$type = ga($_GET, 'type', 'daily');

// ── Helpers ─────────────────────────────────────────────────────────────
function day_range($dateStr) {
    $start = $dateStr . ' 00:00:00';
    $end = $dateStr . ' 23:59:59';
    return array($start, $end);
}

function month_bounds($monthStr) {
    // $monthStr like '2026-07'
    $start = $monthStr . '-01 00:00:00';
    $end = date('Y-m-t 23:59:59', strtotime($start));
    $daysInMonth = (int)date('t', strtotime($start));
    return array($start, $end, $daysInMonth);
}

// ═══════════════════════════════════════════════════════════════════════
// DAILY SALES
// ═══════════════════════════════════════════════════════════════════════
if ($type === 'daily') {
    $date = ga($_GET, 'date', date('Y-m-d'));
    list($start, $end) = day_range($date);

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC");
    $stmt->execute(array($start, $end));
    $orderRows = $stmt->fetchAll();

    $sales = array();
    $totalSales = 0.0;
    $statusCounts = array();
    $orderIds = array();
    foreach ($orderRows as $o) {
        $totalSales += (float)$o['total'];
        $statusCounts[$o['status']] = (isset($statusCounts[$o['status']]) ? $statusCounts[$o['status']] : 0) + 1;
        $orderIds[] = $o['id'];
        $sales[] = array(
            'orderNumber' => $o['order_number'],
            'customerName' => $o['customer_name'],
            'total' => (float)$o['total'],
            'status' => $o['status'],
            'deliveryType' => $o['delivery_type'],
            'createdAt' => $o['created_at'],
        );
    }

    // Hour-by-hour breakdown (0-23) for a simple intraday bar chart.
    $hourly = array_fill(0, 24, 0.0);
    foreach ($orderRows as $o) {
        $h = (int)date('G', strtotime($o['created_at']));
        $hourly[$h] += (float)$o['total'];
    }

    // Top-selling items for the day.
    $topItems = array();
    if (!empty($orderIds)) {
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        $stmt = $pdo->prepare("SELECT name, SUM(qty) as qty, SUM(qty*price) as revenue FROM order_items WHERE order_id IN ($placeholders) GROUP BY name ORDER BY revenue DESC LIMIT 8");
        $stmt->execute($orderIds);
        foreach ($stmt->fetchAll() as $r) {
            $topItems[] = array('name' => $r['name'], 'qty' => (float)$r['qty'], 'revenue' => (float)$r['revenue']);
        }
    }

    send(array(
        'type' => 'daily',
        'date' => $date,
        'totalSales' => round($totalSales, 2),
        'orderCount' => count($orderRows),
        'avgOrderValue' => count($orderRows) ? round($totalSales / count($orderRows), 2) : 0,
        'statusCounts' => $statusCounts,
        'hourly' => $hourly,
        'topItems' => $topItems,
        'sales' => $sales,
    ));
}

// ═══════════════════════════════════════════════════════════════════════
// MONTHLY SALES
// ═══════════════════════════════════════════════════════════════════════
if ($type === 'monthly') {
    $month = ga($_GET, 'month', date('Y-m'));
    list($start, $end, $daysInMonth) = month_bounds($month);

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE created_at BETWEEN ? AND ? ORDER BY created_at ASC");
    $stmt->execute(array($start, $end));
    $orderRows = $stmt->fetchAll();

    $byDay = array();
    for ($d = 1; $d <= $daysInMonth; $d++) {
        $key = $month . '-' . str_pad($d, 2, '0', STR_PAD_LEFT);
        $byDay[$key] = array('date' => $key, 'sales' => 0.0, 'orders' => 0);
    }
    $totalSales = 0.0;
    foreach ($orderRows as $o) {
        $day = date('Y-m-d', strtotime($o['created_at']));
        $amt = (float)$o['total'];
        $totalSales += $amt;
        if (isset($byDay[$day])) {
            $byDay[$day]['sales'] += $amt;
            $byDay[$day]['orders'] += 1;
        }
    }
    foreach ($byDay as $k => $v) $byDay[$k]['sales'] = round($v['sales'], 2);

    // Week-over-week style: compare to previous month's total for a trend indicator.
    $prevMonth = date('Y-m', strtotime($start . ' -1 month'));
    list($prevStart, $prevEnd) = array($prevMonth . '-01 00:00:00', date('Y-m-t 23:59:59', strtotime($prevMonth . '-01')));
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(total),0) as t FROM orders WHERE created_at BETWEEN ? AND ?");
    $stmt->execute(array($prevStart, $prevEnd));
    $prevTotal = (float)$stmt->fetch()['t'];

    send(array(
        'type' => 'monthly',
        'month' => $month,
        'totalSales' => round($totalSales, 2),
        'orderCount' => count($orderRows),
        'avgOrderValue' => count($orderRows) ? round($totalSales / count($orderRows), 2) : 0,
        'prevMonthTotal' => round($prevTotal, 2),
        'changePct' => $prevTotal > 0 ? round((($totalSales - $prevTotal) / $prevTotal) * 100, 1) : null,
        'daily' => array_values($byDay),
    ));
}

// ═══════════════════════════════════════════════════════════════════════
// INVENTORY REPORT
// ═══════════════════════════════════════════════════════════════════════
if ($type === 'inventory') {
    $stmt = $pdo->query("SELECT i.*, s.name as supplier_name FROM inventory i LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name ASC");
    $rows = $stmt->fetchAll();

    $items = array();
    $totalValue = 0.0;
    $lowStockCount = 0;
    $outOfStockCount = 0;
    foreach ($rows as $r) {
        $qty = (float)$r['quantity'];
        $cost = (float)$r['cost_per_unit'];
        $value = $qty * $cost;
        $totalValue += $value;
        $isLow = $qty <= (float)$r['min_stock'];
        $isOut = $qty <= 0;
        if ($isOut) $outOfStockCount++;
        else if ($isLow) $lowStockCount++;
        $items[] = array(
            'name' => $r['name'],
            'quantity' => $qty,
            'unit' => $r['unit'],
            'minStock' => (float)$r['min_stock'],
            'costPerUnit' => $cost,
            'value' => round($value, 2),
            'supplierName' => $r['supplier_name'],
            'status' => $isOut ? 'out' : ($isLow ? 'low' : 'ok'),
        );
    }
    // Highest-value items first for the report table.
    usort($items, function($a, $b) { return ($b['value'] > $a['value']) ? 1 : (($b['value'] < $a['value']) ? -1 : 0); });

    send(array(
        'type' => 'inventory',
        'generatedAt' => date('Y-m-d H:i:s'),
        'itemCount' => count($items),
        'totalValue' => round($totalValue, 2),
        'lowStockCount' => $lowStockCount,
        'outOfStockCount' => $outOfStockCount,
        'items' => $items,
    ));
}

// ═══════════════════════════════════════════════════════════════════════
// PRODUCTION REPORT
// ═══════════════════════════════════════════════════════════════════════
if ($type === 'production') {
    $from = ga($_GET, 'from', date('Y-m-d', strtotime('-29 days')));
    $to = ga($_GET, 'to', date('Y-m-d'));
    list($start) = day_range($from);
    list(, $end) = day_range($to);

    $stmt = $pdo->prepare("SELECT * FROM production_batches WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC");
    $stmt->execute(array($start, $end));
    $rows = $stmt->fetchAll();

    $batches = array();
    $statusCounts = array('planned' => 0, 'in_progress' => 0, 'completed' => 0, 'cancelled' => 0);
    $totalCost = 0.0;
    $totalOutputQty = 0.0;
    $byRecipe = array();
    foreach ($rows as $r) {
        $statusCounts[$r['status']] = (isset($statusCounts[$r['status']]) ? $statusCounts[$r['status']] : 0) + 1;
        if ($r['status'] === 'completed') {
            $totalCost += (float)$r['total_cost'];
            $totalOutputQty += (float)$r['planned_qty'];
            $key = $r['recipe_name'];
            if (!isset($byRecipe[$key])) $byRecipe[$key] = array('recipeName' => $key, 'batches' => 0, 'qty' => 0.0, 'cost' => 0.0);
            $byRecipe[$key]['batches']++;
            $byRecipe[$key]['qty'] += (float)$r['planned_qty'];
            $byRecipe[$key]['cost'] += (float)$r['total_cost'];
        }
        $batches[] = array(
            'batchNumber' => $r['batch_number'],
            'recipeName' => $r['recipe_name'],
            'status' => $r['status'],
            'plannedQty' => (float)$r['planned_qty'],
            'yieldUnit' => $r['yield_unit'],
            'totalCost' => (float)$r['total_cost'],
            'scheduledDate' => $r['scheduled_date'],
            'completedAt' => $r['completed_at'],
            'createdAt' => $r['created_at'],
        );
    }
    $byRecipeList = array_values($byRecipe);
    usort($byRecipeList, function($a, $b) { return ($b['cost'] > $a['cost']) ? 1 : (($b['cost'] < $a['cost']) ? -1 : 0); });

    send(array(
        'type' => 'production',
        'from' => $from,
        'to' => $to,
        'batchCount' => count($rows),
        'statusCounts' => $statusCounts,
        'totalCost' => round($totalCost, 2),
        'totalOutputQty' => round($totalOutputQty, 2),
        'byRecipe' => $byRecipeList,
        'batches' => $batches,
    ));
}

// ═══════════════════════════════════════════════════════════════════════
// PURCHASE REPORT (supplier restocking — Purchase Orders + direct imports)
// ═══════════════════════════════════════════════════════════════════════
if ($type === 'purchase') {
    $from = ga($_GET, 'from', date('Y-m-d', strtotime('-29 days')));
    $to = ga($_GET, 'to', date('Y-m-d'));
    list($start) = day_range($from);
    list(, $end) = day_range($to);

    $stmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC");
    $stmt->execute(array($start, $end));
    $poRows = $stmt->fetchAll();

    $purchaseOrders = array();
    $statusCounts = array('draft' => 0, 'ordered' => 0, 'received' => 0, 'cancelled' => 0);
    $totalPoAmount = 0.0;
    $totalReceivedAmount = 0.0;
    $bySupplier = array();
    foreach ($poRows as $r) {
        $statusCounts[$r['status']] = (isset($statusCounts[$r['status']]) ? $statusCounts[$r['status']] : 0) + 1;
        $totalPoAmount += (float)$r['total_amount'];
        if ($r['status'] === 'received') {
            $totalReceivedAmount += (float)$r['total_amount'];
            $key = $r['supplier_name'];
            if (!isset($bySupplier[$key])) $bySupplier[$key] = array('supplierName' => $key, 'orders' => 0, 'amount' => 0.0);
            $bySupplier[$key]['orders']++;
            $bySupplier[$key]['amount'] += (float)$r['total_amount'];
        }
        $purchaseOrders[] = array(
            'poNumber' => $r['po_number'],
            'supplierName' => $r['supplier_name'],
            'status' => $r['status'],
            'totalAmount' => (float)$r['total_amount'],
            'expectedDate' => $r['expected_date'],
            'receivedAt' => $r['received_at'],
            'createdAt' => $r['created_at'],
        );
    }
    $bySupplierList = array_values($bySupplier);
    usort($bySupplierList, function($a, $b) { return ($b['amount'] > $a['amount']) ? 1 : (($b['amount'] < $a['amount']) ? -1 : 0); });

    send(array(
        'type' => 'purchase',
        'from' => $from,
        'to' => $to,
        'poCount' => count($poRows),
        'statusCounts' => $statusCounts,
        'totalPoAmount' => round($totalPoAmount, 2),
        'totalReceivedAmount' => round($totalReceivedAmount, 2),
        'bySupplier' => $bySupplierList,
        'purchaseOrders' => $purchaseOrders,
    ));
}

// ═══════════════════════════════════════════════════════════════════════
// PROFIT REPORT (Sales revenue vs. Purchase + Production spend)
// ═══════════════════════════════════════════════════════════════════════
if ($type === 'profit') {
    $from = ga($_GET, 'from', date('Y-m-d', strtotime('-29 days')));
    $to = ga($_GET, 'to', date('Y-m-d'));
    list($start) = day_range($from);
    list(, $end) = day_range($to);

    $stmt = $pdo->prepare("SELECT COALESCE(SUM(total),0) as t, COUNT(*) as c FROM orders WHERE created_at BETWEEN ? AND ?");
    $stmt->execute(array($start, $end));
    $salesRow = $stmt->fetch();
    $totalSales = (float)$salesRow['t'];
    $orderCount = (int)$salesRow['c'];

    // Refunds reduce net revenue — subtract anything actually refunded in the window.
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(refund_amount),0) as t FROM returns WHERE status = 'refunded' AND refunded_at BETWEEN ? AND ?");
    $stmt->execute(array($start, $end));
    $totalRefunded = (float)$stmt->fetch()['t'];

    $stmt = $pdo->prepare("SELECT COALESCE(SUM(total_cost),0) as t FROM inventory_purchases WHERE created_at BETWEEN ? AND ?");
    $stmt->execute(array($start, $end));
    $totalImportSpend = (float)$stmt->fetch()['t'];

    $stmt = $pdo->prepare("SELECT COALESCE(SUM(total_cost),0) as t FROM production_batches WHERE status = 'completed' AND completed_at BETWEEN ? AND ?");
    $stmt->execute(array($start, $end));
    $totalProductionCost = (float)$stmt->fetch()['t'];

    $netRevenue = $totalSales - $totalRefunded;
    $totalCost = $totalImportSpend + $totalProductionCost;
    $profit = $netRevenue - $totalCost;
    $margin = $netRevenue > 0 ? round(($profit / $netRevenue) * 100, 1) : null;

    // Daily profit trend for the chart.
    $stmt = $pdo->prepare("SELECT DATE(created_at) as d, SUM(total) as s FROM orders WHERE created_at BETWEEN ? AND ? GROUP BY DATE(created_at)");
    $stmt->execute(array($start, $end));
    $salesByDay = array();
    foreach ($stmt->fetchAll() as $r) $salesByDay[$r['d']] = (float)$r['s'];

    $stmt = $pdo->prepare("SELECT DATE(created_at) as d, SUM(total_cost) as s FROM inventory_purchases WHERE created_at BETWEEN ? AND ? GROUP BY DATE(created_at)");
    $stmt->execute(array($start, $end));
    $importByDay = array();
    foreach ($stmt->fetchAll() as $r) $importByDay[$r['d']] = (float)$r['s'];

    $stmt = $pdo->prepare("SELECT DATE(completed_at) as d, SUM(total_cost) as s FROM production_batches WHERE status='completed' AND completed_at BETWEEN ? AND ? GROUP BY DATE(completed_at)");
    $stmt->execute(array($start, $end));
    $prodByDay = array();
    foreach ($stmt->fetchAll() as $r) $prodByDay[$r['d']] = (float)$r['s'];

    $daily = array();
    $cursor = strtotime($from);
    $endTs = strtotime($to);
    while ($cursor <= $endTs) {
        $d = date('Y-m-d', $cursor);
        $s = isset($salesByDay[$d]) ? $salesByDay[$d] : 0.0;
        $c = (isset($importByDay[$d]) ? $importByDay[$d] : 0.0) + (isset($prodByDay[$d]) ? $prodByDay[$d] : 0.0);
        $daily[] = array('date' => $d, 'sales' => round($s, 2), 'cost' => round($c, 2), 'profit' => round($s - $c, 2));
        $cursor = strtotime('+1 day', $cursor);
    }

    send(array(
        'type' => 'profit',
        'from' => $from,
        'to' => $to,
        'totalSales' => round($totalSales, 2),
        'totalRefunded' => round($totalRefunded, 2),
        'netRevenue' => round($netRevenue, 2),
        'totalImportSpend' => round($totalImportSpend, 2),
        'totalProductionCost' => round($totalProductionCost, 2),
        'totalCost' => round($totalCost, 2),
        'profit' => round($profit, 2),
        'marginPct' => $margin,
        'orderCount' => $orderCount,
        'daily' => $daily,
    ));
}

send_error('Unknown report type', 400);
