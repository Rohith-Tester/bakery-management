<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
require_once __DIR__ . '/config/db.php';

// Already logged in? go straight to the app.
if (!empty($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign in — Bake &amp; Co</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<style>
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg); }
  .login-card {
    width: 380px; max-width: calc(100vw - 32px); background: var(--surface, #fff);
    border: 1px solid var(--border); border-radius: var(--radius, 12px);
    padding: 32px 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.06);
  }
  .login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .login-logo .logo-icon { font-size: 26px; }
  .login-logo .logo-text { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: var(--text); }
  .login-logo .logo-sub { font-size: 11px; color: var(--text-tertiary); }
  .login-error {
    display: none; background: var(--danger-bg); color: var(--danger); font-size: 13px;
    padding: 8px 12px; border-radius: 8px; margin-bottom: 14px;
  }
  .login-error.show { display: block; }
  .login-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: var(--bg); padding: 4px; border-radius: 8px; }
  .login-tab {
    flex: 1; text-align: center; padding: 8px; font-size: 13px; font-weight: 500;
    border-radius: 6px; cursor: pointer; color: var(--text-secondary); user-select: none;
  }
  .login-tab.active { background: var(--surface, #fff); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .login-panel { display: none; }
  .login-panel.active { display: block; }
  .login-hint { margin-top: 14px; font-size: 12px; color: var(--text-tertiary); text-align: center; }
</style>
</head>
<body>
  <div class="login-card">
    <div class="login-logo">
      <div class="logo-icon" role="img" aria-label="Bakery logo">🥐</div>
      <div>
        <div class="logo-text">Bake &amp; Co</div>
        <div class="logo-sub">Staff sign in</div>
      </div>
    </div>

    <div class="login-tabs">
      <div class="login-tab active" data-tab="login">Sign In</div>
      <div class="login-tab" data-tab="register">Register</div>
    </div>

    <div class="login-error" id="login-error"></div>

    <form class="login-panel active" id="login-panel" autocomplete="off">
      <div class="form-group">
        <label class="form-label" for="li-username">Username</label>
        <input class="form-input" id="li-username" autocomplete="username" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="li-password">Password</label>
        <input class="form-input" id="li-password" type="password" autocomplete="current-password" required>
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center" id="login-btn">Sign In</button>
    </form>

    <form class="login-panel" id="register-panel" autocomplete="off">
      <div class="form-group">
        <label class="form-label" for="rg-username">Choose a username</label>
        <input class="form-input" id="rg-username" autocomplete="username" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="rg-password">Choose a password</label>
        <input class="form-input" id="rg-password" type="password" autocomplete="new-password" required>
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center" id="register-btn">Create Account</button>
      <div class="login-hint">New accounts get order-taking access. Ask an admin to grant full access if needed.</div>
    </form>
  </div>

<script>
const tabs = document.querySelectorAll('.login-tab');
const panels = { login: document.getElementById('login-panel'), register: document.getElementById('register-panel') };
const errBox = document.getElementById('login-error');

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  Object.values(panels).forEach(p => p.classList.remove('active'));
  panels[tab.dataset.tab].classList.add('active');
  errBox.classList.remove('show');
}));

async function submitAuth(url, body, btn, btnDefaultText) {
  errBox.classList.remove('show');
  btn.disabled = true;
  btn.textContent = btnDefaultText.loading;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    window.location.href = 'index.php';
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.add('show');
    btn.disabled = false;
    btn.textContent = btnDefaultText.idle;
  }
}

document.getElementById('login-panel').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  submitAuth('api/auth.php?action=login', {
    username: document.getElementById('li-username').value,
    password: document.getElementById('li-password').value,
  }, btn, { loading: 'Signing in…', idle: 'Sign In' });
});

document.getElementById('register-panel').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  submitAuth('api/auth.php?action=register', {
    username: document.getElementById('rg-username').value,
    password: document.getElementById('rg-password').value,
  }, btn, { loading: 'Creating account…', idle: 'Create Account' });
});
</script>
</body>
</html>
