<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);

// Reading suppliers is allowed for any staff/admin account (they need the
// list when restocking inventory and picking a preferred supplier).
// Creating/editing/deleting suppliers is admin-only.
require_staff_or_admin();
if ($method !== 'GET') {
    require_admin();
}

function fmt_supplier($r) {
    return array(
        'id' => $r['id'],
        'name' => $r['name'],
        'contactPerson' => $r['contact_person'],
        'phone' => $r['phone'],
        'email' => $r['email'],
        'address' => $r['address'],
        'category' => $r['category'],
        'notes' => $r['notes'],
        'status' => $r['status'],
        'itemCount' => isset($r['item_count']) ? (int)$r['item_count'] : 0,
        'userId' => isset($r['user_id']) ? $r['user_id'] : null,
    );
}

if ($method === 'GET' && !$id) {
    $rows = $pdo->query(
        "SELECT s.*, (SELECT COUNT(*) FROM inventory i WHERE i.supplier_id = s.id) AS item_count
         FROM suppliers s ORDER BY s.name"
    )->fetchAll();
    $out = array();
    foreach ($rows as $r) $out[] = fmt_supplier($r);
    send($out);
}

if ($method === 'POST') {
    $body = json_body();
    $name = trim(ga($body, 'name', ''));
    if (!$name) send_error('name required');

    $newId = uuid4();
    $status = ga($body, 'status', 'active');
    if (!in_array($status, array('active', 'inactive'), true)) $status = 'active';
    $stmt = $pdo->prepare(
        "INSERT INTO suppliers (id, name, contact_person, phone, email, address, category, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute(array(
        $newId,
        $name,
        ga($body, 'contactPerson', ''),
        ga($body, 'phone', ''),
        ga($body, 'email', ''),
        ga($body, 'address', ''),
        ga($body, 'category', ''),
        ga($body, 'notes', ''),
        $status,
    ));
    $row = $pdo->prepare("SELECT *, 0 AS item_count FROM suppliers WHERE id = ?");
    $row->execute(array($newId));
    send(fmt_supplier($row->fetch()), 201);
}

if ($method === 'PATCH' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);

    $body = json_body();
    $status = ga($body, 'status', $existing['status']);
    if (!in_array($status, array('active', 'inactive'), true)) $status = $existing['status'];
    $merged = array(
        'name' => trim(ga($body, 'name', $existing['name'])),
        'contact_person' => ga($body, 'contactPerson', $existing['contact_person']),
        'phone' => ga($body, 'phone', $existing['phone']),
        'email' => ga($body, 'email', $existing['email']),
        'address' => ga($body, 'address', $existing['address']),
        'category' => ga($body, 'category', $existing['category']),
        'notes' => ga($body, 'notes', $existing['notes']),
        'status' => $status,
    );
    if (!$merged['name']) send_error('name required');
    $upd = $pdo->prepare(
        "UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, address=?, category=?, notes=?, status=? WHERE id = ?"
    );
    $upd->execute(array(
        $merged['name'], $merged['contact_person'], $merged['phone'], $merged['email'],
        $merged['address'], $merged['category'], $merged['notes'], $merged['status'], $id
    ));

    $row = $pdo->prepare(
        "SELECT s.*, (SELECT COUNT(*) FROM inventory i WHERE i.supplier_id = s.id) AS item_count
         FROM suppliers s WHERE s.id = ?"
    );
    $row->execute(array($id));
    send(fmt_supplier($row->fetch()));
}

if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT id FROM suppliers WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    // Detach any inventory items pointing at this supplier rather than
    // blocking the delete — they just lose their preferred-supplier tag.
    $pdo->prepare("UPDATE inventory SET supplier_id = NULL WHERE supplier_id = ?")->execute(array($id));
    $pdo->prepare("DELETE FROM suppliers WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
