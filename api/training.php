<?php
require __DIR__ . '/_bootstrap.php';
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$id = ga($_GET, 'id', null);
$action = ga($_GET, 'action', null);

// Every logged-in role (admin/staff/customer/supplier/delivery) can view
// the training materials aimed at their own role and mark their own
// progress; only admins can create/edit/delete materials, target an
// audience, or see the whole team's completion stats in detail.
$__role = current_role();
if ($method !== 'GET' && !($method === 'PATCH' && $action === 'complete')) {
    require_admin();
}

// Roles whose accounts count towards the "completed by team" denominator
// for a given lesson — i.e. everyone that lesson's audience targets.
function audience_role_list($audience) {
    $roles = array_filter(array_map('trim', explode(',', (string)$audience)));
    return $roles ? $roles : array('admin', 'staff');
}

function audience_count($pdo, $audience) {
    $roles = audience_role_list($audience);
    $placeholders = implode(',', array_fill(0, count($roles), '?'));
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE role IN ($placeholders)");
    $stmt->execute($roles);
    return (int)$stmt->fetchColumn();
}

function fmt_material($m, $userId) {
    $audience = isset($m['audience']) && $m['audience'] !== '' ? $m['audience'] : 'admin,staff';
    return array(
        'id' => $m['id'],
        'title' => $m['title'],
        'category' => $m['category'],
        'audience' => $audience,
        'description' => $m['description'],
        'resourceUrl' => $m['resource_url'],
        'durationMinutes' => (int)$m['duration_minutes'],
        'completedCount' => isset($m['completed_count']) ? (int)$m['completed_count'] : 0,
        'totalStaff' => isset($m['audience_total']) ? (int)$m['audience_total'] : 0,
        'isCompleted' => isset($m['is_completed']) && (int)$m['is_completed'] > 0,
        'createdAt' => $m['created_at'],
    );
}

// Admins see every lesson (so they can manage the full library); every
// other role only sees lessons whose audience list includes their role.
function list_materials($pdo, $userId, $role) {
    if ($role === 'admin') {
        $stmt = $pdo->prepare(
            "SELECT tm.*,
                    (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id) AS completed_count,
                    (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id AND tc.user_id = ?) AS is_completed
             FROM training_materials tm
             ORDER BY tm.created_at DESC"
        );
        $stmt->execute(array($userId));
        $rows = $stmt->fetchAll();
    } else {
        $stmt = $pdo->prepare(
            "SELECT tm.*,
                    (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id) AS completed_count,
                    (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id AND tc.user_id = ?) AS is_completed
             FROM training_materials tm
             WHERE FIND_IN_SET(?, REPLACE(audience, ' ', '')) > 0
             ORDER BY tm.created_at DESC"
        );
        $stmt->execute(array($userId, $role));
        $rows = $stmt->fetchAll();
    }
    $out = array();
    foreach ($rows as $r) {
        $r['audience_total'] = audience_count($pdo, $r['audience']);
        $out[] = fmt_material($r, $userId);
    }
    return $out;
}

// Turns an audience input (array or comma string of roles) into a clean,
// validated comma-separated string. Falls back to admin,staff if empty or
// nothing valid was supplied.
function normalize_audience($raw) {
    $allowed = array('admin', 'staff', 'customer', 'supplier', 'delivery');
    if (is_array($raw)) {
        $roles = $raw;
    } else {
        $roles = explode(',', (string)$raw);
    }
    $roles = array_values(array_unique(array_filter(array_map('trim', $roles), function ($r) use ($allowed) {
        return in_array($r, $allowed, true);
    })));
    return $roles ? implode(',', $roles) : 'admin,staff';
}

// ── GET /api/training.php ────────────────────────────────────────────────
if ($method === 'GET' && !$id) {
    send(array('materials' => list_materials($pdo, $_SESSION['user_id'], $__role)));
}

if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare(
        "SELECT tm.*,
                (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id) AS completed_count,
                (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id AND tc.user_id = ?) AS is_completed
         FROM training_materials tm WHERE tm.id = ?"
    );
    $stmt->execute(array($_SESSION['user_id'], $id));
    $row = $stmt->fetch();
    if (!$row) send_error('Not found', 404);
    // Non-admins can only open lessons targeted at their own role.
    if ($__role !== 'admin' && !in_array($__role, audience_role_list($row['audience']), true)) {
        send_error('Not found', 404);
    }
    $row['audience_total'] = audience_count($pdo, $row['audience']);
    send(fmt_material($row, $_SESSION['user_id']));
}

