/* Bake & Co — Management (PHP + MySQL edition)
 * Vanilla-JS SPA that talks to the PHP API in /api. No build step required. */

// ── API layer ────────────────────────────────────────────────────────────
const API = 'api';

async function req(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    // Session expired or not logged in — bounce to the login page.
    window.location.href = 'login.php';
    throw new Error('Not authenticated');
  }
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    // The PHP endpoint didn't return valid JSON (likely a PHP warning/notice
    // or fatal error printed before the JSON body). Surface the raw output
    // so it's easy to diagnose instead of a cryptic "not iterable" error.
    throw new Error(`Invalid response from ${url}: ${raw.slice(0, 200) || '(empty response)'}`);
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const api = {
  logout: () => req(`${API}/auth.php?action=logout`, { method: 'POST' }),
  getDashboard: () => req(`${API}/dashboard.php`),

  getOrders: (status) => req(`${API}/orders.php${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`),
  createOrder: (data) => req(`${API}/orders.php`, { method: 'POST', body: data }),
  updateOrderStatus: (id, status) => req(`${API}/orders.php?id=${id}&action=status`, { method: 'PATCH', body: { status } }),
  deleteOrder: (id) => req(`${API}/orders.php?id=${id}`, { method: 'DELETE' }),

  getInventory: () => req(`${API}/inventory.php`),
  createInventoryItem: (data) => req(`${API}/inventory.php`, { method: 'POST', body: data }),
  updateInventoryItem: (id, data) => req(`${API}/inventory.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteInventoryItem: (id) => req(`${API}/inventory.php?id=${id}`, { method: 'DELETE' }),

  getCustomers: () => req(`${API}/customers.php`),
  createCustomer: (data) => req(`${API}/customers.php`, { method: 'POST', body: data }),
  updateCustomer: (id, data) => req(`${API}/customers.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteCustomer: (id) => req(`${API}/customers.php?id=${id}`, { method: 'DELETE' }),

  getInvoices: () => req(`${API}/invoices.php`),
  markInvoicePaid: (id) => req(`${API}/invoices.php?id=${id}&action=pay`, { method: 'PATCH' }),

  trackOrder: (orderNumber) => req(`${API}/track.php?order_number=${encodeURIComponent(orderNumber)}`),

  getUsers: () => req(`${API}/users.php`),
  updateUserRole: (id, role) => req(`${API}/users.php?id=${id}`, { method: 'PATCH', body: { role } }),
  deleteUser: (id) => req(`${API}/users.php?id=${id}`, { method: 'DELETE' }),
};

// ── Small helpers ────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dateStr = (iso) => new Date(iso.replace(' ', 'T')).toLocaleDateString('en-IN');

function toast(message, type = 'default') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

const PILL_LABELS = { pending: 'Pending', baking: 'Baking', ready: 'Ready', delivered: 'Delivered', paid: 'Paid', unpaid: 'Unpaid', good: 'Good', medium: 'Medium', low: 'Low', critical: 'Critical' };
function pill(status) {
  return `<span class="pill pill-${status}">${PILL_LABELS[status] || status}</span>`;
}

const AVATAR_COLORS = [['#EEEDFE', '#534AB7'], ['#E1F5EE', '#0F6E56'], ['#FBEAF0', '#993556'], ['#E6F1FB', '#185FA5'], ['#FAEEDA', '#854F0B'], ['#EAF3DE', '#3B6D11']];
function avatar(name) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const idx = (name ? name.charCodeAt(0) : 0) % AVATAR_COLORS.length;
  const [bg, fg] = AVATAR_COLORS[idx];
  return `<div class="avatar" style="background:${bg};color:${fg}">${esc(initials)}</div>`;
}

function stockBar(quantity, minStock) {
  const max = minStock * 3 || 1;
  const pct = Math.min(100, Math.round((quantity / max) * 100));
  const color = pct < 30 ? '#E24B4A' : pct < 55 ? '#BA7517' : '#639922';
  return `<span class="progress-bar"><span class="progress-fill" style="width:${pct}%;background:${color}"></span></span>`;
}

function emptyState(icon, message) {
  return `<div class="empty-state"><div class="icon">${icon}</div><div>${esc(message)}</div></div>`;
}

function spinner() {
  return `<div style="padding:48px;text-align:center;color:var(--text-tertiary)">Loading…</div>`;
}

// ── Modal ────────────────────────────────────────────────────────────────
function openModal({ title, bodyHtml, footerHtml, onMount }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${esc(title)}</h2>
        <button class="btn btn-outline btn-sm btn-icon" data-close-modal aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  overlay.querySelector('[data-close-modal]').addEventListener('click', closeModal);
  document.body.appendChild(overlay);
  if (onMount) onMount(overlay);
}
function closeModal() {
  const m = $('#active-modal');
  if (m) m.remove();
}

