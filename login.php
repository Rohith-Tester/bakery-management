<?php
require_once __DIR__ . '/config/session.php';
require_once __DIR__ . '/config/db.php';

// Never let the browser (or an intermediate cache/proxy) serve a stale
// cached copy of this page. Without this, clicking the same link again
// after being logged in — or hitting Back — can show a cached login form
// straight from disk without the server ever getting a chance to run the
// "already logged in? go to the dashboard" check below.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

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
<title>Sign in — Golden Crust Bakery</title>
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
  .login-logo .logo-img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .login-logo .logo-text { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: var(--text); white-space: nowrap; }
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
      <img class="logo-img" src="assets/logo.jpg" alt="Bakery logo">
      <div>
        <div class="logo-text">Golden Crust Bakery</div>
        <div class="logo-sub">Sign in to your account</div>
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
        <div class="login-hint" style="text-align:left;margin-top:0">🧁 Registering as a <strong>Customer</strong> — place orders, pay online, and track your own order history.</div>
      </div>
      <div class="form-group">
        <label class="form-label" for="rg-username">Choose a username</label>
        <input class="form-input" id="rg-username" autocomplete="username" minlength="3" maxlength="30" pattern="[A-Za-z0-9._-]+" title="Letters, numbers, dots, dashes and underscores only" required>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label" for="rg-phone">Phone</label>
          <input class="form-input" id="rg-phone" type="tel" autocomplete="tel" placeholder="98765 43210">
        </div>
        <div class="form-group">
          <label class="form-label" for="rg-email">Email</label>
          <input class="form-input" id="rg-email" type="email" autocomplete="email" placeholder="you@example.com">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="rg-password">Choose a password</label>
        <input class="form-input" id="rg-password" type="password" autocomplete="new-password" minlength="8" required>
        <div class="login-hint" style="text-align:left;margin-top:4px" id="rg-password-hint">At least 8 characters, with uppercase, lowercase, a number and a special character.</div>
      </div>
      <div class="form-group">
        <label class="form-label" for="rg-password-confirm">Confirm password</label>
        <input class="form-input" id="rg-password-confirm" type="password" autocomplete="new-password" minlength="8" required>
        <div class="login-hint" style="text-align:left;margin-top:4px;display:none;color:var(--danger)" id="rg-password-match-hint">Passwords do not match</div>
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center" id="register-btn">Create Account</button>
      <div class="login-hint">Staff and admin accounts are created separately by an existing admin — they're never available here.</div>
    </form>
    <div id="bakery-contact-box" style="display:none;margin-top:16px;padding:12px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border);font-size:12.5px;color:var(--text-secondary)"></div>
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
  const password = document.getElementById('rg-password').value;
  const confirmPassword = document.getElementById('rg-password-confirm').value;

  const strengthError = passwordStrengthError(password);
  if (strengthError) {
    errBox.textContent = strengthError;
    errBox.classList.add('show');
    return;
  }
  if (password !== confirmPassword) {
    errBox.textContent = 'Passwords do not match';
    errBox.classList.add('show');
    return;
  }

  submitAuth('api/auth.php?action=register', {
    username: document.getElementById('rg-username').value,
    password: password,
    confirmPassword: confirmPassword,
    phone: document.getElementById('rg-phone').value,
    email: document.getElementById('rg-email').value,
    role: 'customer',
  }, btn, { loading: 'Creating account…', idle: 'Create Account' });
});

// Mirrors the server-side rule in api/_bootstrap.php's validate_password_strength()
// so the person finds out immediately, without a round trip — the server
// re-checks everything regardless, so this is a UX nicety, not the real gate.
function passwordStrengthError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character (e.g. ! @ # $ %)';
  return null;
}

// Live confirm-password hint as the person types, rather than only on submit.
const rgPassword = document.getElementById('rg-password');
const rgConfirm = document.getElementById('rg-password-confirm');
const matchHint = document.getElementById('rg-password-match-hint');
function checkPasswordMatch() {
  if (!rgConfirm.value) { matchHint.style.display = 'none'; return; }
  matchHint.style.display = rgConfirm.value === rgPassword.value ? 'none' : 'block';
}
rgPassword.addEventListener('input', checkPasswordMatch);
rgConfirm.addEventListener('input', checkPasswordMatch);

// Show "call to order" details if the bakery has set them, so anyone who
// doesn't want to (or can't) order online — or even create an account —
// knows they can just call in an order instead.
(async () => {
  try {
    const res = await fetch('api/settings.php');
    const s = await res.json();
    const esc = (str) => String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    if (s.phone || s.email || s.address) {
      const box = document.getElementById('bakery-contact-box');
      box.innerHTML = `
        <div class="font-medium" style="font-size:12.5px;margin-bottom:6px;color:var(--text)">📞 Bakery Contact Details</div>
        <div style="line-height:1.7">
          ${s.phone ? `Phone : <strong style="color:var(--text)">${esc(s.phone)}</strong><br>` : ''}
          ${s.email ? `Email : <strong style="color:var(--text)">${esc(s.email)}</strong><br>` : ''}
          ${s.address ? `Address : <strong style="color:var(--text)">${esc(s.address)}</strong>` : ''}
        </div>`;
      box.style.display = 'block';
    }
  } catch (e) { /* contact box is optional, ignore failures */ }
})();

</script>
</body>
</html>
