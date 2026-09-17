<?php
require_once __DIR__ . '/config/session.php';

// Never let the browser (or an intermediate cache/proxy) serve a stale
// cached copy of the dashboard. Without this, a logged-out visit that
// should redirect to login.php could instead show a cached dashboard page
// straight from disk without the server re-checking the session — and vice
// versa, revisiting after logging back in could show a stale cached
// redirect. Always hit the server so the session check below is accurate.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (empty($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}
$CURRENT_ROLE = $_SESSION['role'];
$CURRENT_USERNAME = $_SESSION['username'];
$CSRF_TOKEN = $_SESSION['csrf_token'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Golden Crust Bakery — Management</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css?v=<?php echo filemtime(__DIR__ . '/assets/style.css'); ?>">
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img class="logo-img" src="assets/logo.jpg" alt="Bakery logo">
      <div>
        <div class="logo-text">Golden Crust Bakery</div>
        <div class="logo-sub"><?php echo htmlspecialchars($CURRENT_USERNAME); ?> · <?php
          echo $CURRENT_ROLE === 'admin' ? 'Admin' : ($CURRENT_ROLE === 'staff' ? 'Staff' : ($CURRENT_ROLE === 'delivery' ? 'Delivery Partner' : ($CURRENT_ROLE === 'supplier' ? 'Supplier' : 'Customer')));
        ?></div>
      </div>
    </div>
    <nav class="sidebar-nav" aria-label="Main navigation" id="sidebar-nav">
      <a class="nav-link" data-route="dashboard"><span class="icon">⊞</span>Dashboard</a>

      <div class="nav-group">
        <button type="button" class="nav-group-header" data-group="orders">Orders<span class="chevron">›</span></button>
        <div class="nav-group-body" data-group-body="orders">
          <a class="nav-link nav-sublink" data-route="new-order"><span class="icon">🧾</span>New Order</a>
          <a class="nav-link nav-sublink" data-route="orders"><span class="icon">🛒</span>Order Details</a>
          <a class="nav-link nav-sublink" data-route="track"><span class="icon">📍</span>Track Order</a>
          <a class="nav-link nav-sublink" data-route="returns"><span class="icon">↩️</span>Returns &amp; Refunds</a>
        </div>
      </div>

      <div class="nav-group">
        <button type="button" class="nav-group-header" data-group="products">Products<span class="chevron">›</span></button>
        <div class="nav-group-body" data-group-body="products">
          <a class="nav-link nav-sublink" data-route="products"><span class="icon">🧁</span>Product Catalog</a>
          <a class="nav-link nav-sublink" data-route="coupons"><span class="icon">🏷️</span>Discounts &amp; Coupons</a>
          <a class="nav-link nav-sublink" data-route="recipes"><span class="icon">📖</span>Recipe Management</a>
          <a class="nav-link nav-sublink" data-route="production"><span class="icon">🥖</span>Production Management</a>
        </div>
      </div>

      <div class="nav-group">
        <button type="button" class="nav-group-header" data-group="inventory">Inventory<span class="chevron">›</span></button>
        <div class="nav-group-body" data-group-body="inventory">
          <a class="nav-link nav-sublink" data-route="inventory"><span class="icon">📦</span>Inventory</a>
          <a class="nav-link nav-sublink" data-route="restock-alerts"><span class="icon">🔔</span>Restock Alerts</a>
        </div>
      </div>

      <div class="nav-group">
        <button type="button" class="nav-group-header" data-group="purchases">Purchases<span class="chevron">›</span></button>
        <div class="nav-group-body" data-group-body="purchases">
          <a class="nav-link nav-sublink" data-route="suppliers"><span class="icon">🚚</span>Suppliers</a>
          <a class="nav-link nav-sublink" data-route="purchase-orders"><span class="icon">📋</span>Purchase Orders</a>
        </div>
      </div>

      <div class="nav-group">
        <button type="button" class="nav-group-header" data-group="business">Business<span class="chevron">›</span></button>
        <div class="nav-group-body" data-group-body="business">
          <a class="nav-link nav-sublink" data-route="customers"><span class="icon">👥</span>Customers</a>
          <a class="nav-link nav-sublink" data-route="billing"><span class="icon">🧾</span>Sales &amp; Billing</a>
          <a class="nav-link nav-sublink" data-route="reports"><span class="icon">📈</span>Reports</a>
        </div>
      </div>

      <div class="nav-group">
        <button type="button" class="nav-group-header" data-group="administration">Administration<span class="chevron">›</span></button>
        <div class="nav-group-body" data-group-body="administration">
          <a class="nav-link nav-sublink" data-route="users"><span class="icon">🔑</span>Users</a>
          <a class="nav-link nav-sublink" data-route="settings"><span class="icon">⚙️</span>Settings</a>
          <a class="nav-link nav-sublink" data-route="training"><span class="icon">🎓</span>Training</a>
        </div>
      </div>
    </nav>
    <div class="sidebar-footer" id="sidebar-date"></div>
  </aside>
  <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

  <div class="main">
    <header class="topbar">
      <button class="btn btn-outline btn-icon" id="btn-sidebar-toggle" title="Menu" aria-label="Toggle menu">☰</button>
      <h1 class="topbar-title" id="topbar-title">Dashboard</h1>
      <div class="topbar-right">
        <div style="position:relative">
          <button class="btn btn-outline" id="btn-notifications" title="Notifications">
            🔔<span id="notif-badge" class="notif-badge" style="display:none">0</span>
          </button>
          <div id="notif-dropdown" class="notif-dropdown" style="display:none"></div>
        </div>
        <button class="btn btn-outline" id="btn-logout" title="Sign out">⎋ Logout</button>
      </div>
    </header>
    <div id="page-content" class="page"></div>
  </div>
</div>

<div class="toast-container" id="toast-container"></div>

<script>
  window.CURRENT_ROLE = <?php echo json_encode($CURRENT_ROLE); ?>;
  window.CSRF_TOKEN = <?php echo json_encode($CSRF_TOKEN); ?>;
  window.CURRENT_USER_ID = <?php echo json_encode($_SESSION['user_id']); ?>;
  window.CURRENT_USERNAME = <?php echo json_encode($CURRENT_USERNAME); ?>;
</script>
<script src="assets/app.js?v=<?php echo filemtime(__DIR__ . '/assets/app.js'); ?>"></script>
</body>
</html>