function confirmDialog(message, onConfirm, opts = {}) {
  const label = opts.confirmLabel || 'Delete';
  const btnClass = opts.confirmClass || 'btn-danger';
  openModal({
    title: 'Confirm',
    bodyHtml: `<p style="color:var(--text-secondary)">${esc(message)}</p>`,
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn ${btnClass}" data-confirm>${esc(label)}</button>`,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('[data-confirm]').addEventListener('click', async () => { await onConfirm(); closeModal(); });
    },
  });
}

// ── Router ───────────────────────────────────────────────────────────────
const TITLES = { dashboard: 'Dashboard', orders: 'Orders', inventory: 'Inventory', customers: 'Customers', billing: 'Sales & Billing', track: 'Bake & Co', users: 'Users' };
// Staff accounts can only take/manage orders (and use the public-style
// order tracker); everything else is admin-only.
const STAFF_ALLOWED_ROUTES = ['orders', 'track'];
function isRouteAllowed(route) {
  if (window.CURRENT_ROLE !== 'staff') return true;
  return STAFF_ALLOWED_ROUTES.indexOf(route) !== -1;
}
function defaultRoute() {
  return window.CURRENT_ROLE === 'staff' ? 'orders' : 'dashboard';
}
let pendingNewOrder = false;

function navigate(route) {
  if (!TITLES[route] || !isRouteAllowed(route)) route = defaultRoute();
  window.location.hash = route;
}

function currentRoute() {
  const r = window.location.hash.replace('#', '');
  if (!TITLES[r] || !isRouteAllowed(r)) return defaultRoute();
  return r;
}

async function render() {
  const route = currentRoute();
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  $('#topbar-title').textContent = TITLES[route];
  const content = $('#page-content');
  content.innerHTML = spinner();

  try {
    if (route === 'dashboard') await renderDashboard(content);
    else if (route === 'orders') await renderOrders(content);
    else if (route === 'inventory') await renderInventory(content);
    else if (route === 'customers') await renderCustomers(content);
    else if (route === 'billing') await renderBilling(content);
    else if (route === 'track') await renderTrack(content);
    else if (route === 'users') await renderUsers(content);
  } catch (e) {
    content.innerHTML = `<div class="card" style="padding:24px;color:var(--danger)">Error: ${esc(e.message)}</div>`;
  }
}

window.addEventListener('hashchange', render);

// ── Dashboard ────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