// ── POST /api/training.php ───────────────────────────────────────────────
// Admin only: add a new training material.
if ($method === 'POST') {
    $body = json_body();
    $title = trim(ga($body, 'title', ''));
    if (!$title) send_error('title is required');

    $newId = uuid4();
    $pdo->prepare(
        "INSERT INTO training_materials (id, title, category, audience, description, resource_url, duration_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )->execute(array(
        $newId,
        $title,
        trim(ga($body, 'category', '')),
        normalize_audience(ga($body, 'audience', 'admin,staff')),
        trim(ga($body, 'description', '')),
        trim(ga($body, 'resourceUrl', '')),
        (int)ga($body, 'durationMinutes', 0),
    ));

    $stmt = $pdo->prepare("SELECT * FROM training_materials WHERE id = ?");
    $stmt->execute(array($newId));
    $row = $stmt->fetch();
    $row['audience_total'] = audience_count($pdo, $row['audience']);
    send(fmt_material($row, $_SESSION['user_id']), 201);
}

// ── PATCH /api/training.php?id=...&action=complete ──────────────────────
// Any staff/admin can mark (or unmark) their own completion of a material
// — no admin check here, since this is a personal progress toggle, not an
// edit to the material itself.
if ($method === 'PATCH' && $id && $action === 'complete') {
    $stmt = $pdo->prepare("SELECT * FROM training_materials WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);
    // Can't mark complete a lesson that isn't even targeted at your role.
    if ($__role !== 'admin' && !in_array($__role, audience_role_list($existing['audience']), true)) {
        send_error('Not found', 404);
    }

    $body = json_body();
    $completed = ga($body, 'completed', true);
    $userId = $_SESSION['user_id'];

    if ($completed) {
        $pdo->prepare(
            "INSERT INTO training_completions (material_id, user_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE completed_at = completed_at"
        )->execute(array($id, $userId));
    } else {
        $pdo->prepare("DELETE FROM training_completions WHERE material_id = ? AND user_id = ?")->execute(array($id, $userId));
    }

    $stmt = $pdo->prepare(
        "SELECT tm.*,
                (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id) AS completed_count,
                (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id AND tc.user_id = ?) AS is_completed
         FROM training_materials tm WHERE tm.id = ?"
    );
    $stmt->execute(array($userId, $id));
    $row = $stmt->fetch();
    $row['audience_total'] = audience_count($pdo, $row['audience']);
    send(fmt_material($row, $userId));
}

// ── PATCH /api/training.php?id=... ───────────────────────────────────────
// Admin only: edit a material's own fields.
if ($method === 'PATCH' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM training_materials WHERE id = ?");
    $stmt->execute(array($id));
    $existing = $stmt->fetch();
    if (!$existing) send_error('Not found', 404);

    $body = json_body();
    $title = trim(ga($body, 'title', $existing['title']));
    if (!$title) send_error('title is required');

    $pdo->prepare(
        "UPDATE training_materials SET title=?, category=?, audience=?, description=?, resource_url=?, duration_minutes=? WHERE id = ?"
    )->execute(array(
        $title,
        trim(ga($body, 'category', $existing['category'])),
        normalize_audience(ga($body, 'audience', $existing['audience'])),
        trim(ga($body, 'description', $existing['description'])),
        trim(ga($body, 'resourceUrl', $existing['resource_url'])),
        (int)ga($body, 'durationMinutes', $existing['duration_minutes']),
        $id,
    ));

    $stmt = $pdo->prepare(
        "SELECT tm.*,
                (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id) AS completed_count,
                (SELECT COUNT(*) FROM training_completions tc WHERE tc.material_id = tm.id AND tc.user_id = ?) AS is_completed
         FROM training_materials tm WHERE tm.id = ?"
    );
    $stmt->execute(array($_SESSION['user_id'], $id));
    $row = $stmt->fetch();
    $row['audience_total'] = audience_count($pdo, $row['audience']);
    send(fmt_material($row, $_SESSION['user_id']));
}

// ── DELETE /api/training.php?id=... ──────────────────────────────────────
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT id FROM training_materials WHERE id = ?");
    $stmt->execute(array($id));
    if (!$stmt->fetch()) send_error('Not found', 404);
    $pdo->prepare("DELETE FROM training_materials WHERE id = ?")->execute(array($id));
    send(array('success' => true));
}

send_error('Unsupported request', 405);
