<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}
$CURRENT_ROLE = $_SESSION['role'];
$CURRENT_USERNAME = $_SESSION['username'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bake &amp; Co — Management</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon" role="img" aria-label="Bakery logo">🥐</div>
      <div>
        <div class="logo-text">Bake &amp; Co</div>
        <div class="logo-sub"><?php echo htmlspecialchars($CURRENT_USERNAME); ?> · <?php echo $CURRENT_ROLE === 'admin' ? 'Admin' : 'Staff'; ?></div>
      </div>
    </div>
    <nav class="sidebar-nav" aria-label="Main navigation" id="sidebar-nav">
      <div class="nav-section-label">Menu</div>
      <a class="nav-link" data-route="dashboard"><span class="icon">⊞</span>Dashboard</a>
      <a class="nav-link" data-route="orders"><span class="icon">🛒</span>Orders</a>
      <a class="nav-link" data-route="inventory"><span class="icon">📦</span>Inventory</a>
      <a class="nav-link" data-route="customers"><span class="icon">👥</span>Customers</a>
      <a class="nav-link" data-route="billing"><span class="icon">🧾</span>Sales &amp; Billing</a>
      <a class="nav-link" data-route="track"><span class="icon">📍</span>Track Order</a>
      <a class="nav-link" data-route="users"><span class="icon">🔑</span>Users</a>
    </nav>
    <div class="sidebar-footer" id="sidebar-date"></div>
  </aside>

  <div class="main">
    <header class="topbar">
      <h1 class="topbar-title" id="topbar-title">Dashboard</h1>
      <div class="topbar-right">
        <button class="btn btn-primary" id="btn-new-order">+ New Order</button>
        <button class="btn btn-outline" id="btn-logout" title="Sign out">⎋ Logout</button>
      </div>
    </header>
    <div id="page-content" class="page"></div>
  </div>
</div>

<div class="toast-container" id="toast-container"></div>

<script>
  window.CURRENT_ROLE = <?php echo json_encode($CURRENT_ROLE); ?>;
  window.CURRENT_USER_ID = <?php echo json_encode($_SESSION['user_id']); ?>;
</script>
<script src="assets/app.js"></script>
</body>
</html>