async function renderDashboard(content) {
  const data = await api.getDashboard();
  if (!data || !Array.isArray(data.weeklySales)) {
    throw new Error('Dashboard API returned an unexpected response. Check your PHP error log and config/db.php credentials.');
  }
  const maxSale = Math.max(...data.weeklySales, 1);

  content.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">🛒 Today's Orders</div>
        <div class="metric-value">${data.todayOrders}</div>
        <div class="metric-change up">↑ 12% vs yesterday</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">₹ Revenue</div>
        <div class="metric-value">₹${inr(data.todayRevenue)}</div>
        <div class="metric-change up">↑ 8% this week</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">👥 Customers</div>
        <div class="metric-value">${data.totalCustomers}</div>
        <div class="metric-change up">↑ 5 new today</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">⚠️ Low Stock</div>
        <div class="metric-value" style="color:${data.lowStockCount > 0 ? 'var(--danger)' : 'var(--text)'}">${data.lowStockCount}</div>
        <div class="metric-change down">${data.lowStockCount > 0 ? 'items need restock' : 'All stocked up'}</div>
      </div>
    </div>

    <div class="card mb-6">
      <div class="card-header">
        <span class="card-title">Weekly Revenue</span>
        <span class="text-muted text-sm">Mon – Sun</span>
      </div>
      <div class="card-body" style="padding-top:10px">
        <div class="simple-bar-chart">
          ${data.weeklySales.map((v, i) => `
            <div class="simple-bar-col" title="₹${inr(v)}">
              <div class="simple-bar" style="height:${Math.round((v / maxSale) * 160)}px"></div>
              <div class="simple-bar-label">${DAYS[i]}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Orders</span></div>
        <div>
          ${data.recentOrders.length ? data.recentOrders.map(o => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 20px;border-bottom:1px solid var(--border)">
              <div>
                <div class="font-medium" style="font-size:13px">${esc(o.customerName)}</div>
                <div class="text-muted text-sm mt-1">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                ${pill(o.status)}
                <span class="text-sm text-muted">₹${inr(o.total)}</span>
              </div>
            </div>`).join('') : emptyState('🛒', 'No orders yet')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-primary" style="justify-content:center" id="qa-new-order">+ Create New Order</button>
          <a class="btn btn-outline" style="justify-content:center;text-decoration:none" data-route-link="inventory">📦 Check Inventory</a>
          <a class="btn btn-outline" style="justify-content:center;text-decoration:none" data-route-link="billing">🧾 View Invoices</a>
          <a class="btn btn-outline" style="justify-content:center;text-decoration:none" data-route-link="customers">👥 Manage Customers</a>
        </div>
      </div>
    </div>`;

  $('#qa-new-order').addEventListener('click', () => { navigate('orders'); pendingNewOrder = true; });
  $$('[data-route-link]', content).forEach(a => a.addEventListener('click', () => navigate(a.dataset.routeLink)));
}

// ── Orders ───────────────────────────────────────────────────────────────
const STATUSES = ['all', 'pending', 'baking', 'ready', 'delivered'];
const MENU = [
  { name: 'Croissant', price: 120 }, { name: 'Sourdough Loaf', price: 580 },
  { name: 'Birthday Cake', price: 1200 }, { name: 'Cookies (doz)', price: 960 },
  { name: 'Muffin', price: 90 }, { name: 'Brownie', price: 80 },
  { name: 'Cupcake', price: 70 }, { name: 'Cheesecake', price: 850 },
  { name: 'Baguette', price: 280 }, { name: 'Cinnamon Roll', price: 150 },
];

let ordersState = { activeTab: 'all', orders: [], customers: [] };

function openOrderModal(onSaved) {
  let form = { customerId: '', customerName: '', items: [{ name: '', qty: 1, price: 0 }], paymentMethod: 'offline' };

  const bodyHtml = () => `
    <div class="form-group">
      <label class="form-label">Customer</label>
      <select class="form-input" id="ord-customer">
        <option value="">Select existing customer…</option>
        ${ordersState.customers.map(c => `<option value="${c.id}" ${form.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
      ${!form.customerId ? `<input class="form-input" style="margin-top:8px" id="ord-customer-name" placeholder="Or type customer name" value="${esc(form.customerName)}">` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">Items</label>
      <div id="ord-items">
        ${form.items.map((item, i) => `
          <div class="form-row cols-3" style="margin-bottom:8px" data-item-row="${i}">
            <select class="form-input" data-item-name="${i}">
              <option value="">Select item…</option>
              ${MENU.map(m => `<option value="${esc(m.name)}" ${item.name === m.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
            <input type="number" class="form-input" min="1" placeholder="Qty" value="${item.qty}" data-item-qty="${i}">
            <div style="display:flex;gap:6px">
              <input type="number" class="form-input" placeholder="₹ Price" value="${item.price}" data-item-price="${i}">
              ${form.items.length > 1 ? `<button class="btn btn-danger btn-sm btn-icon" data-remove-item="${i}">✕</button>` : ''}
            </div>
          </div>`).join('')}
      </div>
      <button class="btn btn-outline btn-sm" id="ord-add-item">+ Add Item</button>
    </div>
    <div class="form-group">
      <label class="form-label">Payment Method</label>
      <div style="display:flex;gap:10px">
        <label class="btn ${form.paymentMethod === 'offline' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
          <input type="radio" name="ord-payment" value="offline" data-payment-method style="margin-right:6px" ${form.paymentMethod === 'offline' ? 'checked' : ''}> Cash / Offline
        </label>
        <label class="btn ${form.paymentMethod === 'online' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
          <input type="radio" name="ord-payment" value="online" data-payment-method style="margin-right:6px" ${form.paymentMethod === 'online' ? 'checked' : ''}> Online (UPI/QR)
        </label>
      </div>
      ${form.paymentMethod === 'online' ? `
      <div style="margin-top:12px;padding:16px;border:1px solid var(--border);border-radius:var(--radius-sm,8px);text-align:center;background:var(--bg)">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('upi://pay?pa=bakeandco@upi&pn=Bake%20And%20Co&am=' + form.items.reduce((s, i) => s + (i.price * i.qty || 0), 0) + '&cu=INR')}"
             alt="Scan to pay QR code" width="160" height="160" style="border-radius:6px">
        <div style="font-size:12.5px;color:var(--text-secondary);margin-top:8px">Scan with any UPI app to pay <strong>₹${inr(form.items.reduce((s, i) => s + (i.price * i.qty || 0), 0))}</strong></div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">Demo QR — not a real payment gateway</div>
      </div>` : ''}
    </div>
    <div style="padding:12px 0;border-top:1px solid var(--border);margin-top:8px">
      <strong>Total: ₹${inr(form.items.reduce((s, i) => s + (i.price * i.qty || 0), 0))}</strong>
    </div>`;

  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="ord-save">Create Order</button>`;

  const rerender = (overlay) => {
    overlay.querySelector('.modal-body').innerHTML = bodyHtml();
    wire(overlay);
  };

  const wire = (overlay) => {
    const customerSel = overlay.querySelector('#ord-customer');
    customerSel.addEventListener('change', () => {
      const cust = ordersState.customers.find(c => c.id === customerSel.value);
      form.customerId = customerSel.value;
      form.customerName = cust ? cust.name : '';
      rerender(overlay);
    });
    const nameInput = overlay.querySelector('#ord-customer-name');
    if (nameInput) nameInput.addEventListener('input', (e) => { form.customerName = e.target.value; });

    $$('[data-item-name]', overlay).forEach(sel => sel.addEventListener('change', (e) => {
      const i = +e.target.dataset.itemName;
      form.items[i].name = e.target.value;
      const menuItem = MENU.find(m => m.name === e.target.value);
      if (menuItem) form.items[i].price = menuItem.price;
      rerender(overlay);
    }));
    $$('[data-item-qty]', overlay).forEach(inp => inp.addEventListener('input', (e) => {
      form.items[+e.target.dataset.itemQty].qty = Number(e.target.value) || 0;
    }));
    $$('[data-item-price]', overlay).forEach(inp => inp.addEventListener('input', (e) => {
      form.items[+e.target.dataset.itemPrice].price = Number(e.target.value) || 0;
    }));
    $$('[data-remove-item]', overlay).forEach(btn => btn.addEventListener('click', (e) => {
      form.items.splice(+e.target.dataset.removeItem, 1);
      rerender(overlay);
    }));
    overlay.querySelector('#ord-add-item').addEventListener('click', () => {
      form.items.push({ name: '', qty: 1, price: 0 });
      rerender(overlay);
    });
    $$('[data-payment-method]', overlay).forEach(radio => radio.addEventListener('change', (e) => {
      form.paymentMethod = e.target.value;
      rerender(overlay);
    }));
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('#ord-save').addEventListener('click', async () => {
      if (!form.customerName) return toast('Customer name required', 'error');
      const items = form.items.filter(i => i.name);
      if (!items.some(i => i.name && i.price > 0)) return toast('Add at least one item', 'error');
      try {
        await api.createOrder({ customerName: form.customerName, customerId: form.customerId || null, items, paymentMethod: form.paymentMethod });
        toast('Order created!', 'success');
        closeModal();
        onSaved();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  openModal({ title: 'New Order', bodyHtml: bodyHtml(), footerHtml, onMount: wire });
}

async function renderOrders(content) {
  const [orders, customers] = await Promise.all([api.getOrders(), api.getCustomers()]);
  ordersState.orders = orders; ordersState.customers = customers;

  const draw = () => {
    const filtered = ordersState.activeTab === 'all' ? ordersState.orders : ordersState.orders.filter(o => o.status === ordersState.activeTab);
    const counts = STATUSES.reduce((acc, s) => { acc[s] = s === 'all' ? ordersState.orders.length : ordersState.orders.filter(o => o.status === s).length; return acc; }, {});

    content.innerHTML = `
      <div class="tab-row">
        ${STATUSES.map(s => `<button class="btn ${ordersState.activeTab === s ? 'btn-primary' : 'btn-outline'} btn-sm" data-tab="${s}">${s[0].toUpperCase() + s.slice(1)} (${counts[s]})</button>`).join('')}
      </div>
      <div class="card">
        ${filtered.length === 0 ? emptyState('🛒', 'No orders found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(o => `
                <tr>
                  <td><span class="font-medium">${esc(o.orderNumber)}</span></td>
                  <td>${esc(o.customerName)}</td>
                  <td style="color:var(--text-secondary);max-width:200px">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</td>
                  <td class="font-medium">₹${inr(o.total)}</td>
                  <td>${o.paymentMethod === 'online' ? '<span class="pill pill-paid">Online</span>' : '<span class="pill pill-unpaid">Offline</span>'}</td>
                  <td>${pill(o.status)}</td>
                  <td class="text-muted">${dateStr(o.createdAt)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      ${o.status !== 'delivered' ? `
                        <select class="form-input" style="padding:4px 8px;font-size:12px;width:auto" data-status-select="${o.id}">
                          ${['pending', 'baking', 'ready', 'delivered'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
                        </select>` : ''}
                      ${window.CURRENT_ROLE !== 'staff' ? `<button class="btn btn-danger btn-sm btn-icon" data-delete-order="${o.id}" title="Delete">✕</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $$('[data-tab]', content).forEach(btn => btn.addEventListener('click', () => { ordersState.activeTab = btn.dataset.tab; draw(); }));
    $$('[data-status-select]', content).forEach(sel => sel.addEventListener('change', async (e) => {
      try {
        await api.updateOrderStatus(e.target.dataset.statusSelect, e.target.value);
        toast(`Order marked as ${e.target.value}`, 'success');
        ordersState.orders = await api.getOrders();
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-delete-order]', content).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.deleteOrder;
      confirmDialog('Delete this order? This cannot be undone.', async () => {
        try {
          await api.deleteOrder(id);
          toast('Order deleted', 'success');
          ordersState.orders = await api.getOrders();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();

  if (pendingNewOrder) {
    pendingNewOrder = false;
    openOrderModal(async () => { ordersState.orders = await api.getOrders(); draw(); });
  }
}

// ── Inventory ────────────────────────────────────────────────────────────
let inventoryState = { items: [], search: '' };

function openInventoryModal(item, onSaved) {
  const form = item ? { ...item } : { name: '', quantity: '', unit: 'kg', minStock: '', costPerUnit: '' };
  const bodyHtml = `
    <div class="form-group">
      <label class="form-label">Item name</label>
      <input class="form-input" id="inv-name" value="${esc(form.name)}" placeholder="e.g. All-purpose Flour">
    </div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input type="number" class="form-input" id="inv-qty" value="${form.quantity}" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Unit</label>
        <select class="form-input" id="inv-unit">
          ${['kg', 'g', 'L', 'ml', 'pcs', 'doz', 'pack'].map(u => `<option value="${u}" ${form.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">Min stock (reorder level)</label>
        <input type="number" class="form-input" id="inv-min" value="${form.minStock}" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Cost per unit (₹)</label>
        <input type="number" class="form-input" id="inv-cost" value="${form.costPerUnit}" placeholder="0">
      </div>
    </div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="inv-save">Save</button>`;

  openModal({
    title: item ? 'Edit Item' : 'Add Inventory Item',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#inv-save').addEventListener('click', async () => {
        const name = overlay.querySelector('#inv-name').value.trim();
        const quantity = overlay.querySelector('#inv-qty').value;
        if (!name || quantity === '') return toast('Name and quantity required', 'error');
        const payload = {
          name, quantity,
          unit: overlay.querySelector('#inv-unit').value,
          minStock: overlay.querySelector('#inv-min').value,
          costPerUnit: overlay.querySelector('#inv-cost').value,
        };
        try {
          if (item) await api.updateInventoryItem(item.id, payload);
          else await api.createInventoryItem(payload);
          toast(item ? 'Item updated!' : 'Item added!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function renderInventory(content) {
  inventoryState.items = await api.getInventory();

  const draw = () => {
    const filtered = inventoryState.items.filter(i => i.name.toLowerCase().includes(inventoryState.search.toLowerCase()));
    const low = inventoryState.items.filter(i => i.status === 'low' || i.status === 'critical').length;
    const totalValue = inventoryState.items.reduce((s, i) => s + i.quantity * i.costPerUnit, 0);

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Total SKUs</div><div class="metric-value">${inventoryState.items.length}</div></div>
        <div class="metric-card">
          <div class="metric-label">Low / Critical</div>
          <div class="metric-value" style="color:${low > 0 ? 'var(--danger)' : 'var(--text)'}">${low}</div>
          <div class="metric-change down">${low > 0 ? 'need restock' : ''}</div>
        </div>
        <div class="metric-card"><div class="metric-label">Total value</div><div class="metric-value">₹${inr(totalValue)}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">All Ingredients</span>
          <div style="display:flex;gap:10px">
            <div class="search-bar"><span>🔍</span><input id="inv-search" placeholder="Search…" value="${esc(inventoryState.search)}"></div>
            <button class="btn btn-primary" id="inv-add">+ Add Item</button>
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('📦', 'No inventory items') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Min Stock</th><th>Stock Level</th><th>Status</th><th>Value</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(item => `
                <tr>
                  <td class="font-medium">${esc(item.name)}</td>
                  <td>${item.quantity}</td>
                  <td class="text-muted">${esc(item.unit)}</td>
                  <td class="text-muted">${item.minStock} ${esc(item.unit)}</td>
                  <td>${stockBar(item.quantity, item.minStock)}</td>
                  <td>${pill(item.status)}</td>
                  <td class="text-muted">₹${inr(item.quantity * item.costPerUnit)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-edit-item="${item.id}">Edit</button>
                      <button class="btn btn-danger btn-sm btn-icon" data-delete-item="${item.id}">✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $('#inv-search', content).addEventListener('input', (e) => { inventoryState.search = e.target.value; draw(); });
    $('#inv-add', content).addEventListener('click', () => openInventoryModal(null, async () => { inventoryState.items = await api.getInventory(); draw(); }));
    $$('[data-edit-item]', content).forEach(btn => btn.addEventListener('click', () => {
      const item = inventoryState.items.find(i => i.id === btn.dataset.editItem);
      openInventoryModal(item, async () => { inventoryState.items = await api.getInventory(); draw(); });
    }));
    $$('[data-delete-item]', content).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.deleteItem;
      confirmDialog('Remove this item from inventory?', async () => {
        try {
          await api.deleteInventoryItem(id);
          toast('Item removed', 'success');
          inventoryState.items = await api.getInventory();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Customers ────────────────────────────────────────────────────────────
let customersState = { list: [], search: '' };

function openCustomerModal(customer, onSaved) {
  const form = customer ? { ...customer } : { name: '', email: '', phone: '' };
  const bodyHtml = `
    <div class="form-group"><label class="form-label">Full name</label><input class="form-input" id="cust-name" value="${esc(form.name)}" placeholder="e.g. Priya Sharma"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="cust-email" value="${esc(form.email)}" placeholder="email@example.com"></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="cust-phone" value="${esc(form.phone)}" placeholder="98XXXXXXXX"></div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="cust-save">Save</button>`;

  openModal({
    title: customer ? 'Edit Customer' : 'Add Customer',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#cust-save').addEventListener('click', async () => {
        const name = overlay.querySelector('#cust-name').value.trim();
        if (!name) return toast('Name required', 'error');
        const payload = { name, email: overlay.querySelector('#cust-email').value, phone: overlay.querySelector('#cust-phone').value };
        try {
          if (customer) await api.updateCustomer(customer.id, payload);
          else await api.createCustomer(payload);
          toast(customer ? 'Customer updated!' : 'Customer added!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function renderCustomers(content) {
  customersState.list = await api.getCustomers();

  const draw = () => {
    const filtered = customersState.list.filter(c =>
      c.name.toLowerCase().includes(customersState.search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(customersState.search.toLowerCase()));
    const totalOrders = customersState.list.reduce((s, c) => s + c.totalOrders, 0);
    const topSpender = [...customersState.list].sort((a, b) => b.totalSpend - a.totalSpend)[0];

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Total Customers</div><div class="metric-value">${customersState.list.length}</div></div>
        <div class="metric-card"><div class="metric-label">Total Orders</div><div class="metric-value">${totalOrders}</div></div>
        <div class="metric-card">
          <div class="metric-label">Top Spender</div>
          <div class="metric-value" style="font-size:18px">${topSpender ? esc(topSpender.name.split(' ')[0]) : '—'}</div>
          <div class="metric-change">${topSpender ? `₹${inr(topSpender.totalSpend)}` : ''}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">All Customers</span>
          <div style="display:flex;gap:10px">
            <div class="search-bar"><span>🔍</span><input id="cust-search" placeholder="Search…" value="${esc(customersState.search)}"></div>
            <button class="btn btn-primary" id="cust-add">+ Add Customer</button>
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('👥', 'No customers found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Total Spend</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(c => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:10px">${avatar(c.name)}<span class="font-medium">${esc(c.name)}</span></div></td>
                  <td class="text-muted">${esc(c.email) || '—'}</td>
                  <td class="text-muted">${esc(c.phone) || '—'}</td>
                  <td>${c.totalOrders}</td>
                  <td class="font-medium">₹${inr(c.totalSpend)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-edit-cust="${c.id}">Edit</button>
                      <button class="btn btn-danger btn-sm btn-icon" data-delete-cust="${c.id}">✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $('#cust-search', content).addEventListener('input', (e) => { customersState.search = e.target.value; draw(); });
    $('#cust-add', content).addEventListener('click', () => openCustomerModal(null, async () => { customersState.list = await api.getCustomers(); draw(); }));
    $$('[data-edit-cust]', content).forEach(btn => btn.addEventListener('click', () => {
      const c = customersState.list.find(x => x.id === btn.dataset.editCust);
      openCustomerModal(c, async () => { customersState.list = await api.getCustomers(); draw(); });
    }));
    $$('[data-delete-cust]', content).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.deleteCust;
      confirmDialog('Remove this customer? Their order history will remain.', async () => {
        try {
          await api.deleteCustomer(id);
          toast('Customer removed', 'success');
          customersState.list = await api.getCustomers();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Users (admin only) ──────────────────────────────────────────────────
let usersState = { list: [] };

async function renderUsers(content) {
  usersState.list = await api.getUsers();

  const draw = () => {
    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Accounts</span>
        </div>
        ${usersState.list.length === 0 ? emptyState('🔑', 'No accounts found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${usersState.list.map(u => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:10px">${avatar(u.username)}<span class="font-medium">${esc(u.username)}</span>${u.id === window.CURRENT_USER_ID ? '<span class="text-muted" style="font-size:11px">(you)</span>' : ''}</div></td>
                  <td>${u.role === 'admin' ? '<span class="pill pill-paid">Admin</span>' : '<span class="pill pill-unpaid">Staff</span>'}</td>
                  <td class="text-muted">${dateStr(u.createdAt)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      ${u.role === 'staff'
                        ? `<button class="btn btn-outline btn-sm" data-set-role="${u.id}" data-role="admin">Make Admin</button>`
                        : `<button class="btn btn-outline btn-sm" data-set-role="${u.id}" data-role="staff">Make Staff</button>`}
                      <button class="btn btn-danger btn-sm btn-icon" data-delete-user="${u.id}" title="Delete" ${u.id === window.CURRENT_USER_ID ? 'disabled' : ''}>✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
      <p class="text-muted" style="font-size:12.5px;margin-top:12px">New accounts sign themselves up from the login page's Register tab as Staff. Promote them to Admin here for full access.</p>`;

    $$('[data-set-role]', content).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.setRole;
      const role = btn.dataset.role;
      confirmDialog(`Change this user's role to ${role === 'admin' ? 'Admin' : 'Staff'}?`, async () => {
        try {
          await api.updateUserRole(id, role);
          toast('Role updated', 'success');
          usersState.list = await api.getUsers();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      }, { confirmLabel: 'Confirm', confirmClass: 'btn-primary' });
    }));
    $$('[data-delete-user]', content).forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const id = btn.dataset.deleteUser;
      confirmDialog('Delete this account? They will no longer be able to sign in.', async () => {
        try {
          await api.deleteUser(id);
          toast('Account deleted', 'success');
          usersState.list = await api.getUsers();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}


let billingState = { filter: 'all' };

async function renderBilling(content) {
  const data = await api.getInvoices();

  const draw = () => {
    const filtered = billingState.filter === 'all' ? data.invoices : data.invoices.filter(i => i.status === billingState.filter);
    content.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">💰 Total Revenue</div>
          <div class="metric-value">₹${inr(data.totalRevenue)}</div>
          <div class="metric-change up">All time</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">⏳ Pending</div>
          <div class="metric-value" style="color:${data.pendingRevenue > 0 ? 'var(--warning)' : 'var(--text)'}">₹${inr(data.pendingRevenue)}</div>
          <div class="metric-change down">${data.invoices.filter(i => i.status === 'unpaid').length} invoices</div>
        </div>
        <div class="metric-card"><div class="metric-label">📊 Avg Order Value</div><div class="metric-value">₹${inr(data.avgOrderValue)}</div></div>
        <div class="metric-card">
          <div class="metric-label">🧾 Total Invoices</div>
          <div class="metric-value">${data.invoices.length}</div>
          <div class="metric-change">${data.invoices.filter(i => i.status === 'paid').length} paid</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Invoices</span>
          <div style="display:flex;gap:8px">
            ${['all', 'paid', 'unpaid'].map(f => `<button class="btn btn-sm ${billingState.filter === f ? 'btn-primary' : 'btn-outline'}" data-inv-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('🧾', 'No invoices found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${filtered.map(inv => `
                <tr>
                  <td class="font-medium" style="color:var(--brand)">${esc(inv.invoiceNumber)}</td>
                  <td class="text-muted">${esc(inv.orderNumber)}</td>
                  <td>${esc(inv.customerName)}</td>
                  <td class="text-muted">${dateStr(inv.createdAt)}</td>
                  <td class="font-medium">₹${inr(inv.amount)}</td>
                  <td>${pill(inv.status)}</td>
                  <td>${inv.status === 'unpaid'
                    ? `<button class="btn btn-outline btn-sm" style="color:var(--success);border-color:var(--success)" data-mark-paid="${inv.id}">Mark Paid</button>`
                    : `<span class="text-muted text-sm">✓ Settled</span>`}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $$('[data-inv-filter]', content).forEach(btn => btn.addEventListener('click', () => { billingState.filter = btn.dataset.invFilter; draw(); }));
    $$('[data-mark-paid]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api.markInvoicePaid(btn.dataset.markPaid);
        toast('Invoice marked as paid!', 'success');
        Object.assign(data, await api.getInvoices());
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }));
  };

  draw();
}

// ── Track Order ──────────────────────────────────────────────────────────
const STEP_ICONS = {
  pending: { icon: '📋', desc: 'Your order has been received and is queued.' },
  baking: { icon: '🔥', desc: 'Our bakers are working on your order right now!' },
  ready: { icon: '✅', desc: 'Your order is ready and waiting for pickup / delivery.' },
  delivered: { icon: '🎉', desc: 'Order delivered. Enjoy every bite!' },
};

function timelineHtml(timeline) {
  return `<div style="padding:8px 0 0">
    ${timeline.map((step, idx) => {
      const meta = STEP_ICONS[step.step] || {};
      const isLast = idx === timeline.length - 1;
      return `
      <div style="display:flex;gap:16px">
        <div style="display:flex;flex-direction:column;align-items:center;width:36px">
          <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;
            background:${step.completed ? (step.active ? 'var(--accent,#4CAF50)' : '#e8f5e9') : '#f5f5f5'};
            border:${step.active ? '2px solid var(--accent,#4CAF50)' : step.completed ? '2px solid #a5d6a7' : '2px solid var(--border)'};
            box-shadow:${step.active ? '0 0 0 4px rgba(76,175,80,0.15)' : 'none'};">
            ${meta.icon || ''}
          </div>
          ${!isLast ? `<div style="width:2px;flex:1;min-height:24px;background:${step.completed ? 'var(--accent,#4CAF50)' : 'var(--border)'};margin:4px 0"></div>` : ''}
        </div>
        <div style="padding-bottom:${isLast ? 0 : 24}px;padding-top:4px">
          <div style="font-weight:${step.active ? 700 : 600};font-size:15px;color:${step.completed ? 'var(--text)' : 'var(--text-tertiary)'}">
            ${esc(step.label)}
            ${step.active ? `<span style="margin-left:8px;font-size:11px;font-weight:600;background:var(--accent,#4CAF50);color:#fff;border-radius:999px;padding:2px 8px;vertical-align:middle">CURRENT</span>` : ''}
          </div>
          ${step.active ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${esc(meta.desc || '')}</div>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function renderTrack(content) {
  content.innerHTML = `
    <div class="page" style="max-width:600px;margin:0 auto;padding:0">
      <div style="margin-bottom:28px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:4px">📦 Track Your Order</h1>
        <p style="color:var(--text-secondary);font-size:14px">Enter your order number to see the current status and progress.</p>
      </div>
      <div class="card" style="padding:20px;margin-bottom:24px">
        <div style="display:flex;gap:10px">
          <input class="form-input" style="flex:1;font-size:15px" id="track-input" placeholder="e.g. ORD-003">
          <button class="btn btn-primary" id="track-btn" style="min-width:96px">Track</button>
        </div>
        <div id="track-error"></div>
      </div>
      <div id="track-result"></div>
    </div>`;

  const input = $('#track-input', content);
  const errorBox = $('#track-error', content);
  const resultBox = $('#track-result', content);
  const btn = $('#track-btn', content);

  const doSearch = async () => {
    const q = input.value.trim();
    errorBox.innerHTML = '';
    resultBox.innerHTML = '';
    if (!q) { errorBox.innerHTML = `<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:13px;border:1px solid #fecaca">Please enter an order number.</div>`; return; }
    btn.disabled = true; btn.textContent = 'Searching…';
    try {
      const result = await api.trackOrder(q);
      resultBox.innerHTML = `
        <div class="card" style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-size:20px;font-weight:700">${esc(result.orderNumber)}</div>
              <div style="color:var(--text-secondary);font-size:13px;margin-top:2px">${esc(result.customerName)} &nbsp;·&nbsp; ${new Date(result.createdAt.replace(' ', 'T')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
            <span class="pill pill-${result.status}" style="font-size:13px">${result.status[0].toUpperCase() + result.status.slice(1)}</span>
          </div>
          <div style="margin-bottom:20px">
            <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Items Ordered</div>
            ${result.items.map((item, i) => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:${i < result.items.length - 1 ? '1px solid var(--border)' : 'none'};font-size:14px">
                <span>${item.qty}× ${esc(item.name)}</span>
                <span style="color:var(--text-secondary)">₹${inr(item.qty * item.price)}</span>
              </div>`).join('')}
            <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:700;font-size:15px">
              <span>Total</span><span>₹${inr(result.total)}</span>
            </div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px">Order Progress</div>
            ${timelineHtml(result.timeline)}
          </div>
        </div>`;
    } catch (e) {
      errorBox.innerHTML = `<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:13px;border:1px solid #fecaca">Order not found. Please check the order number and try again.</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Track';
    }
  };

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
}

// ── App bootstrap ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.CURRENT_ROLE === 'staff') {
    $$('.nav-link').forEach(a => {
      if (STAFF_ALLOWED_ROUTES.indexOf(a.dataset.route) === -1) a.style.display = 'none';
    });
  }
  $$('.nav-link').forEach(a => a.addEventListener('click', () => navigate(a.dataset.route)));
  $('#btn-new-order').addEventListener('click', () => {
    pendingNewOrder = true;
    if (currentRoute() === 'orders') { pendingNewOrder = false; openOrderModal(async () => { ordersState.orders = await api.getOrders(); render(); }); }
    else navigate('orders');
  });
  $('#sidebar-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  $('#btn-logout').addEventListener('click', () => {
    confirmDialog('Sign out of Bake & Co?', async () => {
      try { await api.logout(); } catch (e) { /* ignore */ }
      window.location.href = 'login.php';
    });
  });
  render();
});
