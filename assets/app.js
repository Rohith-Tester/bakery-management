/* Golden Crust Bakery — Management (PHP + MySQL edition)
 * Vanilla-JS SPA that talks to the PHP API in /api. No build step required. */

// ── API layer ────────────────────────────────────────────────────────────
const API = 'api';

async function req(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json' };
  // CSRF token (set on window by index.php from the session) must ride
  // along with every state-changing call — see the check in
  // api/_bootstrap.php. GET requests don't need it (they don't mutate).
  if (method !== 'GET' && window.CSRF_TOKEN) headers['X-CSRF-Token'] = window.CSRF_TOKEN;
  const res = await fetch(url, {
    headers,
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
  getProfile: () => req(`${API}/auth.php?action=profile`),
  getDashboard: () => req(`${API}/dashboard.php`),

  getOrders: (status) => req(`${API}/orders.php${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`),
  createOrder: (data) => req(`${API}/orders.php`, { method: 'POST', body: data }),
  createPayment: (data) => req(`${API}/payments.php?action=create`, { method: 'POST', body: data }),
  updateOrderStatus: (id, status, otp) => req(`${API}/orders.php?id=${id}&action=status`, { method: 'PATCH', body: otp ? { status, otp } : { status } }),
  regenerateOrderOtp: (id) => req(`${API}/orders.php?id=${id}&action=regenerate-otp`, { method: 'PATCH', body: {} }),
  deleteOrder: (id) => req(`${API}/orders.php?id=${id}`, { method: 'DELETE' }),

  getReturns: (status) => req(`${API}/returns.php${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`),
  createReturn: (data) => req(`${API}/returns.php`, { method: 'POST', body: data }),
  updateReturnStatus: (id, body) => req(`${API}/returns.php?id=${id}&action=status`, { method: 'PATCH', body }),
  regenerateReturnOtp: (id) => req(`${API}/returns.php?id=${id}&action=regenerate-otp`, { method: 'PATCH', body: {} }),
  assignReturnPickupPartner: (id, body) => req(`${API}/returns.php?id=${id}&action=pickup-partner`, { method: 'PATCH', body }),

  getInventory: () => req(`${API}/inventory.php`),
  createInventoryItem: (data) => req(`${API}/inventory.php`, { method: 'POST', body: data }),
  updateInventoryItem: (id, data) => req(`${API}/inventory.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteInventoryItem: (id) => req(`${API}/inventory.php?id=${id}`, { method: 'DELETE' }),

  getSuppliers: () => req(`${API}/suppliers.php`),
  createSupplier: (data) => req(`${API}/suppliers.php`, { method: 'POST', body: data }),
  updateSupplier: (id, data) => req(`${API}/suppliers.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteSupplier: (id) => req(`${API}/suppliers.php?id=${id}`, { method: 'DELETE' }),

  getPurchaseOrders: () => req(`${API}/purchase_orders.php`),
  getPurchaseOrder: (id) => req(`${API}/purchase_orders.php?id=${id}`),
  createPurchaseOrder: (data) => req(`${API}/purchase_orders.php`, { method: 'POST', body: data }),
  updatePurchaseOrder: (id, data) => req(`${API}/purchase_orders.php?id=${id}`, { method: 'PATCH', body: data }),
  updatePurchaseOrderStatus: (id, status) => req(`${API}/purchase_orders.php?id=${id}&action=status`, { method: 'PATCH', body: { status } }),
  deletePurchaseOrder: (id) => req(`${API}/purchase_orders.php?id=${id}`, { method: 'DELETE' }),

  getProducts: () => req(`${API}/products.php`),
  getProduct: (id) => req(`${API}/products.php?id=${id}`),
  createProduct: (data) => req(`${API}/products.php`, { method: 'POST', body: data }),
  updateProduct: (id, data) => req(`${API}/products.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteProduct: (id) => req(`${API}/products.php?id=${id}`, { method: 'DELETE' }),

  getRecipes: () => req(`${API}/recipes.php`),
  getRecipe: (id) => req(`${API}/recipes.php?id=${id}`),
  createRecipe: (data) => req(`${API}/recipes.php`, { method: 'POST', body: data }),
  updateRecipe: (id, data) => req(`${API}/recipes.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteRecipe: (id) => req(`${API}/recipes.php?id=${id}`, { method: 'DELETE' }),

  getProductionBatches: () => req(`${API}/production.php`),
  getProductionBatch: (id) => req(`${API}/production.php?id=${id}`),
  createProductionBatch: (data) => req(`${API}/production.php`, { method: 'POST', body: data }),
  updateProductionBatch: (id, data) => req(`${API}/production.php?id=${id}`, { method: 'PATCH', body: data }),
  updateProductionBatchStatus: (id, status) => req(`${API}/production.php?id=${id}&action=status`, { method: 'PATCH', body: { status } }),
  deleteProductionBatch: (id) => req(`${API}/production.php?id=${id}`, { method: 'DELETE' }),

  getReviewSummary: () => req(`${API}/reviews.php`),
  getReviewsForItem: (name) => req(`${API}/reviews.php?item=${encodeURIComponent(name)}`),
  getReviewableItem: (name) => req(`${API}/reviews.php?reviewableItem=${encodeURIComponent(name)}`),
  getReviewableItems: (orderId) => req(`${API}/reviews.php?reviewableForOrder=${orderId}`),
  submitReview: (data) => req(`${API}/reviews.php`, { method: 'POST', body: data }),
  updateReview: (id, data) => req(`${API}/reviews.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteReview: (id) => req(`${API}/reviews.php?id=${id}`, { method: 'DELETE' }),

  getCoupons: () => req(`${API}/coupons.php`),
  getActiveCoupons: () => req(`${API}/coupons.php?active=1`),
  getWelcomeCoupon: () => req(`${API}/coupons.php?welcomeCheck=1`),
  validateCoupon: (code, subtotal) => req(`${API}/coupons.php?validate=${encodeURIComponent(code)}&subtotal=${subtotal}`),
  createCoupon: (data) => req(`${API}/coupons.php`, { method: 'POST', body: data }),
  updateCoupon: (id, data) => req(`${API}/coupons.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteCoupon: (id) => req(`${API}/coupons.php?id=${id}`, { method: 'DELETE' }),

  getTraining: () => req(`${API}/training.php`),
  getTrainingMaterial: (id) => req(`${API}/training.php?id=${id}`),
  createTrainingMaterial: (data) => req(`${API}/training.php`, { method: 'POST', body: data }),
  updateTrainingMaterial: (id, data) => req(`${API}/training.php?id=${id}`, { method: 'PATCH', body: data }),
  setTrainingComplete: (id, completed) => req(`${API}/training.php?id=${id}&action=complete`, { method: 'PATCH', body: { completed } }),
  deleteTrainingMaterial: (id) => req(`${API}/training.php?id=${id}`, { method: 'DELETE' }),

  getRestockAlerts: () => req(`${API}/restock_alerts.php`),
  raiseRestockAlert: (itemId) => req(`${API}/restock_alerts.php`, { method: 'POST', body: { itemId } }),
  raiseAllRestockAlerts: () => req(`${API}/restock_alerts.php`, { method: 'POST', body: { scanAll: true } }),
  updateRestockAlertStatus: (id, status, extra = {}) => req(`${API}/restock_alerts.php?id=${id}&action=status`, { method: 'PATCH', body: Object.assign({ status }, extra) }),
  deleteRestockAlert: (id) => req(`${API}/restock_alerts.php?id=${id}`, { method: 'DELETE' }),

  getCustomers: () => req(`${API}/customers.php`),
  createCustomer: (data) => req(`${API}/customers.php`, { method: 'POST', body: data }),
  updateCustomer: (id, data) => req(`${API}/customers.php?id=${id}`, { method: 'PATCH', body: data }),
  deleteCustomer: (id) => req(`${API}/customers.php?id=${id}`, { method: 'DELETE' }),

  getInvoices: () => req(`${API}/invoices.php`),
  getReceipt: (id) => req(`${API}/invoices.php?id=${id}&action=receipt`),
  getOrderReceipt: (orderId) => req(`${API}/invoices.php?orderId=${orderId}&action=receipt`),
  markInvoicePaid: (id) => req(`${API}/invoices.php?id=${id}&action=pay`, { method: 'PATCH' }),
  deleteInvoice: (id) => req(`${API}/invoices.php?id=${id}`, { method: 'DELETE' }),

  getWeeklyReport: () => req(`${API}/reports.php`),
  getReport: (type, params) => req(`${API}/reports.php?type=${encodeURIComponent(type)}${params ? '&' + new URLSearchParams(params).toString() : ''}`),

  trackOrder: (orderNumber) => req(`${API}/track.php?order_number=${encodeURIComponent(orderNumber)}`),

  getUsers: () => req(`${API}/users.php`),
  createUser: (data) => req(`${API}/users.php`, { method: 'POST', body: data }),
  updateUserRole: (id, role) => req(`${API}/users.php?id=${id}`, { method: 'PATCH', body: { role } }),
  deleteUser: (id) => req(`${API}/users.php?id=${id}`, { method: 'DELETE' }),

  setDeliveryPartner: (id, data) => req(`${API}/orders.php?id=${id}&action=delivery-partner`, { method: 'PATCH', body: data }),
  getDeliveryPartners: () => req(`${API}/delivery_partners.php`),
  createDeliveryPartner: (data) => req(`${API}/delivery_partners.php`, { method: 'POST', body: data }),
  deleteDeliveryPartner: (id) => req(`${API}/delivery_partners.php?id=${id}`, { method: 'DELETE' }),

  getNotifications: () => req(`${API}/notifications.php`),
  markNotificationRead: (id) => req(`${API}/notifications.php?action=read&id=${id}`, { method: 'PATCH' }),
  markAllNotificationsRead: () => req(`${API}/notifications.php?action=read-all`, { method: 'PATCH' }),

  getSettings: () => req(`${API}/settings.php`),
  updateSettings: (data) => req(`${API}/settings.php`, { method: 'PATCH', body: data }),
};

// ── Small helpers ────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mirrors the server-side rule in api/_bootstrap.php's validate_password_strength()
// so account-creation forms in the app (e.g. admin's "Add User") catch weak
// passwords immediately — the server re-checks everything regardless.
function passwordStrengthError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character (e.g. ! @ # $ %)';
  return null;
}
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

const PILL_LABELS = { pending: 'Pending', baking: 'Baking', ready: 'Ready', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', paid: 'Paid', unpaid: 'Unpaid', good: 'Good', medium: 'Medium', low: 'Low', critical: 'Critical' };
// Delivered orders are compared against the expected date to tell the
// customer whether it showed up early, on time, or later than expected.
const DELIVERY_TIMING_STYLE = {
  early: { icon: '🎉', title: 'Delivered Early', message: 'Great news — it arrived ahead of schedule!', bg: '#eefaf1', border: '#bfe8c9', label: '#1c7a3d', text: '#0f5c2a' },
  on_time: { icon: '🎉', title: 'Delivered On Time', message: 'Your order arrived right on schedule. Enjoy!', bg: '#eefaf1', border: '#bfe8c9', label: '#1c7a3d', text: '#0f5c2a' },
  late: { icon: '📦', title: 'Delivered Late', message: 'Sorry for the delay — it arrived after the expected date.', bg: '#fef6ec', border: '#f5d9ae', label: '#9a5b0f', text: '#7a4608' },
};
// Purchase order status → pill styling + label (reuses existing pill CSS
// classes rather than adding new ones).
const PO_STATUS_META = {
  draft: { cls: 'pending', label: 'Draft' },
  ordered: { cls: 'out_for_delivery', label: 'Ordered' },
  received: { cls: 'paid', label: 'Received' },
  cancelled: { cls: 'critical', label: 'Cancelled' },
};
function poPill(status) {
  const m = PO_STATUS_META[status] || { cls: 'medium', label: status };
  return `<span class="pill pill-${m.cls}">${m.label}</span>`;
}
// Production batch status → pill styling + label (reuses existing pill CSS
// classes rather than adding new ones).
const PB_STATUS_META = {
  planned: { cls: 'pending', label: 'Planned' },
  in_progress: { cls: 'baking', label: 'In Progress' },
  completed: { cls: 'paid', label: 'Completed' },
  cancelled: { cls: 'critical', label: 'Cancelled' },
};
function pbPill(status) {
  const m = PB_STATUS_META[status] || { cls: 'medium', label: status };
  return `<span class="pill pill-${m.cls}">${m.label}</span>`;
}
// Restock alert status/severity → pill styling + label.
const RA_STATUS_META = {
  open: { cls: 'critical', label: 'Open' },
  acknowledged: { cls: 'pending', label: 'Acknowledged' },
  ready: { cls: 'out_for_delivery', label: 'Ready for Pickup' },
  dispatched: { cls: 'baking', label: 'Dispatched' },
  received: { cls: 'ready', label: 'Received' },
  resolved: { cls: 'paid', label: 'Resolved' },
};
const RA_SEVERITY_META = {
  critical: { cls: 'critical', label: 'Critical' },
  low: { cls: 'low', label: 'Low' },
};
function raStatusPill(status) {
  const m = RA_STATUS_META[status] || { cls: 'medium', label: status };
  return `<span class="pill pill-${m.cls}">${m.label}</span>`;
}
function raSeverityPill(sev) {
  const m = RA_SEVERITY_META[sev] || { cls: 'medium', label: sev };
  return `<span class="pill pill-${m.cls}">${m.label}</span>`;
}
function statusLabel(s) {
  if (s === 'all') return 'All';
  return PILL_LABELS[s] || s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
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

// Shows an uploaded image (review photo, etc.) full-size in a modal.
// NOTE: we deliberately don't use window.open(dataUrl) here — browsers such
// as Chrome/Edge block window.open()/navigation to data: URLs as a security
// measure, so that used to silently fail to open the review photo for
// everyone (customers and admins alike). A modal with an <img> tag has no
// such restriction.
function viewImageLightbox(url) {
  if (!url) return;
  openModal({
    title: 'Photo',
    bodyHtml: `<div style="display:flex;justify-content:center"><img src="${esc(url)}" alt="Photo" style="max-width:100%;max-height:70vh;border-radius:8px"></div>`,
  });
}

// Reads an <input type=file> image and returns a compressed base64 JPEG
// data URL, resized so its longest side is at most maxDim pixels and
// re-encoded at the given JPEG quality. Uploaded phone photos are often
// several MB, which is large enough as a base64 data URL to exceed MySQL's
// max_allowed_packet / innodb log size limits and fail with "MySQL server
// has gone away" or "size of BLOB/TEXT data...greater than 10% of redo log
// size" — shrinking the image client-side avoids that class of error
// entirely instead of chasing server config. Non-image files (rare, since
// callers use accept="image/*") are returned as a plain data URL fallback.
function compressImageFile(file, maxDim, quality) {
  maxDim = maxDim || 800;
  quality = quality || 0.8;
  return new Promise((resolve, reject) => {
    if (!file.type || file.type.indexOf('image/') !== 0) {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // PNGs with transparency would otherwise turn black when flattened
        // to JPEG, so fill a white background first.
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const OTP_MAX_ATTEMPTS = 5;

// `locked` should be true once the OTP has already hit OTP_MAX_ATTEMPTS wrong
// guesses server-side — the "Regenerate Code" button only appears then, so
// the delivery/pickup partner enters the code normally first and only sees
// the option to regenerate after they've genuinely gotten locked out.
function otpConfirmModal(orderNumber, onSubmit, onRegenerate, locked) {
  openModal({
    title: 'Confirm Delivery',
    bodyHtml: `
      <p style="color:var(--text-secondary);font-size:13.5px;margin-bottom:12px">Ask the customer for the OTP shown on their Track Order page for <b>${esc(orderNumber)}</b> and enter it below to confirm delivery.</p>
      <input class="form-input" id="otp-input" inputmode="numeric" maxlength="4" placeholder="4-digit OTP" style="letter-spacing:4px;font-size:18px;text-align:center">
      <div id="otp-error"></div>
      ${onRegenerate && locked ? `<button type="button" class="btn btn-outline btn-sm" id="otp-regenerate" style="margin-top:10px">🔄 Regenerate Code</button><div id="otp-regen-msg"></div>` : ''}
      ${onRegenerate && !locked ? `<div class="text-muted" style="font-size:11.5px;margin-top:10px" id="otp-regen-hint"></div>` : ''}`,
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" data-confirm-otp>✅ Confirm Delivery</button>`,
    onMount: (overlay) => {
      const input = overlay.querySelector('#otp-input');
      const errBox = overlay.querySelector('#otp-error');
      input.focus();
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      const submit = async () => {
        const otp = input.value.trim();
        errBox.innerHTML = '';
        if (!otp) { errBox.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:#b91c1c">Enter the OTP.</div>`; return; }
        try {
          await onSubmit(otp);
          closeModal();
        } catch (err) {
          errBox.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
          // The 5th wrong guess locks the OTP server-side — reveal the
          // Regenerate Code button right then instead of making them
          // close and reopen the modal to see it.
          if (onRegenerate && /too many incorrect attempts/i.test(err.message)) {
            revealRegenerate();
          }
        }
      };
      overlay.querySelector('[data-confirm-otp]').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

      function revealRegenerate() {
        if (overlay.querySelector('#otp-regenerate') || !onRegenerate) return;
        const hint = overlay.querySelector('#otp-regen-hint');
        const html = `<button type="button" class="btn btn-outline btn-sm" id="otp-regenerate" style="margin-top:10px">🔄 Regenerate Code</button><div id="otp-regen-msg"></div>`;
        if (hint) hint.outerHTML = html; else errBox.insertAdjacentHTML('afterend', html);
        wireRegenerate();
      }

      function wireRegenerate() {
      const regenBtn = overlay.querySelector('#otp-regenerate');
      if (regenBtn && !regenBtn.dataset.wired) {
        regenBtn.dataset.wired = '1';
        const regenMsg = overlay.querySelector('#otp-regen-msg');
        regenBtn.addEventListener('click', async () => {
          regenBtn.disabled = true;
          regenBtn.textContent = 'Sending…';
          regenMsg.innerHTML = '';
          errBox.innerHTML = '';
          try {
            await onRegenerate();
            regenMsg.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:var(--success)">✓ A new code has been sent to the customer. Ask them for it and enter it above.</div>`;
            input.value = '';
            input.focus();
          } catch (err) {
            regenMsg.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
          }
          regenBtn.disabled = false;
          regenBtn.textContent = '🔄 Regenerate Code';
        });
      }
      }
      wireRegenerate();
    },
  });
}

// After a supplier acknowledges a restock alert, this collects the delivery
// partner + tracking number and moves the alert to "dispatched". Mirrors
// openDeliveryPartnerModal's account-or-manual pattern used on Orders.
function addDeliveryPartnerModal(onCreated) {
  const bodyHtml = `
    <p class="text-muted" style="font-size:13px;margin-bottom:14px">Create a login for a delivery partner. They'll use this username and password to sign in and update deliveries.</p>
    <div class="form-group"><label class="form-label">Username</label><input class="form-input" id="dpa-username" placeholder="e.g. ravi.kumar"></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="dpa-phone" placeholder="98XXXXXXXX"></div>
    <div class="form-group"><label class="form-label">Password</label><input class="form-input" type="password" id="dpa-password" placeholder="At least 8 characters, with a letter and a number"></div>
    <div id="dpa-error"></div>`;

  openModal({
    title: 'Add Delivery Partner',
    bodyHtml,
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" data-confirm-dpa">Add Delivery Partner</button>`,
    onMount: (overlay) => {
      const usernameInput = overlay.querySelector('#dpa-username');
      const phoneInput = overlay.querySelector('#dpa-phone');
      const passwordInput = overlay.querySelector('#dpa-password');
      const errBox = overlay.querySelector('#dpa-error');
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('[data-confirm-dpa]').addEventListener('click', async () => {
        errBox.innerHTML = '';
        const username = usernameInput.value.trim();
        const phone = phoneInput.value.trim();
        const password = passwordInput.value;
        if (!username || !password) {
          errBox.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:#b91c1c">Username and password are required.</div>`;
          return;
        }
        try {
          await api.createDeliveryPartner({ username, phone, password });
          toast('Delivery partner added', 'success');
          closeModal();
          onCreated();
        } catch (err) {
          errBox.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
        }
      });
    },
  });
}

async function assignDeliveryPartnerModal(onSubmit) {
  let partners = [];
  try { partners = await api.getDeliveryPartners(); } catch (e) { /* fall back to manual entry only */ }

  const bodyHtml = `
    <p class="text-muted" style="font-size:13px;margin-bottom:14px">Assign the delivery partner bringing this restock, and add their tracking number.</p>
    ${partners.length > 0 ? `
    <div class="form-group">
      <label class="form-label">Delivery partner account</label>
      <select class="form-input" id="adp-account">
        <option value="">— Enter name manually instead —</option>
        ${partners.map(p => `<option value="${p.id}">${esc(p.username)}${p.phone ? ` (${esc(p.phone)})` : ''}</option>`).join('')}
      </select>
    </div>` : `<p class="text-muted" style="font-size:12.5px;margin-bottom:10px">No delivery partner accounts yet — enter details manually below.</p>`}
    <div id="adp-manual-fields" style="display:${partners.length > 0 ? 'none' : 'block'}">
      <div class="form-group"><label class="form-label">Delivery partner name</label><input class="form-input" id="adp-partner" placeholder="e.g. Ravi Kumar"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Order Tracking Number</label>
      <input class="form-input" id="adp-tracking" placeholder="e.g. TRK-2024-00123">
    </div>
    <div id="adp-error"></div>`;

  openModal({
    title: 'Assign Delivery Partner',
    bodyHtml,
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" data-confirm-adp>Assign & Dispatch</button>`,
    onMount: (overlay) => {
      const accountSelect = overlay.querySelector('#adp-account');
      const manualFields = overlay.querySelector('#adp-manual-fields');
      const partnerNameInput = overlay.querySelector('#adp-partner');
      const trackingInput = overlay.querySelector('#adp-tracking');
      const errBox = overlay.querySelector('#adp-error');
      if (accountSelect) accountSelect.addEventListener('change', () => {
        manualFields.style.display = accountSelect.value ? 'none' : 'block';
      });
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('[data-confirm-adp]').addEventListener('click', async () => {
        errBox.innerHTML = '';
        const trackingNumber = trackingInput.value.trim();
        let deliveryPartner = '';
        if (accountSelect && accountSelect.value) {
          const selected = partners.find(p => p.id === accountSelect.value);
          deliveryPartner = selected ? selected.username : '';
        } else if (partnerNameInput) {
          deliveryPartner = partnerNameInput.value.trim();
        }
        if (!deliveryPartner || !trackingNumber) {
          errBox.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:#b91c1c">Both delivery partner and tracking number are required.</div>`;
          return;
        }
        try {
          await onSubmit({ deliveryPartner, trackingNumber });
          closeModal();
        } catch (err) {
          errBox.innerHTML = `<div style="margin-top:8px;font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
        }
      });
    },
  });
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
const TITLES = { dashboard: 'Dashboard', 'new-order': 'New Order', orders: 'Order Details', inventory: 'Inventory', suppliers: 'Supplier Management', 'purchase-orders': 'Purchase Orders', products: 'Product Catalog', coupons: 'Discounts & Coupons', recipes: 'Recipe Management', production: 'Production Management', 'restock-alerts': 'Supplier Restock Alerts', customers: 'Customers', billing: 'Sales & Billing', reports: 'Reports Dashboard', track: 'Golden Crust Bakery', users: 'Users', settings: 'Settings', returns: 'Returns & Refunds', training: 'Training' };
// Staff accounts can only take/manage orders (and use the public-style
// order tracker); everything else is admin-only. Customer accounts are
// storefront-only: they place their own orders and track them, and never
// see anyone else's data or the internal management screens.
const STAFF_ALLOWED_ROUTES = ['new-order', 'orders', 'production', 'track', 'returns', 'training'];
const CUSTOMER_ALLOWED_ROUTES = ['new-order', 'orders', 'track', 'training'];
const DELIVERY_ALLOWED_ROUTES = ['orders', 'track', 'returns', 'training'];
const SUPPLIER_ALLOWED_ROUTES = ['restock-alerts', 'track', 'training'];
function isRouteAllowed(route) {
  if (window.CURRENT_ROLE === 'staff') return STAFF_ALLOWED_ROUTES.indexOf(route) !== -1;
  if (window.CURRENT_ROLE === 'customer') return CUSTOMER_ALLOWED_ROUTES.indexOf(route) !== -1;
  if (window.CURRENT_ROLE === 'delivery') return DELIVERY_ALLOWED_ROUTES.indexOf(route) !== -1;
  if (window.CURRENT_ROLE === 'supplier') return SUPPLIER_ALLOWED_ROUTES.indexOf(route) !== -1;
  return true;
}
function defaultRoute() {
  if (window.CURRENT_ROLE === 'staff') return 'orders';
  if (window.CURRENT_ROLE === 'customer') return 'orders';
  if (window.CURRENT_ROLE === 'delivery') return 'orders';
  if (window.CURRENT_ROLE === 'supplier') return 'restock-alerts';
  return 'dashboard';
}
function navigate(route) {
  if (route.indexOf('product/') === 0) {
    if (!isRouteAllowed('new-order')) route = defaultRoute();
  } else if (!TITLES[route] || !isRouteAllowed(route)) {
    route = defaultRoute();
  }
  // Setting location.hash to its current value does NOT fire 'hashchange'
  // and does NOT push a new history entry, so re-visiting the route you're
  // already on (e.g. clicking "+ Create New Order" again) used to leave the
  // old, stale form on screen instead of resetting it. Force a re-render in
  // that case.
  if (window.location.hash.replace('#', '') === route) {
    render();
  } else {
    window.location.hash = route;
  }
}

function currentRoute() {
  const r = window.location.hash.replace('#', '');
  if (r.indexOf('product/') === 0) {
    return isRouteAllowed('new-order') ? r : defaultRoute();
  }
  if (!TITLES[r] || !isRouteAllowed(r)) return defaultRoute();
  return r;
}

async function render() {
  const route = currentRoute();
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  const activeLink = $(`.nav-link[data-route="${route}"]`);
  const activeGroupBody = activeLink && activeLink.closest('.nav-group-body');
  $$('.nav-group-header').forEach(h => h.classList.toggle('open', !!(activeGroupBody && h.dataset.group === activeGroupBody.dataset.groupBody)));
  $$('.nav-group-body').forEach(b => b.classList.toggle('open', b === activeGroupBody));
  $('#topbar-title').textContent = route.indexOf('product/') === 0 ? 'Product Details' : TITLES[route];
  const content = $('#page-content');
  content.innerHTML = spinner();
  const resumePos = posResumeAfterReload;
  posResumeAfterReload = false;

  try {
    if (route.indexOf('product/') === 0) await renderProductDetail(content, decodeURIComponent(route.slice('product/'.length)));
    else if (route === 'dashboard') await renderDashboard(content);
    else if (route === 'new-order') await renderNewOrder(content, resumePos);
    else if (route === 'orders') await renderOrders(content);
    else if (route === 'inventory') await renderInventory(content);
    else if (route === 'suppliers') await renderSuppliers(content);
    else if (route === 'purchase-orders') await renderPurchaseOrders(content);
    else if (route === 'products') await renderProducts(content);
    else if (route === 'coupons') await renderCoupons(content);
    else if (route === 'recipes') await renderRecipes(content);
    else if (route === 'production') await renderProduction(content);
    else if (route === 'restock-alerts') await renderRestockAlerts(content);
    else if (route === 'training') await renderTraining(content);
    else if (route === 'customers') await renderCustomers(content);
    else if (route === 'billing') await renderBilling(content);
    else if (route === 'reports') await renderReports(content);
    else if (route === 'track') await renderTrack(content);
    else if (route === 'returns') await renderReturns(content);
    else if (route === 'users') await renderUsers(content);
    else if (route === 'settings') await renderSettings(content);
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

  $('#qa-new-order').addEventListener('click', () => { navigate('new-order'); });
  $$('[data-route-link]', content).forEach(a => a.addEventListener('click', () => navigate(a.dataset.routeLink)));
}

// ── Orders ───────────────────────────────────────────────────────────────
const STATUSES = ['all', 'pending', 'baking', 'ready', 'out_for_delivery', 'delivered'];
const ORDER_STATUS_OPTIONS = {
  pickup: ['pending', 'baking', 'ready', 'delivered'],
  // Admin/staff only take a delivery order as far as "ready" — once it's
  // ready, only the assigned delivery partner can move it to out_for_delivery
  // / delivered (see renderOrders below). This keeps the dropdown from ever
  // offering those two steps to admin.
  delivery: ['pending', 'baking', 'ready'],
};

// Flat delivery charge, applied to any home-delivery order regardless of
// payment method (mirrors DELIVERY_CHARGE in api/orders.php — kept here
// just for display before the order is actually saved; the backend is
// the source of truth).
const DELIVERY_CHARGE = 50;
function deliveryChargeFor(state) {
  return (state.deliveryType === 'delivery') ? DELIVERY_CHARGE : 0;
}

let ordersState = { activeTab: 'all', orders: [], customers: [], inventory: [], products: [], settings: null, reviewSummary: {}, activeCoupons: [] };
let posState = {
  customerId: '', customerName: '', phone: '', email: '',
  deliveryType: 'pickup', address: '',
  paymentMethod: 'offline',
  payState: 'idle', payResult: null,
  cart: {}, cartOpen: false,
  coupon: { code: '', applied: null, error: '', checking: false, autoApplied: false },
  selectedItem: null, selectedItemDetail: null, reviewDraft: { rating: 5, comment: '', imageUrl: '' },
};

// The New Order cart survives a page refresh: it's saved to this browser
// tab's sessionStorage whenever the page is left and restored on load.
// Keyed per account, so a different login in the same tab never sees it;
// closing the tab (or logging out) still starts fresh.
const POS_STORAGE_KEY = `bakery_pos_${window.CURRENT_USER_ID}`;
let posStateSavingDisabled = false;
// True only for the first render after a reload, so the page reopens on the
// same step (e.g. the cart drawer) rather than the New Order landing view.
let posResumeAfterReload = false;

function savePosState() {
  if (posStateSavingDisabled) return;
  const { customerId, customerName, phone, email, deliveryType, address, paymentMethod, cart, cartOpen, coupon, payState, payResult } = posState;
  try {
    sessionStorage.setItem(POS_STORAGE_KEY, JSON.stringify({
      customerId, customerName, phone, email, deliveryType, address, paymentMethod, cart, cartOpen,
      coupon: { code: coupon.code, applied: coupon.applied, autoApplied: coupon.autoApplied },
      // A finished payment is kept so its order can still be placed after a
      // refresh; one left open in Razorpay's popup is simply started again.
      ...(payState === 'success' ? { payState, payResult } : {}),
    }));
  } catch (e) { /* storage full or disabled — the cart just won't survive a refresh */ }
}

function restorePosState() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(POS_STORAGE_KEY) || 'null'); } catch (e) { /* ignore */ }
  if (!saved) return;
  Object.assign(posState, saved, { coupon: { ...posState.coupon, ...saved.coupon } });
  posResumeAfterReload = true;
}

function clearSavedPosState() {
  posStateSavingDisabled = true;
  try { sessionStorage.removeItem(POS_STORAGE_KEY); } catch (e) { /* ignore */ }
}

function posCartTotal() {
  return Object.values(posState.cart).reduce((s, i) => s + i.price * i.qty, 0);
}
function posDiscountAmount() {
  return posState.coupon.applied ? posState.coupon.applied.discountAmount : 0;
}

// The live "Special Day Sale" coupon (if any) — used to show a slashed
// price directly on every product card, not just at checkout.
function activeAutoCoupon() {
  return (ordersState.activeCoupons || []).find(c => c.autoApply) || null;
}

// What a single product's price becomes under the active site-wide coupon.
// Only meaningful for 'percent' coupons — a flat ₹ coupon is a cart-level
// discount and doesn't divide cleanly across individual items, so per-item
// slashed pricing is only shown for percent-off sales.
function autoDiscountedPrice(price, coupon) {
  if (!coupon || coupon.discountType !== 'percent') return null;
  const discounted = price - (price * coupon.discountValue / 100);
  return Math.max(0, discounted);
}

// Turns a coupon's validUntil (a plain DATE, e.g. "2026-07-12") into a
// friendly countdown like "18 hours left" or "3 days left", counting down
// to the end of that calendar day. Returns null for an open-ended sale.
function couponCountdownText(validUntil) {
  if (!validUntil) return null;
  const end = new Date(validUntil + 'T23:59:59');
  const diffMs = end.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (hours >= 48) return `${Math.ceil(hours / 24)} days left`;
  if (hours >= 24) return `1 day left`;
  return `${hours} hour${hours === 1 ? '' : 's'} left`;
}

// "Special Day Sale" coupons (coupon.autoApply = true, set by an admin on
// the Discounts & Coupons page) apply themselves to every customer's cart
// automatically — no code entry needed. Called after every cart mutation
// (add/inc/dec/remove/open) so the discount shows up the moment the cart
// stops being empty, and drops off again if it's emptied out.
async function syncAutoCoupon(redraw) {
  const auto = (ordersState.activeCoupons || []).find(c => c.autoApply);
  const subtotal = posCartTotal();

  if (!auto || subtotal <= 0) {
    if (posState.coupon.autoApplied) {
      posState.coupon.applied = null;
      posState.coupon.autoApplied = false;
      redraw();
    }
    return;
  }

  // A manually-entered coupon takes priority over the automatic one.
  if (posState.coupon.applied && !posState.coupon.autoApplied) return;
  // Already applied and still the right code — nothing to do.
  if (posState.coupon.applied && posState.coupon.autoApplied && posState.coupon.applied.code === auto.code) return;

  try {
    const result = await api.validateCoupon(auto.code, subtotal);
    posState.coupon.applied = result;
    posState.coupon.autoApplied = true;
    posState.coupon.error = '';
  } catch (err) {
    // e.g. subtotal doesn't meet the coupon's minimum order yet — quietly
    // wait until it does rather than showing an error for something the
    // customer never typed in themselves.
  }
  redraw();
}

// Renders a row of filled/empty star glyphs for a given rating (supports
// halves by rounding to the nearest whole star — good enough for a quick
// visual, exact average is always shown as a number alongside it).
function starsHtml(rating, size) {
  const r = Math.round(rating || 0);
  const px = size || 13;
  let out = '';
  for (let i = 1; i <= 5; i++) out += `<span style="color:${i <= r ? '#f5a623' : 'var(--border)'};font-size:${px}px">★</span>`;
  return out;
}

function interactiveStarsHtml(current, groupId) {
  let out = `<div data-star-group="${groupId}" style="display:flex;gap:2px">`;
  for (let i = 1; i <= 5; i++) {
    out += `<span data-star-value="${i}" style="cursor:pointer;color:${i <= current ? '#f5a623' : 'var(--border)'};font-size:22px">★</span>`;
  }
  out += `</div>`;
  return out;
}

function defaultPosState(keepCustomer = false) {
  const saved = keepCustomer ? {
    customerId: posState.customerId,
    customerName: posState.customerName,
    phone: posState.phone,
    email: posState.email,
  } : { customerId: '', customerName: '', phone: '', email: '' };
  return {
    ...saved,
    deliveryType: 'pickup', address: '',
    paymentMethod: 'offline',
    payState: 'idle', payResult: null,
    cart: {}, cartOpen: false,
    coupon: { code: '', applied: null, error: '', checking: false, autoApplied: false },
    selectedItem: null, selectedItemDetail: null, eligibleReviewOrderId: null, reviewDraft: { rating: 5, comment: '', imageUrl: '' },
  };
}

function paymentPanelHtml(pay, totalAmount, prefix) {
  if (pay.payState === 'success') {
    return `
    <div class="pay-panel pay-success">
      <div style="font-size:32px">✅</div>
      <div style="font-weight:700;margin-top:4px">Payment Successful</div>
      <div class="text-muted" style="font-size:12.5px;margin-top:4px">Payment ID: ${esc(pay.payResult.razorpayPaymentId)}</div>
      <div class="text-muted" style="font-size:12.5px">₹${inr(pay.payResult.amount)}</div>
    </div>`;
  }
  return `
  <div class="pay-panel">
    <div style="font-size:12.5px;color:var(--text-secondary);text-align:center">Pay by UPI, card, netbanking or wallet in Razorpay's secure checkout.</div>
    <button class="btn btn-primary pay-btn" id="${prefix}-pay-submit" style="width:100%;justify-content:center;margin-top:10px" ${pay.payState === 'processing' ? 'disabled' : ''}>
      ${pay.payState === 'processing' ? '<span class="pay-spinner"></span> Waiting for payment…' : `🔒 Pay ₹${inr(totalAmount)} securely`}
    </button>
    <div style="font-size:11px;color:var(--text-tertiary);text-align:center;margin-top:6px">Card and bank details go straight to Razorpay — this app never sees them.</div>
  </div>`;
}

// Real online payment through Razorpay Checkout. The server prices the cart
// and opens a Razorpay order for exactly that amount (api/payments.php),
// Razorpay's own popup takes the payment, and the signed result goes to
// onPaid() to place the order — api/orders.php verifies the signature
// before saving it. getOrderData() returns the same body createOrder will
// send, or null after telling the user what's missing.
function wirePaymentPanel(content, pay, totalAmount, prefix, onRedraw, getOrderData, onPaid) {
  const paySubmit = $(`#${prefix}-pay-submit`, content);
  if (!paySubmit) return;
  paySubmit.addEventListener('click', async () => {
    if (totalAmount <= 0) return toast('Add at least one item first', 'error');
    const orderData = getOrderData();
    if (!orderData) return;
    const resetPay = () => { pay.payState = 'idle'; onRedraw(); };
    pay.payState = 'processing';
    onRedraw();

    let session;
    try {
      await loadRazorpayCheckout();
      session = await api.createPayment(orderData);
    } catch (err) {
      resetPay();
      return toast(err.message, 'error');
    }

    const checkout = new Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amount,
      currency: session.currency,
      name: session.businessName,
      description: 'Bakery order',
      prefill: { name: orderData.customerName || '', email: orderData.customerEmail || '', contact: orderData.customerPhone || '' },
      theme: { color: '#534AB7' },
      handler: (resp) => {
        pay.payState = 'success';
        pay.payResult = {
          razorpayOrderId: resp.razorpay_order_id,
          razorpayPaymentId: resp.razorpay_payment_id,
          razorpaySignature: resp.razorpay_signature,
          amount: session.amount / 100,
        };
        onRedraw();
        toast('Payment successful!', 'success');
        onPaid();
      },
      modal: { ondismiss: () => { if (pay.payState === 'processing') resetPay(); } },
    });
    // A declined attempt keeps the checkout open so the customer can try
    // again or pick another method — just say why it failed.
    checkout.on('payment.failed', (resp) => toast(`Payment failed: ${resp.error.description}`, 'error'));
    checkout.open();
  });
}

// Razorpay's checkout.js is only fetched the first time someone pays online.
let razorpayCheckoutLoading = null;
function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayCheckoutLoading) {
    razorpayCheckoutLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => {
        razorpayCheckoutLoading = null;
        reject(new Error('Could not load the Razorpay checkout — check your internet connection'));
      };
      document.head.appendChild(script);
    });
  }
  return razorpayCheckoutLoading;
}

function openOrderModal(onSaved) {
  const isCustomer = window.CURRENT_ROLE === 'customer';
  let form = {
    customerId: isCustomer ? (posState.customerId || '') : '', customerName: isCustomer ? (posState.customerName || window.CURRENT_USERNAME || '') : '',
    phone: isCustomer ? (posState.phone || '') : '', email: isCustomer ? (posState.email || '') : '',
    deliveryType: 'pickup', address: '', requestedDate: '', notes: '',
    items: [{ name: '', qty: 1, price: 0 }],
    paymentMethod: 'offline',
    payState: 'idle', // idle | processing | success
    payResult: null,
  };

  const total = () => form.items.reduce((s, i) => s + (i.price * i.qty || 0), 0) + deliveryChargeFor(form);
  const invByName = (name) => ordersState.inventory.find(x => x.name === name);

  const bodyHtml = () => `
    <div class="form-group">
      <label class="form-label">Customer</label>
      ${isCustomer ? `
        <input class="form-input" id="ord-customer-name" value="${esc(form.customerName)}" placeholder="Your name">
      ` : `
        <select class="form-input" id="ord-customer">
          <option value="">Select existing customer…</option>
          ${ordersState.customers.map(c => `<option value="${c.id}" ${form.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        ${!form.customerId ? `<input class="form-input" style="margin-top:8px" id="ord-customer-name" placeholder="Or type customer name" value="${esc(form.customerName)}">` : ''}
      `}
    </div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-input" id="ord-phone" type="tel" placeholder="98765 43210" value="${esc(form.phone)}">
      </div>
      <div class="form-group">
        <label class="form-label">Email <span class="text-muted" style="font-weight:400">(optional)</span></label>
        <input class="form-input" id="ord-email" type="email" placeholder="you@example.com" value="${esc(form.email)}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Items</label>
      <div id="ord-items">
        ${form.items.map((item, i) => {
          const inv = invByName(item.name);
          return `
          <div class="form-row cols-3" style="margin-bottom:4px" data-item-row="${i}">
            <select class="form-input" data-item-name="${i}">
              <option value="">Select item…</option>
              ${ordersState.inventory.map(m => `<option value="${esc(m.name)}" ${item.name === m.name ? 'selected' : ''} ${m.quantity <= 0 ? 'disabled' : ''}>${esc(m.name)} ${m.quantity <= 0 ? '(out of stock)' : ''}</option>`).join('')}
            </select>
            <input type="number" class="form-input" min="1" placeholder="Qty" value="${item.qty}" data-item-qty="${i}">
            <div style="display:flex;gap:6px">
              <input type="number" class="form-input" placeholder="₹ Price" value="${item.price}" data-item-price="${i}" ${isCustomer ? 'readonly' : ''}>
              ${form.items.length > 1 ? `<button class="btn btn-danger btn-sm btn-icon" data-remove-item="${i}">✕</button>` : ''}
            </div>
          </div>
          ${inv ? `<div class="text-muted" style="font-size:11.5px;margin:-2px 0 8px 2px">${inv.quantity} ${esc(inv.unit)} in stock</div>` : ''}`;
        }).join('')}
      </div>
      <button class="btn btn-outline btn-sm" id="ord-add-item">+ Add Item</button>
    </div>
    <div class="form-group">
      <label class="form-label">Fulfillment</label>
      <div style="display:flex;gap:10px">
        <label class="btn ${form.deliveryType === 'pickup' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
          <input type="radio" name="ord-delivery" value="pickup" data-delivery-type style="margin-right:6px" ${form.deliveryType === 'pickup' ? 'checked' : ''}> 🏬 Store Pickup
        </label>
        <label class="btn ${form.deliveryType === 'delivery' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
          <input type="radio" name="ord-delivery" value="delivery" data-delivery-type style="margin-right:6px" ${form.deliveryType === 'delivery' ? 'checked' : ''}> 🚚 Home Delivery
        </label>
      </div>
      ${form.deliveryType === 'delivery' ? `
        <input class="form-input" style="margin-top:8px" id="ord-address" placeholder="Delivery address" value="${esc(form.address)}">
      ` : ''}
    </div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">Needed by <span class="text-muted" style="font-weight:400">(optional)</span></label>
        <input class="form-input" id="ord-date" type="date" value="${esc(form.requestedDate)}">
      </div>
      <div class="form-group">
        <label class="form-label">Notes <span class="text-muted" style="font-weight:400">(optional)</span></label>
        <input class="form-input" id="ord-notes" placeholder="e.g. write 'Happy Birthday'" value="${esc(form.notes)}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Payment Method</label>
      <div style="display:flex;gap:10px">
        <label class="btn ${form.paymentMethod === 'offline' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
          <input type="radio" name="ord-payment" value="offline" data-payment-method style="margin-right:6px" ${form.paymentMethod === 'offline' ? 'checked' : ''}> 💵 Cash / Offline
        </label>
        <label class="btn ${form.paymentMethod === 'online' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
          <input type="radio" name="ord-payment" value="online" data-payment-method style="margin-right:6px" ${form.paymentMethod === 'online' ? 'checked' : ''}> 🔒 Pay Online
        </label>
      </div>
      ${form.paymentMethod === 'online' ? paymentPanelHtml(form, total(), 'pay') : ''}
    </div>
    <div style="padding:12px 0;border-top:1px solid var(--border);margin-top:8px;display:flex;justify-content:space-between;align-items:center">
      <strong>Total: ₹${inr(total())}</strong>
      ${form.paymentMethod === 'online' && form.payState === 'success' ? `<span style="color:var(--success);font-size:13px;font-weight:600">✓ Paid · ${esc(form.payResult.razorpayPaymentId)}</span>` : ''}
    </div>`;

  const footerHtml = () => {
    if (form.paymentMethod === 'online' && form.payState !== 'success') {
      return `<button class="btn btn-outline" data-cancel>Cancel</button>`;
    }
    return `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="ord-save">${form.paymentMethod === 'online' ? 'Place Order' : 'Create Order'}</button>`;
  };

  const rerender = (overlay) => {
    overlay.querySelector('.modal-body').innerHTML = bodyHtml();
    overlay.querySelector('.modal-footer').innerHTML = footerHtml();
    wire(overlay);
  };

  // The form as a createOrder body (minus payment), or null after telling
  // the user what's missing — also what an online payment is opened for.
  const orderData = () => {
    if (!form.customerName) { toast('Customer name required', 'error'); return null; }
    const items = form.items.filter(i => i.name);
    if (!items.some(i => i.name && i.price > 0)) { toast('Add at least one item', 'error'); return null; }
    if (form.deliveryType === 'delivery' && !form.address.trim()) { toast('Enter a delivery address', 'error'); return null; }
    return {
      customerName: form.customerName, customerId: form.customerId || null,
      customerPhone: form.phone, customerEmail: form.email,
      deliveryType: form.deliveryType, deliveryAddress: form.address,
      requestedDate: form.requestedDate, notes: form.notes,
      items, paymentMethod: form.paymentMethod,
    };
  };

  const saveOrder = async () => {
    const data = orderData();
    if (!data) return;
    if (form.paymentMethod === 'online' && form.payState !== 'success') return toast('Complete payment first', 'error');
    try {
      const created = await api.createOrder({ ...data, payment: form.paymentMethod === 'online' ? form.payResult : undefined });
      toast('Order created!', 'success');
      closeModal();
      onSaved();
      if (form.paymentMethod === 'online') {
        openReceiptModal({ ...created, amount: created.total }, { title: 'Payment Successful' });
      }
    } catch (err) { toast(err.message, 'error'); }
  };

  const wire = (overlay) => {
    const customerSel = overlay.querySelector('#ord-customer');
    if (customerSel) customerSel.addEventListener('change', () => {
      const cust = ordersState.customers.find(c => c.id === customerSel.value);
      form.customerId = customerSel.value;
      form.customerName = cust ? cust.name : '';
      rerender(overlay);
    });
    const nameInput = overlay.querySelector('#ord-customer-name');
    if (nameInput) nameInput.addEventListener('input', (e) => { form.customerName = e.target.value; });
    const phoneInput = overlay.querySelector('#ord-phone');
    if (phoneInput) phoneInput.addEventListener('input', (e) => { form.phone = e.target.value; });
    const emailInput = overlay.querySelector('#ord-email');
    if (emailInput) emailInput.addEventListener('input', (e) => { form.email = e.target.value; });
    const addrInput = overlay.querySelector('#ord-address');
    if (addrInput) addrInput.addEventListener('input', (e) => { form.address = e.target.value; });
    const dateInput = overlay.querySelector('#ord-date');
    if (dateInput) dateInput.addEventListener('input', (e) => { form.requestedDate = e.target.value; });
    const notesInput = overlay.querySelector('#ord-notes');
    if (notesInput) notesInput.addEventListener('input', (e) => { form.notes = e.target.value; });

    $$('[data-delivery-type]', overlay).forEach(radio => radio.addEventListener('change', (e) => {
      form.deliveryType = e.target.value;
      rerender(overlay);
    }));

    $$('[data-item-name]', overlay).forEach(sel => sel.addEventListener('change', (e) => {
      const i = +e.target.dataset.itemName;
      form.items[i].name = e.target.value;
      const invItem = invByName(e.target.value);
      if (invItem) form.items[i].price = invItem.sellPrice;
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
      form.payState = 'idle';
      form.payResult = null;
      rerender(overlay);
    }));

    wirePaymentPanel(overlay, form, total(), 'pay', () => rerender(overlay), orderData, saveOrder);

    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    const saveBtn = overlay.querySelector('#ord-save');
    if (saveBtn) saveBtn.addEventListener('click', saveOrder);
  };

  openModal({ title: 'New Order', bodyHtml: bodyHtml(), footerHtml: footerHtml(), onMount: wire });
}

async function openDeliveryPartnerModal(order, onSaved) {
  let partners = [];
  try { partners = await api.getDeliveryPartners(); } catch (e) { /* fall back to free text only */ }

  const bodyHtml = `
    <p class="text-muted" style="font-size:13px;margin-bottom:14px">Assign the delivery partner handling <strong>${esc(order.orderNumber)}</strong>. They'll be notified and can update this order themselves once it's ready.</p>
    ${partners.length > 0 ? `
    <div class="form-group">
      <label class="form-label">Delivery partner account</label>
      <select class="form-input" id="dp-account">
        <option value="">— Enter name/phone manually instead —</option>
        ${partners.map(p => `<option value="${p.id}" ${order.deliveryPartnerUserId === p.id ? 'selected' : ''}>${esc(p.username)}${p.phone ? ` (${esc(p.phone)})` : ''}</option>`).join('')}
      </select>
    </div>` : `<p class="text-muted" style="font-size:12.5px;margin-bottom:10px">No delivery partner accounts yet — create one from the Users page, or enter details manually below.</p>`}
    <div id="dp-manual-fields" style="display:${partners.length > 0 && order.deliveryPartnerUserId ? 'none' : 'block'}">
      <div class="form-group"><label class="form-label">Delivery partner name</label><input class="form-input" id="dp-name" value="${esc(order.deliveryPartnerName || '')}" placeholder="e.g. Ravi Kumar"></div>
      <div class="form-group"><label class="form-label">Delivery partner phone</label><input class="form-input" id="dp-phone" value="${esc(order.deliveryPartnerPhone || '')}" placeholder="98XXXXXXXX"></div>
    </div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="dp-save">Save</button>`;

  openModal({
    title: 'Assign Delivery Partner',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      const accountSelect = overlay.querySelector('#dp-account');
      const manualFields = overlay.querySelector('#dp-manual-fields');
      if (accountSelect) accountSelect.addEventListener('change', () => {
        manualFields.style.display = accountSelect.value ? 'none' : 'block';
      });
      overlay.querySelector('#dp-save').addEventListener('click', async () => {
        const partnerId = accountSelect ? accountSelect.value : '';
        const name = overlay.querySelector('#dp-name') ? overlay.querySelector('#dp-name').value.trim() : '';
        const phone = overlay.querySelector('#dp-phone') ? overlay.querySelector('#dp-phone').value.trim() : '';
        try {
          await api.setDeliveryPartner(order.id, partnerId ? { partnerId } : { name, phone });
          toast('Delivery partner updated!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

// Small banner on New Order listing every coupon that's currently usable —
// so customers/staff don't have to already know a code to get the discount.
// Welcome-offer coupons are sorted first (see api/coupons.php ?active=1)
// and get a highlighted style.
function availableCouponsHtml(coupons, isCartEmpty, cartSubtotal) {
  if (!coupons || !coupons.length) return '';
  const subtotal = cartSubtotal || 0;
  return `
  <div class="card" style="margin-bottom:16px;padding:14px 18px">
    <div class="font-medium" style="font-size:13.5px;margin-bottom:8px">🏷️ Available Coupons</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${coupons.map(c => {
        const belowMin = !isCartEmpty && subtotal < c.minOrderAmount;
        const disabled = isCartEmpty || belowMin;
        return `
        <div style="display:flex;align-items:center;gap:8px;border:1px dashed ${c.isWelcome ? 'var(--brand)' : 'var(--border)'};background:${c.isWelcome ? 'var(--brand-bg,#fdf3e7)' : 'var(--bg)'};border-radius:8px;padding:6px 10px;opacity:${isCartEmpty ? 0.6 : 1}">
          <div>
            <div style="font-size:12.5px;font-weight:700">${c.autoApply ? '✨ ' : (c.isWelcome ? '🎉 ' : '')}${esc(c.code)} — ${c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${inr(c.discountValue)} off`}</div>
            <div class="text-muted" style="font-size:11px">${esc(c.description || '')}${c.minOrderAmount > 0 ? `${c.description ? ' · ' : ''}Min. order ₹${inr(c.minOrderAmount)}` : ''}</div>
          </div>
          ${c.autoApply
            ? `<span class="pill pill-good" style="white-space:nowrap">Auto-applied</span>`
            : `<button type="button" class="btn btn-outline btn-sm" data-coupon-quick-apply="${esc(c.code)}" style="${disabled ? 'cursor:not-allowed' : ''}" ${disabled ? 'disabled' : ''} ${belowMin ? `title="Minimum order ₹${inr(c.minOrderAmount)} not reached"` : ''}>Apply</button>`}
        </div>`;}).join('')}
    </div>
  </div>`;
}

function bakeryContactHtml(settings) {
  const isAdmin = window.CURRENT_ROLE === 'admin';
  const hasContact = settings && (settings.phone || settings.email || settings.address);
  return `
  <div class="card" style="margin-bottom:20px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:24px">📞</div>
      <div>
        <div class="font-medium" style="font-size:14px;margin-bottom:4px">Bakery Contact Details</div>
        ${hasContact
          ? `<div class="text-muted" style="font-size:13px;line-height:1.7">
              ${settings.phone ? `Phone : <strong style="color:var(--text)">${esc(settings.phone)}</strong><br>` : ''}
              ${settings.email ? `Email : <strong style="color:var(--text)">${esc(settings.email)}</strong><br>` : ''}
              ${settings.address ? `Address : <strong style="color:var(--text)">${esc(settings.address)}</strong>` : ''}
            </div>`
          : `<div class="text-muted" style="font-size:13px">${isAdmin ? 'No contact number set yet — add one so customers can call in orders.' : 'Bakery contact details aren\'t set up yet.'}</div>`}
      </div>
    </div>
    ${isAdmin ? `<button class="btn btn-outline btn-sm" id="edit-bakery-contact">${hasContact ? 'Edit' : '+ Add Contact'}</button>` : ''}
  </div>`;
}

function openBakeryContactModal(settings, onSaved) {
  const bodyHtml = `
    <p class="text-muted" style="font-size:13px;margin-bottom:14px">Shown to customers on the Order Details and login pages, for anyone who'd rather call in an order than place it online.</p>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="bc-phone" value="${esc(settings.phone || '')}" placeholder="98765 43210"></div>
    <div class="form-group"><label class="form-label">Email <span class="text-muted" style="font-weight:400">(optional)</span></label><input type="email" class="form-input" id="bc-email" value="${esc(settings.email || '')}" placeholder="orders@bakeandco.com"></div>
    <div class="form-group"><label class="form-label">Address <span class="text-muted" style="font-weight:400">(optional)</span></label><input class="form-input" id="bc-address" value="${esc(settings.address || '')}" placeholder="Shop address"></div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="bc-save">Save</button>`;

  openModal({
    title: 'Bakery Contact Details',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#bc-save').addEventListener('click', async () => {
        const payload = {
          phone: overlay.querySelector('#bc-phone').value.trim(),
          email: overlay.querySelector('#bc-email').value.trim(),
          address: overlay.querySelector('#bc-address').value.trim(),
        };
        try {
          await api.updateSettings(payload);
          toast('Contact details updated!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

function cartDrawerHtml() {
  const isCustomer = window.CURRENT_ROLE === 'customer';
  const cartItems = Object.values(posState.cart);
  const subtotal = posCartTotal();
  const deliveryCharge = deliveryChargeFor(posState);
  const discount = posDiscountAmount();
  const total = Math.max(0, subtotal - discount + deliveryCharge);
  const customerName = isCustomer ? (posState.customerName || window.CURRENT_USERNAME || '') : posState.customerName;
  const placeLabel = posState.paymentMethod === 'online'
    ? (posState.payState === 'success' ? 'Place Order' : 'Complete payment above first')
    : `Place Order · ₹${inr(total)}`;

  if (!posState.cartOpen) return '';

  return `
    <div id="pos-cart-overlay" data-cart-close style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000"></div>
    <div id="pos-cart-drawer" style="position:fixed;inset:0;width:100%;height:100%;background:var(--surface,#fff);z-index:1001;overflow-y:auto;display:flex;flex-direction:column">
      <div style="max-width:560px;width:100%;margin:0 auto;padding:24px 18px 40px;flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
          <div class="font-medium" style="font-size:18px">🧺 Order Cart</div>
          <button type="button" class="btn btn-outline btn-sm btn-icon" data-cart-close>✕</button>
        </div>

        ${isCustomer ? `
          <div style="margin-bottom:8px;padding:8px 10px;border-radius:8px;background:var(--bg);border:1px solid var(--border);font-size:13px">
            <div class="text-muted" style="font-size:11px;margin-bottom:2px">Ordering as</div>
            <div class="font-medium">${esc(customerName)}</div>
          </div>
        ` : `
          <select class="form-input" id="pos-customer-select" style="margin-bottom:8px">
            <option value="">Select existing customer…</option>
            ${ordersState.customers.map(c => `<option value="${c.id}" ${posState.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          <input class="form-input" id="pos-customer-name" placeholder="Or type a new customer name" value="${esc(posState.customerName)}" style="margin-bottom:8px">
        `}
        <input class="form-input" id="pos-customer-phone" type="tel" placeholder="Phone number" value="${esc(posState.phone)}" style="margin-bottom:10px">

        <div style="display:flex;gap:8px;margin-bottom:8px">
          <label class="btn ${posState.deliveryType === 'pickup' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
            <input type="radio" name="pos-delivery" value="pickup" data-pos-delivery-type style="margin-right:4px" ${posState.deliveryType === 'pickup' ? 'checked' : ''}> 🏬 Pickup
          </label>
          <label class="btn ${posState.deliveryType === 'delivery' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
            <input type="radio" name="pos-delivery" value="delivery" data-pos-delivery-type style="margin-right:4px" ${posState.deliveryType === 'delivery' ? 'checked' : ''}> 🚚 Delivery
          </label>
        </div>
        ${posState.deliveryType === 'delivery' ? `<input class="form-input" id="pos-address" placeholder="Delivery address" value="${esc(posState.address)}" style="margin-bottom:6px">` : ''}
        ${posState.deliveryType === 'delivery' ? `<div class="text-muted" style="font-size:11.5px;margin-bottom:10px">A ₹${inr(DELIVERY_CHARGE)} delivery charge applies when paying online.</div>` : ''}

        <div style="max-height:280px;overflow-y:auto;margin:10px 0">
          ${cartItems.length === 0 ? `<div class="text-muted" style="font-size:13px;padding:14px 0;text-align:center">Your cart is empty</div>` : cartItems.map(it => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
              <div style="flex:1;min-width:0">
                <div class="font-medium" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</div>
                <div class="text-muted" style="font-size:11px">₹${inr(it.price)} each</div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                <button type="button" class="btn btn-outline btn-sm btn-icon" data-pos-dec="${esc(it.name)}">−</button>
                <span style="min-width:16px;text-align:center">${it.qty}</span>
                <button type="button" class="btn btn-outline btn-sm btn-icon" data-pos-inc="${esc(it.name)}">+</button>
                <span class="font-medium" style="min-width:56px;text-align:right">₹${inr(it.price * it.qty)}</span>
                <button type="button" class="btn btn-danger btn-sm btn-icon" data-pos-remove="${esc(it.name)}">✕</button>
              </div>
            </div>`).join('')}
        </div>

        <div style="margin:10px 0;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">
          ${posState.coupon.autoApplied ? `
            <div style="font-size:12.5px;font-weight:700;margin-bottom:8px">✨ Special Day Sale — ✓ "${esc(posState.coupon.applied.code)}" applied automatically, you saved ₹${inr(posState.coupon.applied.discountAmount)}</div>
            <div class="text-muted" style="font-size:11px;margin-bottom:6px">Have a better code? Enter it below to swap.</div>
          ` : ''}
          ${!posState.coupon.applied || posState.coupon.autoApplied ? `
            <div style="display:flex;gap:6px">
              <input class="form-input" id="pos-coupon-input" placeholder="Coupon code" value="${esc(posState.coupon.code)}" style="text-transform:uppercase">
              <button type="button" class="btn btn-outline btn-sm" id="pos-coupon-apply" ${posState.coupon.checking ? 'disabled' : ''}>${posState.coupon.checking ? 'Checking…' : 'Apply'}</button>
            </div>
          ` : `
            <div style="display:flex;gap:6px">
              <input class="form-input" id="pos-coupon-input" placeholder="Coupon code" value="${esc(posState.coupon.code)}" style="text-transform:uppercase" disabled>
              <button type="button" class="btn btn-outline btn-sm" id="pos-coupon-remove">Remove</button>
            </div>
            <div style="margin-top:6px;font-size:12.5px;color:var(--success)">✓ "${esc(posState.coupon.applied.code)}" applied — you saved ₹${inr(posState.coupon.applied.discountAmount)}</div>
          `}
          ${posState.coupon.error ? `<div style="margin-top:6px;font-size:12.5px;color:#b91c1c">${esc(posState.coupon.error)}</div>` : ''}
          ${(!posState.coupon.applied || posState.coupon.autoApplied) && (ordersState.activeCoupons || []).length ? `
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)">
              <div class="text-muted" style="font-size:11px;margin-bottom:6px">Available coupons — tap to apply</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${ordersState.activeCoupons.map(c => `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px dashed ${c.isWelcome ? 'var(--brand)' : 'var(--border)'};border-radius:8px;padding:6px 10px">
                    <div style="min-width:0">
                      <div style="font-size:12px;font-weight:700">${c.autoApply ? '✨ ' : (c.isWelcome ? '🎉 ' : '')}${esc(c.code)} — ${c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${inr(c.discountValue)} off`}</div>
                      ${c.description ? `<div class="text-muted" style="font-size:10.5px">${esc(c.description)}</div>` : ''}
                    </div>
                    ${c.autoApply
                      ? `<span class="pill pill-good" style="white-space:nowrap;flex-shrink:0">Auto-applied</span>`
                      : `<button type="button" class="btn btn-outline btn-sm" data-cart-coupon-apply="${esc(c.code)}" style="flex-shrink:0" ${subtotal < c.minOrderAmount ? 'disabled title="Minimum order ₹' + inr(c.minOrderAmount) + ' not reached"' : ''}>Apply</button>`}
                  </div>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);font-size:13px;color:var(--text-secondary)">
          <span>Subtotal</span><span>₹${inr(subtotal)}</span>
        </div>
        ${discount > 0 ? `
        <div style="display:flex;justify-content:space-between;padding-top:4px;font-size:13px;color:var(--success)">
          <span>🏷️ Discount (${esc(posState.coupon.applied.code)})</span><span>−₹${inr(discount)}</span>
        </div>` : ''}
        ${deliveryCharge > 0 ? `
        <div style="display:flex;justify-content:space-between;padding-top:4px;font-size:13px;color:var(--text-secondary)">
          <span>🚚 Delivery charge</span><span>₹${inr(deliveryCharge)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding-top:4px;font-weight:700;font-size:15px">
          <span>Total</span><span>₹${inr(total)}</span>
        </div>

        <div style="display:flex;gap:8px;margin:10px 0">
          <label class="btn ${posState.paymentMethod === 'offline' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
            <input type="radio" name="pos-payment" value="offline" data-pos-payment-method style="margin-right:4px" ${posState.paymentMethod === 'offline' ? 'checked' : ''}> 💵 Cash
          </label>
          <label class="btn ${posState.paymentMethod === 'online' ? 'btn-primary' : 'btn-outline'} btn-sm" style="cursor:pointer;flex:1;justify-content:center">
            <input type="radio" name="pos-payment" value="online" data-pos-payment-method style="margin-right:4px" ${posState.paymentMethod === 'online' ? 'checked' : ''}> 🔒 Online
          </label>
        </div>

        ${posState.paymentMethod === 'online' ? paymentPanelHtml(posState, total, 'pos-pay') : ''}

        ${posState.paymentMethod === 'online' && posState.payState === 'success' ? `<div style="color:var(--success);font-size:12px;font-weight:600;margin-bottom:8px;text-align:center">✓ Paid · ${esc(posState.payResult.razorpayPaymentId)}</div>` : ''}

        <button class="btn btn-primary" id="pos-place-order" style="width:100%;justify-content:center;margin-top:8px" ${cartItems.length === 0 || (posState.paymentMethod === 'online' && posState.payState !== 'success') ? 'disabled' : ''}>${placeLabel}</button>
      </div>
    </div>`;
}

function posPanelHtml() {
  const cartItems = Object.values(posState.cart);
  const total = Math.max(0, posCartTotal() - posDiscountAmount() + deliveryChargeFor(posState));
  const itemCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const sellable = ordersState.products.filter(p => p.isAvailable);
  const auto = activeAutoCoupon();
  const countdown = auto ? couponCountdownText(auto.validUntil) : null;

  return `
  <div class="card" style="margin-bottom:20px;padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="card-title" style="margin-bottom:0">🧾 New Order</div>
      <button type="button" class="btn btn-outline btn-sm" id="pos-cart-toggle" style="position:relative">
        🛒 Cart${itemCount > 0 ? ` · ₹${inr(total)}` : ''}
        ${itemCount > 0 ? `<span style="position:absolute;top:-7px;right:-7px;background:var(--danger,#e11d48);color:#fff;border-radius:999px;font-size:10.5px;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 4px">${itemCount}</span>` : ''}
      </button>
    </div>

    ${auto ? `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;background:var(--brand-bg,#fdf3e7);border:1px dashed var(--brand);border-radius:8px;padding:8px 12px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700">✨ Special Day Sale — ${auto.discountType === 'percent' ? `${auto.discountValue}% off` : `₹${inr(auto.discountValue)} off`} everything!</div>
        ${countdown ? `<div class="text-muted" style="font-size:11.5px">⏳ ${countdown}</div>` : ''}
      </div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;max-height:460px;overflow-y:auto;padding-right:4px">
      ${sellable.length === 0 ? `<div class="text-muted" style="font-size:13px">No products available yet — add some in Product Catalog first.</div>` : sellable.map(item => {
        const inCart = posState.cart[item.name];
        // stockQty is null when the product has no recipe linked yet — in
        // that case stock isn't tracked, so it's always orderable.
        const tracked = item.stockQty !== null && item.stockQty !== undefined;
        const outOfStock = tracked && item.stockQty <= 0;
        const rev = ordersState.reviewSummary[item.name];
        const discountedPrice = auto ? autoDiscountedPrice(item.sellingPrice, auto) : null;
        return `
        <div style="border:1px solid ${inCart ? 'var(--brand)' : (posState.selectedItem === item.name ? 'var(--brand)' : 'var(--border)')};border-radius:10px;padding:10px;background:var(--surface,#fff);display:flex;flex-direction:column;gap:6px;opacity:${outOfStock ? 0.5 : 1}">
          <div data-view-item="${esc(item.name)}" style="cursor:pointer">
            ${item.imageUrl
              ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.name)}" style="width:100%;height:72px;object-fit:cover;border-radius:8px" onerror="this.outerHTML='<div style=&quot;font-size:24px&quot;>🧁</div>'">`
              : `<div style="font-size:24px">🧁</div>`}
            <div class="font-medium" style="font-size:12.5px;line-height:1.3;margin-top:4px">${esc(item.name)}</div>
            ${rev ? `<div style="display:flex;align-items:center;gap:3px;margin-top:2px">${starsHtml(rev.averageRating, 11)}<span class="text-muted" style="font-size:10.5px">(${rev.reviewCount})</span></div>` : `<div class="text-muted" style="font-size:10.5px;margin-top:2px">No reviews yet</div>`}
          </div>
          ${discountedPrice !== null
            ? `<div style="font-size:11.5px"><span class="text-muted" style="text-decoration:line-through">₹${inr(item.sellingPrice)}</span> <span class="font-medium" style="color:var(--success)">₹${inr(discountedPrice)}</span>${outOfStock ? ' · out of stock' : ''}</div>`
            : `<div class="text-muted" style="font-size:11.5px">₹${inr(item.sellingPrice)}${outOfStock ? ' · out of stock' : ''}</div>`}
          ${outOfStock
            ? `<button type="button" class="btn btn-outline btn-sm" disabled style="justify-content:center;border-radius:20px">Out of stock</button>`
            : inCart
              ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:0;border:1px solid var(--brand);border-radius:20px;overflow:hidden">
                   <button type="button" class="btn btn-primary btn-sm btn-icon" data-pos-dec="${esc(item.name)}" style="border-radius:0;flex:1;justify-content:center">−</button>
                   <span class="font-medium" style="flex:1;text-align:center;font-size:13px;color:var(--brand)">${inCart.qty}</span>
                   <button type="button" class="btn btn-primary btn-sm btn-icon" data-pos-inc="${esc(item.name)}" style="border-radius:0;flex:1;justify-content:center">+</button>
                 </div>`
              : `<button type="button" class="btn btn-outline btn-sm" data-pos-add="${esc(item.name)}" style="justify-content:center;border-radius:20px;border-width:2px;font-weight:700;letter-spacing:.4px;color:var(--brand);border-color:var(--brand)">ADD</button>`}
        </div>`;
      }).join('')}
    </div>

    ${cartDrawerHtml()}
  </div>`;
}

function wirePosPanel(content, onOrderPlaced) {
  const isCustomer = window.CURRENT_ROLE === 'customer';
  const productByName = (name) => ordersState.products.find(x => x.name === name);
  // null stockQty = not tracked (no recipe linked) — treat as unlimited.
  const availableQty = (p) => (p && p.stockQty !== null && p.stockQty !== undefined) ? p.stockQty : Infinity;

  const cartToggle = $('#pos-cart-toggle', content);
  if (cartToggle) cartToggle.addEventListener('click', () => {
    posState.cartOpen = true;
    onOrderPlaced.redraw();
    syncAutoCoupon(onOrderPlaced.redraw);
  });
  $$('[data-cart-close]', content).forEach(el => el.addEventListener('click', () => {
    posState.cartOpen = false;
    onOrderPlaced.redraw();
  }));

  $$('[data-pos-add]', content).forEach(btn => btn.addEventListener('click', () => {
    const name = btn.dataset.posAdd;
    const prod = productByName(name);
    if (!prod) return;
    const max = availableQty(prod);
    if (max <= 0) return;
    const existing = posState.cart[name];
    const currentQty = existing ? existing.qty : 0;
    if (currentQty + 1 > max) return toast(`Only ${max} of "${name}" in stock`, 'error');
    posState.cart[name] = { name, price: prod.sellingPrice, qty: currentQty + 1 };
    onOrderPlaced.redraw();
    syncAutoCoupon(onOrderPlaced.redraw);
  }));
  $$('[data-pos-inc]', content).forEach(btn => btn.addEventListener('click', () => {
    const name = btn.dataset.posInc;
    const prod = productByName(name);
    const item = posState.cart[name];
    if (!item) return;
    const max = availableQty(prod);
    if (item.qty + 1 > max) return toast(`Only ${max} of "${name}" in stock`, 'error');
    item.qty += 1;
    onOrderPlaced.redraw();
    syncAutoCoupon(onOrderPlaced.redraw);
  }));
  $$('[data-pos-dec]', content).forEach(btn => btn.addEventListener('click', () => {
    const name = btn.dataset.posDec;
    const item = posState.cart[name];
    if (!item) return;
    item.qty -= 1;
    if (item.qty <= 0) delete posState.cart[name];
    onOrderPlaced.redraw();
    syncAutoCoupon(onOrderPlaced.redraw);
  }));
  $$('[data-pos-remove]', content).forEach(btn => btn.addEventListener('click', () => {
    delete posState.cart[btn.dataset.posRemove];
    onOrderPlaced.redraw();
    syncAutoCoupon(onOrderPlaced.redraw);
  }));

  $$('[data-view-item]', content).forEach(el => el.addEventListener('click', () => {
    navigate('product/' + encodeURIComponent(el.dataset.viewItem));
  }));

  const custSelect = $('#pos-customer-select', content);
  if (custSelect) custSelect.addEventListener('change', (e) => {
    const cust = ordersState.customers.find(c => c.id === e.target.value);
    posState.customerId = e.target.value;
    posState.customerName = cust ? cust.name : posState.customerName;
    posState.phone = cust ? (cust.phone || '') : posState.phone;
    onOrderPlaced.redraw();
  });
  const nameInput = $('#pos-customer-name', content);
  if (nameInput) nameInput.addEventListener('input', (e) => { posState.customerName = e.target.value; posState.customerId = ''; });
  const phoneInput = $('#pos-customer-phone', content);
  if (phoneInput) phoneInput.addEventListener('input', (e) => { posState.phone = e.target.value; });
  const addrInput = $('#pos-address', content);
  if (addrInput) addrInput.addEventListener('input', (e) => { posState.address = e.target.value; });

  const couponInput = $('#pos-coupon-input', content);
  if (couponInput) couponInput.addEventListener('input', (e) => { posState.coupon.code = e.target.value.toUpperCase(); });
  const couponApply = $('#pos-coupon-apply', content);
  if (couponApply) couponApply.addEventListener('click', async () => {
    const code = posState.coupon.code.trim();
    if (!code) return;
    posState.coupon.checking = true;
    posState.coupon.error = '';
    onOrderPlaced.redraw();
    try {
      const result = await api.validateCoupon(code, posCartTotal());
      posState.coupon.applied = result;
      // A manually-entered coupon always takes over from whatever's on the
      // cart right now (including an auto-applied Special Day Sale) — this
      // is a deliberate swap, not a stacking of two discounts.
      posState.coupon.autoApplied = false;
      posState.coupon.error = '';
      toast(`Coupon "${result.code}" applied — you saved ₹${inr(result.discountAmount)}!`, 'success');
    } catch (err) {
      posState.coupon.applied = null;
      posState.coupon.error = err.message;
    } finally {
      // finally guarantees this resets even if something above throws
      // unexpectedly, so the button never gets stuck on "Checking…".
      posState.coupon.checking = false;
      onOrderPlaced.redraw();
    }
  });
  $$('[data-cart-coupon-apply]', content).forEach(btn => btn.addEventListener('click', () => {
    const code = btn.dataset.cartCouponApply;
    if (posState.coupon.applied && !posState.coupon.autoApplied && posState.coupon.applied.code !== code) {
      toast('Only one coupon can be applied per order', 'error');
      return;
    }
    posState.coupon.code = code;
    const applyBtn = $('#pos-coupon-apply', content);
    if (applyBtn) applyBtn.click();
  }));

  const couponRemove = $('#pos-coupon-remove', content);
  if (couponRemove) couponRemove.addEventListener('click', () => {
    posState.coupon = { code: '', applied: null, error: '', checking: false, autoApplied: false };
    onOrderPlaced.redraw();
    // A Special Day Sale coupon should still kick back in automatically
    // after a manual code is removed, as long as the cart still qualifies.
    syncAutoCoupon(onOrderPlaced.redraw);
  });

  $$('[data-pos-delivery-type]', content).forEach(radio => radio.addEventListener('change', (e) => {
    posState.deliveryType = e.target.value;
    onOrderPlaced.redraw();
  }));
  $$('[data-pos-payment-method]', content).forEach(radio => radio.addEventListener('change', (e) => {
    posState.paymentMethod = e.target.value;
    posState.payState = 'idle';
    posState.payResult = null;
    onOrderPlaced.redraw();
  }));

  // The cart as a createOrder body (minus payment), or null after telling
  // the user what's missing — also what an online payment is opened for.
  const posOrderData = () => {
    const items = Object.values(posState.cart).map(i => ({ name: i.name, qty: i.qty, price: i.price }));
    if (!items.length) { toast('Add at least one item', 'error'); return null; }
    const customerName = isCustomer ? (posState.customerName || window.CURRENT_USERNAME || '') : posState.customerName.trim();
    if (!customerName) { toast('Customer name required', 'error'); return null; }
    if (posState.deliveryType === 'delivery' && !posState.address.trim()) { toast('Enter a delivery address', 'error'); return null; }
    return {
      customerName, customerId: posState.customerId || null, customerPhone: posState.phone, customerEmail: posState.email || '',
      deliveryType: posState.deliveryType, deliveryAddress: posState.address,
      items, paymentMethod: posState.paymentMethod,
      couponCode: posState.coupon.applied ? posState.coupon.applied.code : '',
    };
  };

  const placePosOrder = async () => {
    const data = posOrderData();
    if (!data) return;
    if (posState.paymentMethod === 'online' && posState.payState !== 'success') return toast('Complete payment first', 'error');

    const payment = posState.paymentMethod === 'online' ? posState.payResult : undefined;
    try {
      const created = await api.createOrder({ ...data, payment });
      toast('Order created!', 'success');
      const wasOnline = posState.paymentMethod === 'online';
      posState = defaultPosState(isCustomer);
      await onOrderPlaced.refresh();
      if (wasOnline) {
        openReceiptModal({ ...created, amount: created.total }, { title: 'Payment Successful' });
      }
    } catch (err) { toast(err.message, 'error'); }
  };

  wirePaymentPanel(content, posState, Math.max(0, posCartTotal() - posDiscountAmount() + deliveryChargeFor(posState)), 'pos-pay', onOrderPlaced.redraw, posOrderData, placePosOrder);

  const placeBtn = $('#pos-place-order', content);
  if (placeBtn) placeBtn.addEventListener('click', placePosOrder);
}

async function renderProductDetail(content, itemName) {
  const isCustomer = window.CURRENT_ROLE === 'customer';
  const [productsResp, detail, reviewable, customers] = await Promise.all([
    ordersState.products && ordersState.products.length ? Promise.resolve({ products: ordersState.products }) : api.getProducts(),
    api.getReviewsForItem(itemName),
    isCustomer ? api.getReviewableItem(itemName) : Promise.resolve({ eligibleOrderId: null }),
    isCustomer || (ordersState.customers && ordersState.customers.length) ? Promise.resolve(ordersState.customers || []) : api.getCustomers(),
  ]);
  const products = productsResp.products || productsResp;
  ordersState.products = products;
  ordersState.customers = customers;
  const item = products.find(x => x.name === itemName);
  const tracked = item && item.stockQty !== null && item.stockQty !== undefined;
  const stockAvailable = item ? (tracked ? item.stockQty : Infinity) : 0;
  let draft = { rating: 5, comment: '', imageUrl: '' };

  const draw = () => {
    content.innerHTML = `
    <div style="max-width:760px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <button type="button" class="btn btn-outline btn-sm" id="pd-back">← Back to New Order</button>
        <button type="button" class="btn btn-outline btn-sm" id="pd-cart" style="position:relative">
          🛒 Cart${Object.keys(posState.cart).length > 0 ? ` · ₹${inr(posCartTotal())}` : ''}
          ${Object.keys(posState.cart).length > 0 ? `<span style="position:absolute;top:-7px;right:-7px;background:var(--danger,#e11d48);color:#fff;border-radius:999px;font-size:10.5px;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 4px">${Object.values(posState.cart).reduce((s, i) => s + i.qty, 0)}</span>` : ''}
        </button>
      </div>

      <div class="card" style="padding:24px;margin-bottom:20px">
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          ${item && item.imageUrl
            ? `<img src="${esc(item.imageUrl)}" alt="${esc(itemName)}" style="width:200px;height:200px;object-fit:cover;border-radius:12px;flex-shrink:0">`
            : `<div style="width:200px;height:200px;border-radius:12px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:64px;flex-shrink:0">🧁</div>`}
          <div style="flex:1;min-width:220px">
            <div style="font-size:24px;font-weight:700;margin-bottom:8px">${esc(itemName)}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              ${starsHtml(detail.averageRating, 18)}
              <span class="font-medium" style="font-size:14px">${detail.averageRating || '—'}</span>
              <span class="text-muted" style="font-size:13px">(${detail.reviewCount} review${detail.reviewCount === 1 ? '' : 's'})</span>
            </div>
            ${item ? (() => {
              const auto = activeAutoCoupon();
              const discountedPrice = auto ? autoDiscountedPrice(item.sellingPrice, auto) : null;
              return discountedPrice !== null
                ? `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px"><span class="text-muted" style="font-size:16px;text-decoration:line-through">₹${inr(item.sellingPrice)}</span><span style="font-size:20px;font-weight:700;color:var(--success)">₹${inr(discountedPrice)}</span></div>`
                : `<div style="font-size:20px;font-weight:700;margin-bottom:10px">₹${inr(item.sellingPrice)}</div>`;
            })() : ''}
            ${item ? `<div class="text-muted" style="font-size:13px;margin-bottom:14px">${stockAvailable > 0 ? 'In stock' : 'Out of stock'}</div>` : ''}
            ${item ? (() => {
              const outOfStock = stockAvailable <= 0;
              const inCart = posState.cart[item.name];
              if (outOfStock) return `<button type="button" class="btn btn-outline btn-sm" disabled style="border-radius:20px">Out of stock</button>`;
              return `
              <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                ${inCart ? `
                  <div style="display:flex;align-items:center;border:2px solid var(--brand);border-radius:20px;overflow:hidden">
                    <button type="button" class="btn btn-primary btn-sm btn-icon" data-pd-dec="${esc(item.name)}" style="border-radius:0">−</button>
                    <span class="font-medium" style="width:34px;text-align:center;font-size:13px">${inCart.qty}</span>
                    <button type="button" class="btn btn-primary btn-sm btn-icon" data-pd-inc="${esc(item.name)}" style="border-radius:0">+</button>
                  </div>` : `
                  <button type="button" class="btn btn-outline btn-sm" data-pd-add="${esc(item.name)}" style="border-radius:20px;border-width:2px;font-weight:700;letter-spacing:.4px;color:var(--brand);border-color:var(--brand);padding:8px 22px">ADD TO CART</button>`}
                <button type="button" class="btn btn-primary btn-sm" data-pd-buy="${esc(item.name)}" style="border-radius:20px;font-weight:700;letter-spacing:.4px;padding:8px 22px">BUY NOW</button>
              </div>`;
            })() : ''}
          </div>
        </div>
      </div>

      ${isCustomer ? (
        reviewable.eligibleOrderId ? `
        <div class="card" style="padding:20px;margin-bottom:20px">
          <div class="font-medium" style="font-size:15px;margin-bottom:10px">Rate this product</div>
          ${interactiveStarsHtml(draft.rating, 'pd-review')}
          <textarea class="form-input" id="pd-review-comment" rows="3" placeholder="Share your experience (optional)" style="margin-top:10px"></textarea>
          <div class="form-group" style="margin-top:10px">
            <label class="form-label">Add a photo <span class="text-muted" style="font-weight:400">(optional)</span></label>
            <input type="file" accept="image/*" class="form-input" id="pd-review-image-file">
            <img id="pd-review-image-preview" src="${esc(draft.imageUrl || '')}" alt="" style="margin-top:8px;width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:${draft.imageUrl ? 'block' : 'none'}">
          </div>
          <button class="btn btn-primary btn-sm" id="pd-review-submit" style="margin-top:10px">Submit Review</button>
        </div>` : `
        <div class="card" style="padding:16px 20px;margin-bottom:20px">
          <div class="text-muted" style="font-size:13px">You can review this item once an order containing it has been delivered to you.</div>
        </div>`
      ) : ''}

      <div class="card" style="padding:20px">
        <div class="font-medium" style="font-size:15px;margin-bottom:12px">Customer Reviews</div>
        ${detail.reviews.length === 0 ? `
          <div class="text-muted" style="font-size:13px">No reviews yet — be the first to review this item.</div>` : `
          <div style="display:flex;flex-direction:column;gap:14px">
            ${detail.reviews.map(r => `
              <div style="border-bottom:1px solid var(--border);padding-bottom:10px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <div style="display:flex;align-items:center;gap:8px">
                    ${starsHtml(r.rating, 13)}
                    <span class="font-medium" style="font-size:13.5px">${esc(r.customerName)}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="text-muted" style="font-size:12px">${dateStr(r.createdAt)}</span>
                    ${r.canManage ? `<button class="btn btn-danger btn-sm btn-icon" data-pd-review-delete="${r.id}" style="width:22px;height:22px;font-size:12px">✕</button>` : ''}
                  </div>
                </div>
                ${r.comment ? `<div style="font-size:13px;margin-top:5px">${esc(r.comment)}</div>` : ''}
                ${r.imageUrl ? `<img src="${esc(r.imageUrl)}" alt="Review photo" style="margin-top:8px;width:88px;height:88px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" data-pd-review-image-view="${esc(r.imageUrl)}">` : ''}
              </div>`).join('')}
          </div>`}
      </div>
    </div>

    ${cartDrawerHtml()}`;

    $('#pd-back', content).addEventListener('click', () => {
      // Use real browser history navigation instead of pushing a brand new
      // 'new-order' hash entry. Previously this always did navigate('new-order'),
      // which meant every visit to a product page followed by "Back to New
      // Order" added TWO new history entries (product/x, then new-order).
      // That made the browser Back button just bounce between the product
      // page and the New Order form forever, and the user could never get
      // back past them to the Orders/Products list underneath.
      window.history.back();
    });
    const cartBtn = $('#pd-cart', content);
    if (cartBtn) cartBtn.addEventListener('click', () => { posState.cartOpen = true; draw(); });

    if (item) {
      const addBtn = $('[data-pd-add]', content);
      if (addBtn) addBtn.addEventListener('click', () => {
        const existing = posState.cart[item.name];
        const currentQty = existing ? existing.qty : 0;
        if (currentQty + 1 > stockAvailable) return toast('Not enough stock', 'error');
        posState.cart[item.name] = { name: item.name, price: item.sellingPrice, qty: currentQty + 1 };
        toast('Added to cart', 'success');
        draw();
        syncAutoCoupon(draw);
      });
      const incBtn = $('[data-pd-inc]', content);
      if (incBtn) incBtn.addEventListener('click', () => {
        const c = posState.cart[item.name];
        if (!c) return;
        if (c.qty + 1 > stockAvailable) return toast('Not enough stock', 'error');
        c.qty += 1;
        draw();
        syncAutoCoupon(draw);
      });
      const decBtn = $('[data-pd-dec]', content);
      if (decBtn) decBtn.addEventListener('click', () => {
        const c = posState.cart[item.name];
        if (!c) return;
        c.qty -= 1;
        if (c.qty <= 0) delete posState.cart[item.name];
        draw();
        syncAutoCoupon(draw);
      });
      const buyBtn = $('[data-pd-buy]', content);
      if (buyBtn) buyBtn.addEventListener('click', () => {
        const existing = posState.cart[item.name];
        const currentQty = existing ? existing.qty : 0;
        if (currentQty < 1) {
          if (1 > stockAvailable) return toast('Not enough stock', 'error');
          posState.cart[item.name] = { name: item.name, price: item.sellingPrice, qty: 1 };
        }
        posState.cartOpen = true;
        draw();
        syncAutoCoupon(draw);
      });
    }

    const starGroup = $('[data-star-group]', content);
    if (starGroup) $$('[data-star-value]', starGroup).forEach(star => star.addEventListener('click', () => {
      draft.rating = parseInt(star.dataset.starValue, 10);
      $$('[data-star-value]', starGroup).forEach(s => { s.style.color = parseInt(s.dataset.starValue, 10) <= draft.rating ? '#f5a623' : 'var(--border)'; });
    }));
    const commentBox = $('#pd-review-comment', content);
    if (commentBox) commentBox.addEventListener('input', (e) => { draft.comment = e.target.value; });
    const reviewImageFile = $('#pd-review-image-file', content);
    if (reviewImageFile) reviewImageFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return toast('Please choose an image file', 'error');
      if (file.size > 8 * 1024 * 1024) return toast('Image is too large (max 8MB)', 'error');
      try {
        const dataUrl = await compressImageFile(file, 600, 0.75);
        draft.imageUrl = dataUrl;
        const preview = $('#pd-review-image-preview', content);
        if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
      } catch (err) {
        toast('Could not process that image, please try another', 'error');
      }
    });
    const submitBtn = $('#pd-review-submit', content);
    if (submitBtn) submitBtn.addEventListener('click', async () => {
      try {
        await api.submitReview({ orderId: reviewable.eligibleOrderId, itemName, rating: draft.rating, comment: draft.comment.trim(), imageUrl: draft.imageUrl || '' });
        toast('Thanks for your review!', 'success');
        await refresh();
      } catch (err) { toast(err.message, 'error'); }
    });
    $$('[data-pd-review-image-view]', content).forEach(img => img.addEventListener('click', () => {
      viewImageLightbox(img.dataset.pdReviewImageView);
    }));
    $$('[data-pd-review-delete]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Delete this review?', async () => {
        try { await api.deleteReview(btn.dataset.pdReviewDelete); toast('Review deleted', 'success'); await refresh(); }
        catch (err) { toast(err.message, 'error'); }
      });
    }));

    if (posState.cartOpen) wirePosPanel(content, { redraw: draw, refresh: async () => { const d = await api.getProducts(); ordersState.products = d.products || d; draw(); } });
  };

  const refresh = async () => {
    const [freshDetail, freshReviewable] = await Promise.all([
      api.getReviewsForItem(itemName),
      isCustomer ? api.getReviewableItem(itemName) : Promise.resolve({ eligibleOrderId: null }),
    ]);
    detail.averageRating = freshDetail.averageRating;
    detail.reviewCount = freshDetail.reviewCount;
    detail.reviews = freshDetail.reviews;
    reviewable.eligibleOrderId = freshReviewable.eligibleOrderId;
    draft = { rating: 5, comment: '', imageUrl: '' };
    draw();
  };

  draw();
}

async function renderNewOrder(content, resumeAfterReload) {
  // posState is a single global object shared with the Product Details page
  // (so "Buy Now" there can open the same cart drawer). That's fine while
  // you stay on one page, but it meant cartOpen/cartOpen-style flags kept
  // whatever value they had the last time you touched a product — so
  // pressing Back and then re-entering New Order from the nav could land
  // you straight on the "place order" cart drawer instead of the plain New
  // Order landing view. Every fresh navigation onto this page should start
  // from the landing view, not mid-checkout — except a browser refresh,
  // which should put you back exactly where you were.
  if (!resumeAfterReload) posState.cartOpen = false;
  const isCustomer = window.CURRENT_ROLE === 'customer';
  const [customers, products, settings, profile, reviewSummaryData, activeCouponsData] = await Promise.all([
    isCustomer ? Promise.resolve([]) : api.getCustomers(),
    api.getProducts(),
    api.getSettings(),
    isCustomer ? api.getProfile().catch(() => null) : Promise.resolve(null),
    api.getReviewSummary().catch(() => ({ summary: {} })),
    api.getActiveCoupons().catch(() => ({ coupons: [] })),
  ]);
  ordersState.customers = customers; ordersState.products = products.products || products; ordersState.settings = settings;
  ordersState.reviewSummary = reviewSummaryData.summary || {};
  ordersState.activeCoupons = activeCouponsData.coupons || [];

  if (isCustomer && profile) {
    posState.customerName = profile.username || window.CURRENT_USERNAME || '';
    posState.phone = profile.phone || '';
    posState.email = profile.email || '';
    posState.customerId = profile.customerId || '';
  }

  const draw = () => {
    const isCartEmpty = Object.keys(posState.cart).length === 0;
    content.innerHTML = `
      ${bakeryContactHtml(ordersState.settings)}
      ${availableCouponsHtml(ordersState.activeCoupons, isCartEmpty, posCartTotal())}
      ${posPanelHtml()}`;

    const editContactBtn = $('#edit-bakery-contact', content);
    if (editContactBtn) editContactBtn.addEventListener('click', () => {
      openBakeryContactModal(ordersState.settings, async () => { ordersState.settings = await api.getSettings(); draw(); });
    });

    $$('[data-coupon-quick-apply]', content).forEach(btn => btn.addEventListener('click', () => {
      // Cart is empty — nothing to discount, so don't open the checkout
      // drawer or attempt to apply anything. Just tell the user why.
      if (Object.keys(posState.cart).length === 0) {
        toast('Your cart is empty — add items before applying a coupon', 'error');
        return;
      }
      const code = btn.dataset.couponQuickApply;
      // Only one coupon is allowed per order. A manually-applied coupon
      // already sitting in the cart blocks any other manual coupon — a
      // Special Day Sale coupon that auto-applied itself doesn't count,
      // since picking a different coupon here is a deliberate swap.
      if (posState.coupon.applied && !posState.coupon.autoApplied && posState.coupon.applied.code !== code) {
        toast('Only one coupon can be applied per order', 'error');
        return;
      }
      posState.coupon.code = code;
      posState.cartOpen = true;
      draw();
      // Apply it straight away rather than making them retype+click Apply.
      $('#pos-coupon-apply', content) && $('#pos-coupon-apply', content).click();
    }));

    wirePosPanel(content, {
      redraw: () => draw(),
      refresh: async () => { const d = await api.getProducts(); ordersState.products = d.products || d; draw(); },
    });
  };

  draw();
}

async function renderOrders(content) {
  const isCustomer = window.CURRENT_ROLE === 'customer';
  const isDelivery = window.CURRENT_ROLE === 'delivery';
  const canManage = window.CURRENT_ROLE === 'admin' || window.CURRENT_ROLE === 'staff';
  const orders = await api.getOrders();
  ordersState.orders = orders;

  const draw = () => {
    const filtered = ordersState.activeTab === 'all' ? ordersState.orders : ordersState.orders.filter(o => o.status === ordersState.activeTab);
    const counts = STATUSES.reduce((acc, s) => { acc[s] = s === 'all' ? ordersState.orders.length : ordersState.orders.filter(o => o.status === s).length; return acc; }, {});

    content.innerHTML = `
      ${isDelivery ? `<div class="text-muted" style="font-size:13px;margin-bottom:12px">🚚 Showing orders assigned to you for delivery.</div>` : ''}
      <div class="tab-row">
        ${STATUSES.map(s => `<button class="btn ${ordersState.activeTab === s ? 'btn-primary' : 'btn-outline'} btn-sm" data-tab="${s}">${statusLabel(s)} (${counts[s]})</button>`).join('')}
      </div>
      <div class="card">
        ${filtered.length === 0 ? emptyState('🛒', isCustomer ? 'You haven\'t placed any orders yet' : (isDelivery ? 'No orders assigned to you' : 'No orders found')) : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Fulfillment</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th>${canManage || isDelivery || isCustomer ? '<th>Actions</th>' : ''}</tr></thead>
            <tbody>
              ${filtered.map(o => `
                <tr>
                  <td><span class="font-medium">${esc(o.orderNumber)}</span></td>
                  <td>${esc(o.customerName)}${o.customerPhone ? `<div class="text-muted" style="font-size:11.5px">${esc(o.customerPhone)}</div>` : ''}</td>
                  <td style="color:var(--text-secondary);max-width:200px">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</td>
                  <td>
                    <div style="font-size:12.5px">${o.deliveryType === 'delivery' ? '🚚 Delivery' : '🏬 Pickup'}</div>
                    ${o.deliveryType === 'delivery' && o.deliveryAddress ? `<div class="text-muted" style="font-size:11px;max-width:160px">${esc(o.deliveryAddress)}</div>` : ''}
                    ${o.requestedDate ? `<div class="text-muted" style="font-size:11px">By ${esc(o.requestedDate)}</div>` : ''}
                  </td>
                  <td class="font-medium">₹${inr(o.total)}${o.deliveryCharge > 0 ? `<div class="text-muted" style="font-size:11px;font-weight:400">incl. ₹${inr(o.deliveryCharge)} delivery</div>` : ''}${o.discountAmount > 0 ? `<div style="font-size:11px;font-weight:400;color:var(--success)">🏷️ ${esc(o.couponCode || '')} −₹${inr(o.discountAmount)}</div>` : ''}</td>
                  <td>${o.paymentMethod === 'online' ? '<span class="pill pill-paid">Online</span>' : '<span class="pill pill-unpaid">Offline</span>'}</td>
                  <td>${pill(o.status)}</td>
                  <td class="text-muted">${dateStr(o.createdAt)}</td>
                  ${canManage ? `
                  <td>
                    <div style="display:flex;gap:6px">
                      ${(() => {
                        // For delivery orders, once the order is out for delivery
                        // or delivered, that's owned by the delivery partner —
                        // admin only sees it reflected in the status pill/history,
                        // no dropdown to change it.
                        const handedToDelivery = o.deliveryType === 'delivery' && (o.status === 'out_for_delivery' || o.status === 'delivered');
                        if (handedToDelivery || o.status === 'delivered') return '';
                        return `<select class="form-input" style="padding:4px 8px;font-size:12px;width:auto" data-status-select="${o.id}">
                          ${(ORDER_STATUS_OPTIONS[o.deliveryType] || ORDER_STATUS_OPTIONS.pickup).map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
                        </select>`;
                      })()}
                      ${(() => {
                        // Assign-partner button only appears once the order has
                        // been marked ready (or moved further along) — before
                        // that there's nothing to assign yet.
                        if (o.deliveryType !== 'delivery') return '';
                        const readyOrLater = o.status === 'ready' || o.status === 'out_for_delivery' || o.status === 'delivered';
                        if (!readyOrLater) return '';
                        const assigned = !!o.deliveryPartnerName;
                        // Once a partner is assigned, lock the button so it can't be reassigned from here.
                        return `<button class="btn btn-outline btn-sm" data-assign-partner="${o.id}" title="${assigned ? `Assigned to ${esc(o.deliveryPartnerName)}` : 'Assign delivery partner'}" ${assigned ? 'disabled' : ''}>🚚${assigned ? ' Assigned' : ' Assign'}</button>`;
                      })()}
                      ${window.CURRENT_ROLE === 'admin' ? `<button class="btn btn-danger btn-sm btn-icon" data-delete-order="${o.id}" title="Delete">✕</button>` : ''}
                    </div>
                  </td>` : (isDelivery ? `
                  <td>
                    ${o.status === 'ready'
                      ? `<button class="btn btn-primary btn-sm" data-start-delivery="${o.id}">🚚 Start Delivery</button>`
                      : o.status === 'out_for_delivery'
                      ? `<button class="btn btn-primary btn-sm" data-mark-delivered="${o.id}">✅ Mark Delivered</button>`
                      : `<span class="text-muted text-sm">${o.status === 'delivered' ? '✓ Delivered' : 'Not ready yet'}</span>`}
                  </td>` : (isCustomer ? `
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-view-order-receipt="${o.id}">🧾 Slip</button>
                      ${o.status === 'delivered' ? `<button class="btn btn-outline btn-sm" data-rate-order="${o.id}">⭐ Rate</button>` : ''}
                    </div>
                  </td>` : ''))}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $$('[data-tab]', content).forEach(btn => btn.addEventListener('click', () => { ordersState.activeTab = btn.dataset.tab; draw(); }));
    $$('[data-status-select]', content).forEach(sel => sel.addEventListener('change', async (e) => {
      try {
        await api.updateOrderStatus(e.target.dataset.statusSelect, e.target.value);
        toast(`Order marked as ${statusLabel(e.target.value)}`, 'success');
        ordersState.orders = await api.getOrders();
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-start-delivery]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api.updateOrderStatus(btn.dataset.startDelivery, 'out_for_delivery');
        toast('Delivery started — order is on the way!', 'success');
        ordersState.orders = await api.getOrders();
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-mark-delivered]', content).forEach(btn => btn.addEventListener('click', () => {
      const o = ordersState.orders.find(x => x.id === btn.dataset.markDelivered);
      otpConfirmModal(o ? o.orderNumber : '', async (otp) => {
        await api.updateOrderStatus(btn.dataset.markDelivered, 'delivered', otp);
        toast('Order marked as delivered!', 'success');
        ordersState.orders = await api.getOrders();
        draw();
      }, () => api.regenerateOrderOtp(btn.dataset.markDelivered), (o?.deliveryOtpAttempts || 0) >= OTP_MAX_ATTEMPTS);
    }));
    $$('[data-assign-partner]', content).forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled) return; // already assigned — locked
      const o = ordersState.orders.find(x => x.id === btn.dataset.assignPartner);
      openDeliveryPartnerModal(o, async () => { ordersState.orders = await api.getOrders(); draw(); });
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
    $$('[data-view-order-receipt]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        const r = await api.getOrderReceipt(btn.dataset.viewOrderReceipt);
        openReceiptModal(r, { title: r.paymentMethod === 'online' ? 'Payment Receipt' : 'Order Receipt' });
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-rate-order]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        const data = await api.getReviewableItems(btn.dataset.rateOrder);
        openRateOrderModal(btn.dataset.rateOrder, data.items);
      } catch (err) { toast(err.message, 'error'); }
    }));
  };

  draw();
}

function openRateOrderModal(orderId, items) {
  let drafts = {};
  items.forEach(it => { if (!it.alreadyReviewed) drafts[it.itemName] = { rating: 5, comment: '', imageUrl: '' }; });

  const bodyHtml = items.length === 0
    ? `<div class="text-muted">No items found on this order.</div>`
    : items.map(it => it.alreadyReviewed
        ? `<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="font-medium" style="font-size:13.5px">${esc(it.itemName)}</div><div class="text-muted" style="font-size:12px">✓ Already reviewed</div></div>`
        : `<div style="padding:10px 0;border-bottom:1px solid var(--border)" data-rate-item="${esc(it.itemName)}">
             <div class="font-medium" style="font-size:13.5px;margin-bottom:6px">${esc(it.itemName)}</div>
             ${interactiveStarsHtml(5, esc(it.itemName))}
             <textarea class="form-input" rows="2" placeholder="Share your experience (optional)" data-rate-comment="${esc(it.itemName)}" style="margin-top:6px"></textarea>
             <input type="file" accept="image/*" class="form-input" data-rate-image="${esc(it.itemName)}" style="margin-top:6px">
             <img data-rate-image-preview="${esc(it.itemName)}" src="" alt="" style="margin-top:6px;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:none">
             <button class="btn btn-primary btn-sm" data-rate-submit="${esc(it.itemName)}" style="margin-top:6px">Submit Review</button>
           </div>`
      ).join('');
  const footerHtml = `<button class="btn btn-outline" data-cancel>Close</button>`;

  openModal({
    title: 'Rate & Review',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelectorAll('[data-rate-item]').forEach(row => {
        const name = row.dataset.rateItem;
        row.querySelectorAll('[data-star-value]').forEach(star => star.addEventListener('click', () => {
          drafts[name].rating = parseInt(star.dataset.starValue, 10);
          row.querySelectorAll('[data-star-value]').forEach(s => {
            s.style.color = parseInt(s.dataset.starValue, 10) <= drafts[name].rating ? '#f5a623' : 'var(--border)';
          });
        }));
      });
      overlay.querySelectorAll('[data-rate-comment]').forEach(ta => ta.addEventListener('input', (e) => {
        drafts[ta.dataset.rateComment].comment = e.target.value;
      }));
      overlay.querySelectorAll('[data-rate-image]').forEach(fileInput => fileInput.addEventListener('change', async (e) => {
        const name = fileInput.dataset.rateImage;
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast('Please choose an image file', 'error');
        if (file.size > 8 * 1024 * 1024) return toast('Image is too large (max 8MB)', 'error');
        try {
          const dataUrl = await compressImageFile(file, 600, 0.75);
          drafts[name].imageUrl = dataUrl;
          const preview = overlay.querySelector(`[data-rate-image-preview="${CSS.escape(name)}"]`);
          if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
        } catch (err) {
          toast('Could not process that image, please try another', 'error');
        }
      }));
      overlay.querySelectorAll('[data-rate-submit]').forEach(btn => btn.addEventListener('click', async () => {
        const name = btn.dataset.rateSubmit;
        try {
          await api.submitReview({ orderId, itemName: name, rating: drafts[name].rating, comment: drafts[name].comment.trim(), imageUrl: drafts[name].imageUrl || '' });
          toast('Thanks for your review!', 'success');
          closeModal();
        } catch (err) { toast(err.message, 'error'); }
      }));
    },
  });
}

// ── Inventory ────────────────────────────────────────────────────────────
let inventoryState = { items: [], search: '' };

function openInventoryModal(item, onSaved, suppliers = []) {
  const form = item ? { ...item } : { name: '', quantity: '', unit: 'kg', minStock: '', costPerUnit: '', imageUrl: '', supplierId: '' };
  const bodyHtml = `
    <div class="form-group">
      <label class="form-label">Item name</label>
      <input class="form-input" id="inv-name" value="${esc(form.name)}" placeholder="e.g. All-purpose Flour">
    </div>
    <div class="form-group">
      <label class="form-label">Product image ${item ? '' : '<span style="color:var(--danger,#dc2626)">*</span>'} <span class="text-muted" style="font-weight:400">(shown on the New Order page)</span></label>
      <input type="file" accept="image/*" class="form-input" id="inv-image-file">
      <input type="hidden" id="inv-image" value="${esc(form.imageUrl || '')}">
      <img id="inv-image-preview" src="${esc(form.imageUrl || '')}" alt="" style="margin-top:8px;width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:${form.imageUrl ? 'block' : 'none'}">
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
    </div>
    <div class="form-group">
      <label class="form-label">Preferred supplier <span class="text-muted" style="font-weight:400">(optional)</span></label>
      <select class="form-input" id="inv-supplier">
        <option value="">— None —</option>
        ${suppliers.map(s => `<option value="${s.id}" ${form.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="inv-save">Save</button>`;

  openModal({
    title: item ? 'Edit Item' : 'Add Inventory Item',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);

      // Reading the chosen file and turning it into a data URL is how the
      // image actually gets "imported" — no separate file-storage server
      // needed, it just travels as a string in the same JSON save request.
      overlay.querySelector('#inv-image-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast('Please choose an image file', 'error');
        if (file.size > 8 * 1024 * 1024) return toast('Image is too large (max 8MB)', 'error');
        try {
          // Resized/re-compressed client-side before it ever becomes a data
          // URL, so it comfortably fits under MySQL's max_allowed_packet /
          // innodb redo log limits regardless of how big the original photo was.
          const dataUrl = await compressImageFile(file, 800, 0.8);
          overlay.querySelector('#inv-image').value = dataUrl;
          const preview = overlay.querySelector('#inv-image-preview');
          preview.src = dataUrl;
          preview.style.display = 'block';
        } catch (err) {
          toast('Could not process that image, please try another', 'error');
        }
      });

      overlay.querySelector('#inv-save').addEventListener('click', async () => {
        const name = overlay.querySelector('#inv-name').value.trim();
        const quantity = overlay.querySelector('#inv-qty').value;
        const imageUrl = overlay.querySelector('#inv-image').value.trim();
        if (!name || quantity === '') return toast('Name and quantity required', 'error');
        if (!item && !imageUrl) return toast('Please import a product image', 'error');
        const payload = {
          name, quantity,
          unit: overlay.querySelector('#inv-unit').value,
          minStock: overlay.querySelector('#inv-min').value,
          costPerUnit: overlay.querySelector('#inv-cost').value,
          imageUrl,
          supplierId: overlay.querySelector('#inv-supplier').value,
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
  const suppliers = await api.getSuppliers().catch(() => []);
  // Needed to tell which inventory rows are finished/sellable goods (linked
  // as some recipe's output) vs raw ingredients bought from suppliers —
  // same distinction already used in Recipe Management and Production.
  const recipesData = await api.getRecipes().catch(() => ({ recipes: [] }));
  const finishedIds = new Set((recipesData.recipes || []).map(r => r.linkedItemId).filter(Boolean));

  const invRowHtml = (item) => `
    <tr>
      <td class="font-medium">${esc(item.name)}</td>
      <td>${item.quantity}</td>
      <td class="text-muted">${esc(item.unit)}</td>
      <td class="text-muted">${item.minStock} ${esc(item.unit)}</td>
      <td>${stockBar(item.quantity, item.minStock)}</td>
      <td>${pill(item.status)}</td>
      <td class="text-muted">${item.supplierName ? esc(item.supplierName) : '—'}</td>
      <td class="text-muted">₹${inr(item.quantity * item.costPerUnit)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" data-edit-item="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm btn-icon" data-delete-item="${item.id}">✕</button>
        </div>
      </td>
    </tr>`;

  const invTableHtml = (items) => items.length === 0 ? emptyState('📦', 'No items here') : `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Min Stock</th><th>Stock Level</th><th>Status</th><th>Supplier</th><th>Value</th><th>Actions</th></tr></thead>
        <tbody>${items.map(invRowHtml).join('')}</tbody>
      </table>
    </div>`;

  const draw = () => {
    const filtered = inventoryState.items.filter(i => i.name.toLowerCase().includes(inventoryState.search.toLowerCase()));
    const finishedItems = filtered.filter(i => finishedIds.has(i.id));
    const rawItems = filtered.filter(i => !finishedIds.has(i.id));
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
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <span class="card-title">Finished Products <span class="text-muted" style="font-weight:400">— linked to a recipe (${finishedItems.length})</span></span>
          <div style="display:flex;gap:10px">
            <div class="search-bar"><span>🔍</span><input id="inv-search" placeholder="Search…" value="${esc(inventoryState.search)}"></div>
            <button class="btn btn-primary" id="inv-add">+ Add Item</button>
          </div>
        </div>
        ${invTableHtml(finishedItems)}
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Raw Ingredients <span class="text-muted" style="font-weight:400">— not linked to any recipe output (${rawItems.length})</span></span>
        </div>
        ${invTableHtml(rawItems)}
      </div>`;

    $('#inv-search', content).addEventListener('input', (e) => { inventoryState.search = e.target.value; draw(); });
    $('#inv-add', content).addEventListener('click', () => openInventoryModal(null, async () => { inventoryState.items = await api.getInventory(); draw(); }, suppliers));
    $$('[data-edit-item]', content).forEach(btn => btn.addEventListener('click', () => {
      const item = inventoryState.items.find(i => i.id === btn.dataset.editItem);
      openInventoryModal(item, async () => { inventoryState.items = await api.getInventory(); draw(); }, suppliers);
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
      confirmDialog('Remove this customer? Their orders and invoices will also be removed from Sales & Billing.', async () => {
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

// ── Suppliers (admin/staff read, admin write) ───────────────────────────
let suppliersState = { list: [], search: '' };

const SUPPLIER_CATEGORIES = ['Flour & Grains', 'Dairy', 'Eggs', 'Sugar & Sweeteners', 'Packaging', 'Fruits & Nuts', 'Chocolate & Cocoa', 'Other'];

function openSupplierModal(supplier, onSaved) {
  const form = supplier ? { ...supplier } : { name: '', contactPerson: '', phone: '', email: '', address: '', category: '', notes: '', status: 'active' };
  const bodyHtml = `
    <div class="form-group"><label class="form-label">Supplier name</label><input class="form-input" id="sup-name" value="${esc(form.name)}" placeholder="e.g. Golden Wheat Mills"></div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Contact person</label><input class="form-input" id="sup-contact" value="${esc(form.contactPerson)}" placeholder="e.g. Ravi Kumar"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="sup-phone" value="${esc(form.phone)}" placeholder="98XXXXXXXX"></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="sup-email" value="${esc(form.email)}" placeholder="email@example.com"></div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="sup-category">
          <option value="">— Select —</option>
          ${SUPPLIER_CATEGORIES.map(c => `<option value="${esc(c)}" ${form.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="sup-address" value="${esc(form.address)}" placeholder="Supplier address"></div>
    <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="sup-notes" value="${esc(form.notes)}" placeholder="Payment terms, delivery days, etc."></div>
    <div class="form-group">
      <label class="form-label">Status</label>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn ${form.status === 'active' ? 'btn-primary' : 'btn-outline'} btn-sm" style="flex:1;justify-content:center" data-status-pick="active">Active</button>
        <button type="button" class="btn ${form.status === 'inactive' ? 'btn-primary' : 'btn-outline'} btn-sm" style="flex:1;justify-content:center" data-status-pick="inactive">Inactive</button>
      </div>
    </div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="sup-save">Save</button>`;

  openModal({
    title: supplier ? 'Edit Supplier' : 'Add Supplier',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelectorAll('[data-status-pick]').forEach(btn => btn.addEventListener('click', () => {
        form.status = btn.dataset.statusPick;
        overlay.querySelectorAll('[data-status-pick]').forEach(b => b.classList.toggle('btn-primary', b.dataset.statusPick === form.status));
        overlay.querySelectorAll('[data-status-pick]').forEach(b => b.classList.toggle('btn-outline', b.dataset.statusPick !== form.status));
      }));
      overlay.querySelector('#sup-save').addEventListener('click', async () => {
        const name = overlay.querySelector('#sup-name').value.trim();
        if (!name) return toast('Supplier name required', 'error');
        const payload = {
          name,
          contactPerson: overlay.querySelector('#sup-contact').value,
          phone: overlay.querySelector('#sup-phone').value,
          email: overlay.querySelector('#sup-email').value,
          category: overlay.querySelector('#sup-category').value,
          address: overlay.querySelector('#sup-address').value,
          notes: overlay.querySelector('#sup-notes').value,
          status: form.status,
        };
        try {
          if (supplier) await api.updateSupplier(supplier.id, payload);
          else await api.createSupplier(payload);
          toast(supplier ? 'Supplier updated!' : 'Supplier added!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function renderSuppliers(content) {
  suppliersState.list = await api.getSuppliers();

  const draw = () => {
    const filtered = suppliersState.list.filter(s =>
      s.name.toLowerCase().includes(suppliersState.search.toLowerCase()) ||
      (s.category || '').toLowerCase().includes(suppliersState.search.toLowerCase()));
    const activeCount = suppliersState.list.filter(s => s.status === 'active').length;
    const linkedItems = suppliersState.list.reduce((sum, s) => sum + s.itemCount, 0);

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Total Suppliers</div><div class="metric-value">${suppliersState.list.length}</div></div>
        <div class="metric-card"><div class="metric-label">Active</div><div class="metric-value">${activeCount}</div></div>
        <div class="metric-card"><div class="metric-label">Linked Inventory Items</div><div class="metric-value">${linkedItems}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">All Suppliers</span>
          <div style="display:flex;gap:10px">
            <div class="search-bar"><span>🔍</span><input id="sup-search" placeholder="Search…" value="${esc(suppliersState.search)}"></div>
            ${window.CURRENT_ROLE === 'admin' ? `<button class="btn btn-primary" id="sup-add">+ Add Supplier</button>` : ''}
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('🚚', 'No suppliers found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Supplier</th><th>Category</th><th>Contact</th><th>Phone / Email</th><th>Items Supplied</th><th>Status</th>${window.CURRENT_ROLE === 'admin' ? '<th>Actions</th>' : ''}</tr></thead>
            <tbody>
              ${filtered.map(s => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:10px">${avatar(s.name)}<span class="font-medium">${esc(s.name)}</span></div></td>
                  <td class="text-muted">${esc(s.category) || '—'}</td>
                  <td class="text-muted">${esc(s.contactPerson) || '—'}</td>
                  <td class="text-muted">${[esc(s.phone), esc(s.email)].filter(Boolean).join(' · ') || '—'}</td>
                  <td>${s.itemCount}</td>
                  <td><span class="pill pill-${s.status === 'active' ? 'good' : 'critical'}">${s.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                  ${window.CURRENT_ROLE === 'admin' ? `
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-edit-sup="${s.id}">Edit</button>
                      <button class="btn btn-danger btn-sm btn-icon" data-delete-sup="${s.id}">✕</button>
                    </div>
                  </td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $('#sup-search', content).addEventListener('input', (e) => { suppliersState.search = e.target.value; draw(); });
    const addBtn = $('#sup-add', content);
    if (addBtn) addBtn.addEventListener('click', () => openSupplierModal(null, async () => { suppliersState.list = await api.getSuppliers(); draw(); }));
    $$('[data-edit-sup]', content).forEach(btn => btn.addEventListener('click', () => {
      const s = suppliersState.list.find(x => x.id === btn.dataset.editSup);
      openSupplierModal(s, async () => { suppliersState.list = await api.getSuppliers(); draw(); });
    }));
    $$('[data-delete-sup]', content).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.deleteSup;
      confirmDialog('Remove this supplier? Inventory items linked to it will keep their stock but lose the supplier tag.', async () => {
        try {
          await api.deleteSupplier(id);
          toast('Supplier removed', 'success');
          suppliersState.list = await api.getSuppliers();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Purchase Orders (admin only) ────────────────────────────────────────
let poState = { list: [], filter: 'all' };

function poItemRowHtml(row, idx, inventory) {
  return `
    <div class="form-row cols-2" data-po-item-row="${idx}" style="align-items:flex-end;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed var(--border)">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Item</label>
        <select class="form-input" data-po-item-select="${idx}">
          <option value="">— Custom item —</option>
          ${inventory.map(i => `<option value="${i.id}" ${row.itemId === i.id ? 'selected' : ''}>${esc(i.name)} (${i.unit})</option>`).join('')}
        </select>
        ${!row.itemId ? `<input class="form-input" style="margin-top:6px" data-po-item-name="${idx}" value="${esc(row.name || '')}" placeholder="Custom item name">` : ''}
      </div>
      <div class="form-row cols-2" style="margin-bottom:0">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Qty</label>
          <input type="number" class="form-input" data-po-item-qty="${idx}" value="${row.quantity}" placeholder="0">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Cost/unit (₹)</label>
          <input type="number" class="form-input" data-po-item-cost="${idx}" value="${row.costPerUnit}" placeholder="0">
        </div>
      </div>
      <div style="grid-column:1/-1;display:flex;justify-content:flex-end">
        <button type="button" class="btn btn-danger btn-sm btn-icon" data-po-item-remove="${idx}" title="Remove row">✕</button>
      </div>
    </div>`;
}

function openPurchaseOrderModal(po, suppliers, inventory, onSaved, prefill) {
  const isEdit = !!po;
  const receiveMode = !isEdit && !!(prefill && prefill.receiveMode);
  const form = po
    ? { supplierId: po.supplierId || '', expectedDate: po.expectedDate || '', notes: po.notes || '', items: po.items.map(i => ({ itemId: i.itemId, name: i.name, quantity: i.quantity, costPerUnit: i.costPerUnit })) }
    : {
        supplierId: (prefill && prefill.supplierId) || '',
        expectedDate: new Date().toISOString().slice(0, 10), notes: (prefill && prefill.notes) || '',
        items: (prefill && prefill.items && prefill.items.length) ? prefill.items.map(i => ({ ...i })) : [{ itemId: '', name: '', quantity: '', costPerUnit: '' }],
      };

  const bodyHtml = () => `
    <div class="form-group">
      <label class="form-label">Supplier</label>
      <select class="form-input" id="po-supplier">
        <option value="">— Select a supplier —</option>
        ${suppliers.map(s => `<option value="${s.id}" ${form.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Expected delivery date</label>
      <input type="date" class="form-input" id="po-date" value="${esc(form.expectedDate || '')}">
    </div>
    <div class="form-group">
      <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
        <span>Items</span>
        <button type="button" class="btn btn-outline btn-sm" id="po-add-item">+ Add item</button>
      </label>
      <div id="po-items">${form.items.map((row, idx) => poItemRowHtml(row, idx, inventory)).join('')}</div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="po-notes" value="${esc(form.notes)}" placeholder="Payment terms, delivery instructions, etc."></div>
    <div style="text-align:right;font-size:14px;font-weight:700;padding-top:8px;border-top:1px solid var(--border)">Total: ₹${inr(form.items.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.costPerUnit) || 0), 0))}</div>`;

  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button>${
    receiveMode ? `<button class="btn btn-primary" id="po-save-received">📥 Save &amp; Mark Received</button>`
    : !isEdit ? `<button class="btn btn-outline" id="po-save-draft">Save as Draft</button><button class="btn btn-primary" id="po-save-ordered">Save &amp; Mark Ordered</button>`
    : `<button class="btn btn-primary" id="po-save-draft">Save Changes</button>`
  }`;

  const readForm = (overlay) => {
    form.supplierId = overlay.querySelector('#po-supplier').value;
    form.expectedDate = overlay.querySelector('#po-date').value;
    form.notes = overlay.querySelector('#po-notes').value;
  };

  const rerenderBody = (overlay) => {
    readForm(overlay);
    overlay.querySelector('.modal-body').innerHTML = bodyHtml();
    wireBody(overlay);
  };

  const wireBody = (overlay) => {
    overlay.querySelector('#po-add-item').addEventListener('click', () => {
      form.items.push({ itemId: '', name: '', quantity: '', costPerUnit: '' });
      rerenderBody(overlay);
    });
    form.items.forEach((row, idx) => {
      const sel = overlay.querySelector(`[data-po-item-select="${idx}"]`);
      if (sel) sel.addEventListener('change', (e) => {
        const invItem = inventory.find(i => i.id === e.target.value);
        row.itemId = e.target.value || '';
        row.name = invItem ? invItem.name : '';
        if (invItem && !row.costPerUnit) row.costPerUnit = invItem.costPerUnit;
        rerenderBody(overlay);
      });
      const nameInput = overlay.querySelector(`[data-po-item-name="${idx}"]`);
      if (nameInput) nameInput.addEventListener('input', (e) => { row.name = e.target.value; });
      const qtyInput = overlay.querySelector(`[data-po-item-qty="${idx}"]`);
      if (qtyInput) qtyInput.addEventListener('input', (e) => { row.quantity = e.target.value; rerenderBody(overlay); });
      const costInput = overlay.querySelector(`[data-po-item-cost="${idx}"]`);
      if (costInput) costInput.addEventListener('input', (e) => { row.costPerUnit = e.target.value; rerenderBody(overlay); });
      const removeBtn = overlay.querySelector(`[data-po-item-remove="${idx}"]`);
      if (removeBtn) removeBtn.addEventListener('click', () => {
        if (form.items.length <= 1) return toast('At least one item row is required', 'error');
        form.items.splice(idx, 1);
        rerenderBody(overlay);
      });
    });
  };

  const buildPayload = (overlay, status) => {
    readForm(overlay);
    const supplier = suppliers.find(s => s.id === form.supplierId);
    const items = form.items
      .filter(r => (r.name || '').trim() && Number(r.quantity) > 0)
      .map(r => ({ itemId: r.itemId || null, name: r.name, quantity: Number(r.quantity), costPerUnit: Number(r.costPerUnit) || 0 }));
    return {
      supplierId: form.supplierId || null,
      supplierName: supplier ? supplier.name : '',
      expectedDate: form.expectedDate,
      notes: form.notes,
      items,
      status,
    };
  };

  openModal({
    title: isEdit ? `Edit ${po.poNumber}` : (receiveMode ? 'Receive Restock — Purchase Order' : 'New Purchase Order'),
    bodyHtml: (receiveMode ? `<div class="text-muted" style="font-size:13px;margin-bottom:14px">Pre-filled from the restock alert. Review the quantity and cost, then save — this creates the purchase order and immediately marks it received, updating inventory.</div>` : '') + bodyHtml(),
    footerHtml,
    onMount: (overlay) => {
      wireBody(overlay);
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);

      const save = async (status) => {
        const payload = buildPayload(overlay, status);
        if (!payload.items.length) return toast('Add at least one item with a quantity', 'error');
        if (!payload.supplierId && !payload.supplierName) return toast('Select a supplier', 'error');
        try {
          let saved;
          if (isEdit) {
            saved = await api.updatePurchaseOrder(po.id, payload);
            toast('Purchase order updated!', 'success');
          } else {
            saved = await api.createPurchaseOrder(payload);
            if (status === 'ordered' && receiveMode) {
              // Receiving an order updates real inventory, but a PO can only
              // reach 'received' from 'ordered' — so walk it straight there.
              saved = await api.updatePurchaseOrderStatus(saved.id, 'received');
              toast(`Purchase order ${saved.poNumber} created and marked received`, 'success');
            } else {
              toast(status === 'ordered' ? 'Purchase order sent!' : 'Draft saved!', 'success');
            }
          }
          closeModal();
          onSaved(saved);
        } catch (err) { toast(err.message, 'error'); }
      };

      const draftBtn = overlay.querySelector('#po-save-draft');
      if (draftBtn) draftBtn.addEventListener('click', () => save('draft'));
      const orderedBtn = overlay.querySelector('#po-save-ordered');
      if (orderedBtn) orderedBtn.addEventListener('click', () => save('ordered'));
      const receivedBtn = overlay.querySelector('#po-save-received');
      if (receivedBtn) receivedBtn.addEventListener('click', () => save('ordered'));
    },
  });
}

async function openPODetailModal(id, onChanged) {
  let po;
  try { po = await api.getPurchaseOrder(id); } catch (err) { return toast(err.message, 'error'); }

  const bodyHtml = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div>
        <div style="font-size:12px;color:var(--text-tertiary)">Supplier</div>
        <div class="font-medium" style="font-size:15px">${esc(po.supplierName)}</div>
      </div>
      ${poPill(po.status)}
    </div>
    <div class="table-wrap" style="margin-bottom:12px">
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Cost/unit</th><th>Total</th></tr></thead>
        <tbody>
          ${po.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.quantity}</td><td>₹${inr(i.costPerUnit)}</td><td class="font-medium">₹${inr(i.totalCost)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;padding-top:8px;border-top:1px solid var(--border);margin-bottom:14px">
      <span>Total</span><span>₹${inr(po.totalAmount)}</span>
    </div>
    ${po.expectedDate ? `<div class="text-muted" style="font-size:13px;margin-bottom:4px">Expected: ${dateStr(po.expectedDate + ' 00:00:00')}</div>` : ''}
    ${po.notes ? `<div class="text-muted" style="font-size:13px">Notes: ${esc(po.notes)}</div>` : ''}`;

  const actions = [];
  if (po.status === 'draft') {
    actions.push(`<button class="btn btn-outline" data-po-edit>Edit</button>`);
    actions.push(`<button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)" data-po-cancel>Cancel PO</button>`);
    actions.push(`<button class="btn btn-primary" data-po-mark-ordered>Mark Ordered</button>`);
  } else if (po.status === 'ordered') {
    actions.push(`<button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)" data-po-cancel>Cancel PO</button>`);
    actions.push(`<button class="btn btn-primary" data-po-mark-received>Mark Received</button>`);
  }
  const footerHtml = `<button class="btn btn-outline" data-cancel>Close</button>${actions.join('')}`;

  openModal({
    title: po.poNumber,
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      const editBtn = overlay.querySelector('[data-po-edit]');
      if (editBtn) editBtn.addEventListener('click', async () => {
        closeModal();
        const [suppliers, inventory] = await Promise.all([api.getSuppliers(), api.getInventory()]);
        openPurchaseOrderModal(po, suppliers, inventory, onChanged);
      });
      const cancelBtn = overlay.querySelector('[data-po-cancel]');
      if (cancelBtn) cancelBtn.addEventListener('click', () => {
        confirmDialog('Cancel this purchase order?', async () => {
          try {
            await api.updatePurchaseOrderStatus(po.id, 'cancelled');
            toast('Purchase order cancelled', 'success');
            closeModal();
            onChanged();
          } catch (err) { toast(err.message, 'error'); }
        }, { confirmLabel: 'Cancel PO', confirmClass: 'btn-danger' });
      });
      const orderedBtn = overlay.querySelector('[data-po-mark-ordered]');
      if (orderedBtn) orderedBtn.addEventListener('click', async () => {
        try {
          await api.updatePurchaseOrderStatus(po.id, 'ordered');
          toast('Purchase order marked as ordered', 'success');
          closeModal();
          onChanged();
        } catch (err) { toast(err.message, 'error'); }
      });
      const receivedBtn = overlay.querySelector('[data-po-mark-received]');
      if (receivedBtn) receivedBtn.addEventListener('click', () => {
        confirmDialog('Mark this purchase order as received? This will add the ordered quantities to inventory stock.', async () => {
          try {
            await api.updatePurchaseOrderStatus(po.id, 'received');
            toast('Received! Inventory stock updated.', 'success');
            closeModal();
            onChanged();
          } catch (err) { toast(err.message, 'error'); }
        }, { confirmLabel: 'Mark Received', confirmClass: 'btn-primary' });
      });
    },
  });
}

async function renderPurchaseOrders(content) {
  const data = await api.getPurchaseOrders();
  poState.list = data.purchaseOrders;

  const draw = () => {
    const filtered = poState.filter === 'all' ? poState.list : poState.list.filter(p => p.status === poState.filter);

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Open Purchase Orders</div><div class="metric-value">${data.openCount}</div></div>
        <div class="metric-card"><div class="metric-label">Pending Value</div><div class="metric-value">₹${inr(data.pendingValue)}</div></div>
        <div class="metric-card"><div class="metric-label">Received Value</div><div class="metric-value">₹${inr(data.receivedValue)}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Purchase Orders</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${['all', 'draft', 'ordered', 'received', 'cancelled'].map(f => `<button class="btn btn-sm ${poState.filter === f ? 'btn-primary' : 'btn-outline'}" data-po-filter="${f}">${f === 'all' ? 'All' : (PO_STATUS_META[f] ? PO_STATUS_META[f].label : f)}</button>`).join('')}
            <button class="btn btn-primary btn-sm" id="po-add">+ New Purchase Order</button>
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('📋', 'No purchase orders found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>PO Number</th><th>Supplier</th><th>Items</th><th>Total</th><th>Expected</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(po => `
                <tr>
                  <td class="font-medium" style="color:var(--brand)">${esc(po.poNumber)}</td>
                  <td>${esc(po.supplierName)}</td>
                  <td class="text-muted">${po.itemCount}</td>
                  <td class="font-medium">₹${inr(po.totalAmount)}</td>
                  <td class="text-muted">${po.expectedDate ? dateStr(po.expectedDate + ' 00:00:00') : '—'}</td>
                  <td>${poPill(po.status)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-po-view="${po.id}">View</button>
                      ${(po.status === 'draft' || po.status === 'cancelled') ? `<button class="btn btn-danger btn-sm btn-icon" data-po-delete="${po.id}">✕</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $$('[data-po-filter]', content).forEach(btn => btn.addEventListener('click', () => { poState.filter = btn.dataset.poFilter; draw(); }));
    const refresh = async () => { const d = await api.getPurchaseOrders(); Object.assign(data, d); poState.list = d.purchaseOrders; draw(); };
    $('#po-add', content).addEventListener('click', async () => {
      const [suppliers, inventory] = await Promise.all([api.getSuppliers(), api.getInventory()]);
      if (!suppliers.length) return toast('Add a supplier first', 'error');
      openPurchaseOrderModal(null, suppliers, inventory, refresh);
    });
    $$('[data-po-view]', content).forEach(btn => btn.addEventListener('click', () => openPODetailModal(btn.dataset.poView, refresh)));
    $$('[data-po-delete]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Delete this purchase order?', async () => {
        try {
          await api.deletePurchaseOrder(btn.dataset.poDelete);
          toast('Purchase order deleted', 'success');
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Recipes ──────────────────────────────────────────────────────────────
let productsState = { list: [], search: '', category: 'all' };

// Small helper: what should the status pill say for a coupon right now —
// active, disabled by admin, expired, not started yet, or used up?
function couponStatusHtml(c) {
  const today = new Date().toISOString().slice(0, 10);
  if (!c.active) return `<span class="pill pill-low">Disabled</span>`;
  if (c.validUntil && today > c.validUntil) return `<span class="pill pill-low">Expired</span>`;
  if (c.validFrom && today < c.validFrom) return `<span class="pill pill-medium">Scheduled</span>`;
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return `<span class="pill pill-low">Used up</span>`;
  return `<span class="pill pill-good">Active</span>`;
}

let couponsState = { list: [] };

async function renderCoupons(content) {
  const data = await api.getCoupons();
  couponsState.list = data.coupons;

  const draw = () => {
    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Discounts &amp; Coupons</span>
          <button class="btn btn-primary btn-sm" id="coupon-add">+ New Coupon</button>
        </div>
        <div class="text-muted" style="font-size:12.5px;padding:0 20px 12px">
          Coupon codes customers or staff can enter at checkout (in the cart, on New Order/POS) for a % or ₹ discount. Staff and customers apply codes at checkout — only admins create/edit/delete them here. Mark a coupon as a <strong>✨ Special Day</strong> sale to have it applied automatically to every customer's order, with no code needed — handy for festival or storewide sale days.
        </div>
        ${couponsState.list.length === 0 ? emptyState('🏷️', 'No coupons yet — create one to offer a discount at checkout') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Min. Order</th><th>Usage</th><th>Valid</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${couponsState.list.map(c => `
                <tr>
                  <td>
                    <div class="font-medium">${esc(c.code)} ${c.isWelcome ? '<span class="pill pill-good" style="margin-left:4px">🎉 Welcome</span>' : ''} ${c.autoApply ? '<span class="pill pill-good" style="margin-left:4px">✨ Special Day</span>' : ''}</div>
                    ${c.description ? `<div class="text-muted" style="font-size:11.5px;max-width:220px">${esc(c.description)}</div>` : ''}
                  </td>
                  <td>${c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${inr(c.discountValue)} off`}${c.maxDiscountAmount ? `<div class="text-muted" style="font-size:11px">up to ₹${inr(c.maxDiscountAmount)}</div>` : ''}</td>
                  <td>${c.minOrderAmount > 0 ? `₹${inr(c.minOrderAmount)}` : '—'}</td>
                  <td>${c.usedCount}${c.usageLimit !== null ? ` / ${c.usageLimit}` : ''}${c.perCustomerLimit !== null ? `<div class="text-muted" style="font-size:11px">max ${c.perCustomerLimit}/customer</div>` : ''}</td>
                  <td class="text-muted" style="font-size:12px">${c.validFrom || c.validUntil ? `${c.validFrom || '—'} → ${c.validUntil || '—'}` : 'Always'}</td>
                  <td>${couponStatusHtml(c)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-coupon-toggle="${c.id}" data-active="${c.active ? '1' : '0'}">${c.active ? 'Disable' : 'Enable'}</button>
                      <button class="btn btn-outline btn-sm" data-coupon-edit="${c.id}">Edit</button>
                      <button class="btn btn-danger btn-sm btn-icon" data-coupon-delete="${c.id}">✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $('#coupon-add', content).addEventListener('click', () => openCouponModal(null, refresh));
    $$('[data-coupon-edit]', content).forEach(btn => btn.addEventListener('click', () => {
      const c = couponsState.list.find(x => x.id === btn.dataset.couponEdit);
      openCouponModal(c, refresh);
    }));
    $$('[data-coupon-toggle]', content).forEach(btn => btn.addEventListener('click', async () => {
      try { await api.updateCoupon(btn.dataset.couponToggle, { active: btn.dataset.active !== '1' }); await refresh(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-coupon-delete]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Delete this coupon? Past orders that used it keep their discount on record.', async () => {
        try { await api.deleteCoupon(btn.dataset.couponDelete); toast('Coupon deleted', 'success'); await refresh(); }
        catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  const refresh = async () => {
    const fresh = await api.getCoupons();
    couponsState.list = fresh.coupons;
    draw();
  };

  draw();
}

function openCouponModal(coupon, onSaved) {
  const isEdit = !!coupon;
  const f = coupon ? { ...coupon } : {
    code: '', description: '', discountType: 'percent', discountValue: '',
    minOrderAmount: '', maxDiscountAmount: '', usageLimit: '', perCustomerLimit: '',
    validFrom: '', validUntil: '', active: true, isWelcome: false, autoApply: false,
  };

  openModal({
    title: isEdit ? `Edit Coupon — ${coupon.code}` : 'New Coupon',
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label class="form-label">Code</label>
          <input class="form-input" id="cp-code" value="${esc(f.code)}" placeholder="e.g. WELCOME10" style="text-transform:uppercase" ${isEdit ? 'disabled' : ''}>
        </div>
        <div>
          <label class="form-label">Description (shown to customers)</label>
          <input class="form-input" id="cp-desc" value="${esc(f.description || '')}" placeholder="e.g. 10% off your first order">
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label class="form-label">Discount type</label>
            <select class="form-input" id="cp-type">
              <option value="percent" ${f.discountType === 'percent' ? 'selected' : ''}>% Percent off</option>
              <option value="fixed" ${f.discountType === 'fixed' ? 'selected' : ''}>₹ Fixed amount off</option>
            </select>
          </div>
          <div style="flex:1">
            <label class="form-label">Discount value</label>
            <input class="form-input" id="cp-value" type="number" min="0" step="0.01" value="${f.discountValue}">
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label class="form-label">Min. order amount (₹)</label>
            <input class="form-input" id="cp-min" type="number" min="0" step="0.01" value="${f.minOrderAmount || ''}" placeholder="0">
          </div>
          <div style="flex:1">
            <label class="form-label">Max discount cap (₹, % only)</label>
            <input class="form-input" id="cp-maxcap" type="number" min="0" step="0.01" value="${f.maxDiscountAmount || ''}" placeholder="No cap">
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label class="form-label">Total usage limit</label>
            <input class="form-input" id="cp-usagelimit" type="number" min="1" step="1" value="${f.usageLimit || ''}" placeholder="Unlimited">
          </div>
          <div style="flex:1">
            <label class="form-label">Limit per customer</label>
            <input class="form-input" id="cp-perlimit" type="number" min="1" step="1" value="${f.perCustomerLimit || ''}" placeholder="Unlimited">
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label class="form-label">Valid from</label>
            <input class="form-input" id="cp-from" type="date" value="${f.validFrom || ''}">
          </div>
          <div style="flex:1">
            <label class="form-label">Valid until</label>
            <input class="form-input" id="cp-until" type="date" value="${f.validUntil || ''}">
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px">
          <input type="checkbox" id="cp-active" ${f.active ? 'checked' : ''}> Active (customers/staff can use this code right away)
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px">
          <input type="checkbox" id="cp-welcome" ${f.isWelcome ? 'checked' : ''}> Welcome offer (shows a popup to customers after login, and a banner on New Order, until they use it)
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px">
          <input type="checkbox" id="cp-autoapply" ${f.autoApply ? 'checked' : ''}> ✨ Special Day Sale (applies automatically to every customer's cart — no code needed)
        </label>
        <div id="cp-error"></div>
      </div>`,
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="cp-save">${isEdit ? 'Save Changes' : 'Create Coupon'}</button>`,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#cp-save').addEventListener('click', async () => {
        const errBox = overlay.querySelector('#cp-error');
        errBox.innerHTML = '';
        const payload = {
          code: overlay.querySelector('#cp-code').value.trim().toUpperCase(),
          description: overlay.querySelector('#cp-desc').value.trim(),
          discountType: overlay.querySelector('#cp-type').value,
          discountValue: parseFloat(overlay.querySelector('#cp-value').value) || 0,
          minOrderAmount: parseFloat(overlay.querySelector('#cp-min').value) || 0,
          maxDiscountAmount: overlay.querySelector('#cp-maxcap').value || null,
          usageLimit: overlay.querySelector('#cp-usagelimit').value || null,
          perCustomerLimit: overlay.querySelector('#cp-perlimit').value || null,
          validFrom: overlay.querySelector('#cp-from').value || null,
          validUntil: overlay.querySelector('#cp-until').value || null,
          active: overlay.querySelector('#cp-active').checked,
          isWelcome: overlay.querySelector('#cp-welcome').checked,
          autoApply: overlay.querySelector('#cp-autoapply').checked,
        };
        try {
          if (isEdit) await api.updateCoupon(coupon.id, payload);
          else await api.createCoupon(payload);
          toast(isEdit ? 'Coupon updated' : 'Coupon created', 'success');
          closeModal();
          await onSaved();
        } catch (err) {
          errBox.innerHTML = `<div style="font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
        }
      });
    },
  });
}


// photo) for a product and delete inappropriate ones, right from the
// Product Catalog — without needing to go through the storefront/New
// Order product page to find the same "Customer Reviews" section.
function openProductReviewsModal(itemName) {
  const draw = async (overlay) => {
    overlay.querySelector('.modal-body').innerHTML = `<div class="text-muted" style="font-size:13px">Loading…</div>`;
    let detail;
    try { detail = await api.getReviewsForItem(itemName); }
    catch (err) { overlay.querySelector('.modal-body').innerHTML = `<div style="color:#b91c1c;font-size:13px">${esc(err.message)}</div>`; return; }

    const body = overlay.querySelector('.modal-body');
    body.innerHTML = detail.reviews.length === 0
      ? `<div class="text-muted" style="font-size:13px">No reviews yet for this item.</div>`
      : `<div style="display:flex;flex-direction:column;gap:14px;max-height:60vh;overflow-y:auto">
          ${detail.reviews.map(r => `
            <div style="border-bottom:1px solid var(--border);padding-bottom:10px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  ${starsHtml(r.rating, 13)}
                  <span class="font-medium" style="font-size:13.5px">${esc(r.customerName)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="text-muted" style="font-size:12px">${dateStr(r.createdAt)}</span>
                  <button class="btn btn-danger btn-sm btn-icon" data-modal-review-delete="${r.id}" style="width:22px;height:22px;font-size:12px">✕</button>
                </div>
              </div>
              ${r.comment ? `<div style="font-size:13px;margin-top:5px">${esc(r.comment)}</div>` : ''}
              ${r.imageUrl ? `<img src="${esc(r.imageUrl)}" alt="Review photo" style="margin-top:8px;width:88px;height:88px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" data-modal-review-image-view="${esc(r.imageUrl)}">` : ''}
            </div>`).join('')}
        </div>`;

    $$('[data-modal-review-image-view]', body).forEach(img => img.addEventListener('click', () => {
      viewImageLightbox(img.dataset.modalReviewImageView);
    }));
    $$('[data-modal-review-delete]', body).forEach(btn => btn.addEventListener('click', () => {
      // NOTE: deliberately not using confirmDialog() here — it opens its own
      // modal, and openModal() only ever allows one modal at a time (it
      // calls closeModal() first), which would silently close this very
      // reviews list instead of stacking on top of it. Confirm inline instead.
      if (btn.dataset.confirming !== '1') {
        btn.dataset.confirming = '1';
        btn.textContent = 'Confirm?';
        btn.style.width = 'auto';
        setTimeout(() => { if (btn.dataset.confirming === '1') { btn.dataset.confirming = '0'; btn.textContent = '✕'; btn.style.width = '22px'; } }, 3000);
        return;
      }
      btn.disabled = true;
      api.deleteReview(btn.dataset.modalReviewDelete)
        .then(() => { toast('Review deleted', 'success'); return draw(overlay); })
        .catch(err => { toast(err.message, 'error'); btn.disabled = false; });
    }));
  };

  openModal({
    title: `Reviews — ${itemName}`,
    bodyHtml: `<div class="text-muted" style="font-size:13px">Loading…</div>`,
    onMount: (overlay) => draw(overlay),
  });
}

function openProductModal(product, recipes, onSaved) {
  const form = product
    ? { name: product.name, sku: product.sku, category: product.category || '', sellingPrice: product.sellingPrice, imageUrl: product.imageUrl || '', isAvailable: product.isAvailable, recipeId: product.recipeId || '', description: product.description || '' }
    : { name: '', sku: '', category: '', sellingPrice: '', imageUrl: '', isAvailable: true, recipeId: '', description: '' };

  const bodyHtml = `
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Product name</label><input class="form-input" id="prod-name" value="${esc(form.name)}" placeholder="e.g. Chocolate Cake"></div>
      <div class="form-group"><label class="form-label">SKU</label><input class="form-input" id="prod-sku" value="${esc(form.sku)}" placeholder="e.g. CAKE-CHOC-001"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Product image <span class="text-muted" style="font-weight:400">(shown in the catalog &amp; New Order page)</span></label>
      <input type="file" accept="image/*" class="form-input" id="prod-image-file">
      <input type="hidden" id="prod-image" value="${esc(form.imageUrl || '')}">
      <img id="prod-image-preview" src="${esc(form.imageUrl || '')}" alt="" style="margin-top:8px;width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:${form.imageUrl ? 'block' : 'none'}">
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Category</label><input class="form-input" id="prod-category" value="${esc(form.category)}" placeholder="e.g. Cakes, Breads, Cookies"></div>
      <div class="form-group"><label class="form-label">Selling price (₹)</label><input type="number" class="form-input" id="prod-price" value="${form.sellingPrice}" placeholder="0"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Linked recipe <span class="text-muted" style="font-weight:400">(optional)</span></label>
      <select class="form-input" id="prod-recipe">
        <option value="">— Not linked —</option>
        ${recipes.map(r => `<option value="${r.id}" ${form.recipeId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>
      <div class="text-muted" style="font-size:11.5px;margin-top:4px">If the linked recipe's inventory item doesn't have a photo yet, this product's photo will be used there automatically.</div>
    </div>
    <div class="form-group"><label class="form-label">Description <span class="text-muted" style="font-weight:400">(optional)</span></label><input class="form-input" id="prod-description" value="${esc(form.description)}" placeholder="Short description shown to customers"></div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="prod-available" ${form.isAvailable ? 'checked' : ''} style="width:auto">
      <label class="form-label" for="prod-available" style="margin:0">Available for sale</label>
    </div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="prod-save">${product ? 'Save Changes' : 'Add Product'}</button>`;

  openModal({
    title: product ? 'Edit Product' : 'Add Product',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);

      overlay.querySelector('#prod-image-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast('Please choose an image file', 'error');
        if (file.size > 8 * 1024 * 1024) return toast('Image is too large (max 8MB)', 'error');
        try {
          const dataUrl = await compressImageFile(file, 800, 0.8);
          overlay.querySelector('#prod-image').value = dataUrl;
          const preview = overlay.querySelector('#prod-image-preview');
          preview.src = dataUrl;
          preview.style.display = 'block';
        } catch (err) {
          toast('Could not process that image, please try another', 'error');
        }
      });

      overlay.querySelector('#prod-save').addEventListener('click', async () => {
        const name = overlay.querySelector('#prod-name').value.trim();
        const sku = overlay.querySelector('#prod-sku').value.trim();
        if (!name || !sku) return toast('Name and SKU are required', 'error');
        const payload = {
          name, sku,
          category: overlay.querySelector('#prod-category').value.trim(),
          sellingPrice: overlay.querySelector('#prod-price').value || 0,
          imageUrl: overlay.querySelector('#prod-image').value.trim(),
          recipeId: overlay.querySelector('#prod-recipe').value || null,
          description: overlay.querySelector('#prod-description').value.trim(),
          isAvailable: overlay.querySelector('#prod-available').checked,
        };
        try {
          if (product) await api.updateProduct(product.id, payload);
          else await api.createProduct(payload);
          toast(product ? 'Product updated!' : 'Product added!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function renderProducts(content) {
  const [data, recipeData] = await Promise.all([api.getProducts(), api.getRecipes().catch(() => ({ recipes: [] }))]);
  productsState.list = data.products;
  const recipes = recipeData.recipes || [];

  const draw = () => {
    const categories = ['all', ...new Set(productsState.list.map(p => p.category).filter(Boolean))];
    const q = productsState.search.toLowerCase();
    const filtered = productsState.list.filter(p =>
      (productsState.category === 'all' || p.category === productsState.category) &&
      (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)));
    const available = productsState.list.filter(p => p.isAvailable).length;

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Total Products</div><div class="metric-value">${productsState.list.length}</div></div>
        <div class="metric-card"><div class="metric-label">Available</div><div class="metric-value">${available}</div></div>
        <div class="metric-card"><div class="metric-label">Unavailable</div><div class="metric-value">${productsState.list.length - available}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Product Catalog</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select class="form-input" id="prod-cat-filter" style="width:auto">
              ${categories.map(c => `<option value="${esc(c)}" ${productsState.category === c ? 'selected' : ''}>${c === 'all' ? 'All categories' : esc(c)}</option>`).join('')}
            </select>
            <div class="search-bar"><span>🔍</span><input id="prod-search" placeholder="Search…" value="${esc(productsState.search)}"></div>
            <button class="btn btn-primary btn-sm" id="prod-add">+ New Product</button>
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('🧁', 'No products found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th></th><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(p => `
                <tr>
                  <td style="width:52px">${p.imageUrl
                    ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:8px" onerror="this.outerHTML='<div style=&quot;font-size:20px&quot;>🧁</div>'">`
                    : `<div style="font-size:20px">🧁</div>`}</td>
                  <td class="font-medium">${esc(p.name)}</td>
                  <td class="text-muted">${esc(p.sku)}</td>
                  <td class="text-muted">${esc(p.category || '—')}</td>
                  <td class="font-medium">₹${inr(p.sellingPrice)}</td>
                  <td>${p.isAvailable ? `<span class="pill pill-paid">Available</span>` : `<span class="pill pill-critical">Unavailable</span>`}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-prod-reviews="${p.id}" data-prod-reviews-name="${esc(p.name)}">★ Reviews</button>
                      <button class="btn btn-outline btn-sm" data-prod-edit="${p.id}">Edit</button>
                      <button class="btn btn-danger btn-sm btn-icon" data-prod-delete="${p.id}">✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    const refresh = async () => { const d = await api.getProducts(); productsState.list = d.products; draw(); };
    $('#prod-search', content).addEventListener('input', (e) => { productsState.search = e.target.value; draw(); });
    $('#prod-cat-filter', content).addEventListener('change', (e) => { productsState.category = e.target.value; draw(); });
    $('#prod-add', content).addEventListener('click', () => openProductModal(null, recipes, refresh));
    $$('[data-prod-edit]', content).forEach(btn => btn.addEventListener('click', () => {
      const p = productsState.list.find(x => x.id === btn.dataset.prodEdit);
      openProductModal(p, recipes, refresh);
    }));
    $$('[data-prod-reviews]', content).forEach(btn => btn.addEventListener('click', () => {
      openProductReviewsModal(btn.dataset.prodReviewsName);
    }));
    $$('[data-prod-delete]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Delete this product?', async () => {
        try {
          await api.deleteProduct(btn.dataset.prodDelete);
          toast('Product deleted', 'success');
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Recipe Management ────────────────────────────────────────────────────
let recipesState = { list: [], search: '' };

function recipeIngredientRowHtml(row, idx, inventory, finishedIds) {
  // A recipe is a reusable template, so a quantity bigger than what's
  // currently on hand isn't invalid — you might restock before this recipe
  // is ever produced. But it's still worth a heads-up: flag it as a
  // non-blocking warning rather than silently saving it with no signal.
  const invItem = row.itemId ? inventory.find(i => i.id === row.itemId) : null;
  const qtyNum = Number(row.quantity);
  const isLow = invItem && qtyNum > 0 && qtyNum > Number(invItem.quantity);
  // Same Finished Items / Raw Ingredients split used by the "Links to
  // inventory item" field — so it's just as obvious here that "Chicken
  // Biriyani" is a finished dish, not a raw ingredient like Butter or
  // Sugar, before it gets picked into a recipe by mistake.
  const finished = inventory.filter(i => finishedIds && finishedIds.has(i.id));
  const raw = inventory.filter(i => !(finishedIds && finishedIds.has(i.id)));
  const ingredientOptionsHtml = `
    ${finished.length ? `<optgroup label="Finished Items">
      ${finished.map(i => `<option value="${i.id}" ${row.itemId === i.id ? 'selected' : ''}>${esc(i.name)} (${i.unit})</option>`).join('')}
    </optgroup>` : ''}
    <optgroup label="Raw Ingredients">
      ${raw.map(i => `<option value="${i.id}" ${row.itemId === i.id ? 'selected' : ''}>${esc(i.name)} (${i.unit})</option>`).join('')}
    </optgroup>`;
  return `
    <div class="form-row cols-2" data-rec-ing-row="${idx}" style="align-items:flex-end;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed var(--border)">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Ingredient</label>
        <select class="form-input" data-rec-ing-select="${idx}">
          <option value="">— Custom ingredient —</option>
          ${ingredientOptionsHtml}
        </select>
        ${!row.itemId ? `<input class="form-input" style="margin-top:6px" data-rec-ing-name="${idx}" value="${esc(row.name || '')}" placeholder="Custom ingredient name">` : ''}
      </div>
      <div class="form-row cols-2" style="margin-bottom:0">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Qty</label>
          <input type="number" class="form-input" data-rec-ing-qty="${idx}" value="${row.quantity}" placeholder="0">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Unit</label>
          <input class="form-input" data-rec-ing-unit="${idx}" value="${esc(row.unit || '')}" placeholder="g, ml, pcs…">
        </div>
      </div>
      ${isLow ? `<div style="grid-column:1/-1;font-size:12px;color:var(--danger);margin-top:2px">⚠ Only ${invItem.quantity} ${esc(invItem.unit)} of "${esc(invItem.name)}" in stock — this recipe needs ${qtyNum} ${esc(row.unit || invItem.unit)} per batch. You can still save it, but a batch can't be completed until you restock.</div>` : ''}
      <div style="grid-column:1/-1;display:flex;justify-content:flex-end">
        <button type="button" class="btn btn-danger btn-sm btn-icon" data-rec-ing-remove="${idx}" title="Remove row">✕</button>
      </div>
    </div>`;
}

function openRecipeModal(recipe, inventory, recipes, onSaved, products) {
  const isEdit = !!recipe;
  products = products || [];
  // Suggest every Product Catalog name in the Recipe name field — purely a
  // naming aid so it's easy to reuse the exact name a product already has
  // instead of retyping it slightly differently and ending up with an
  // accidental duplicate recipe. Not restricted to unlinked products: even
  // a product that already has a recipe is worth suggesting, since you
  // might be intentionally creating an alternate/updated version.
  const suggestableProducts = products;
  // Items already linked as some *other* recipe's output are established
  // "finished goods" — group those separately from raw/unlinked inventory
  // so it's obvious at a glance which items are safe to pick here, instead
  // of raw ingredients like Sugar or Eggs sitting in the same flat list.
  const finishedIds = new Set(
    recipes.filter(r => r.linkedItemId && r.id !== (recipe && recipe.id)).map(r => r.linkedItemId)
  );
  const finishedItems = inventory.filter(i => finishedIds.has(i.id));
  const otherItems = inventory.filter(i => !finishedIds.has(i.id));
  const linkedItemOptionsHtml = () => `
    ${finishedItems.length ? `<optgroup label="Finished Items">
      ${finishedItems.map(i => `<option value="${i.id}" ${form.linkedItemId === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}
    </optgroup>` : ''}
    <optgroup label="Other Inventory Items (raw ingredients / unlinked)">
      ${otherItems.map(i => `<option value="${i.id}" ${form.linkedItemId === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}
    </optgroup>`;
  const form = recipe
    ? {
        name: recipe.name, category: recipe.category || '', linkedItemId: recipe.linkedItemId || '',
        yieldQty: recipe.yieldQty, yieldUnit: recipe.yieldUnit || 'batch',
        prepTimeMinutes: recipe.prepTimeMinutes || 0, bakeTimeMinutes: recipe.bakeTimeMinutes || 0,
        instructions: recipe.instructions || '', notes: recipe.notes || '', imageUrl: recipe.imageUrl || '',
        ingredients: recipe.ingredients.map(i => ({ itemId: i.itemId, name: i.name, quantity: i.quantity, unit: i.unit })),
      }
    : {
        name: '', category: '', linkedItemId: '', yieldQty: 1, yieldUnit: 'batch',
        prepTimeMinutes: 0, bakeTimeMinutes: 0, instructions: '', notes: '', imageUrl: '',
        ingredients: [{ itemId: '', name: '', quantity: '', unit: '' }],
      };

  const estCost = () => form.ingredients.reduce((sum, r) => {
    const invItem = inventory.find(i => i.id === r.itemId);
    return sum + (Number(r.quantity) || 0) * (invItem ? invItem.costPerUnit : 0);
  }, 0);

  const bodyHtml = () => `
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">Recipe name</label>
        <input class="form-input" id="rec-name" list="rec-name-suggestions" value="${esc(form.name)}" placeholder="e.g. Classic Butter Croissant">
        <datalist id="rec-name-suggestions">
          ${suggestableProducts.map(p => `<option value="${esc(p.name)}">`).join('')}
        </datalist>
        ${suggestableProducts.length ? `<div class="text-muted" style="font-size:11px;margin-top:4px">Start typing to match an existing Product Catalog item — reuse its name so this recipe links up cleanly.</div>` : ''}
      </div>
      <div class="form-group"><label class="form-label">Category</label><input class="form-input" id="rec-category" value="${esc(form.category)}" placeholder="e.g. Pastries"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Links to inventory item (optional)</label>
      <select class="form-input" id="rec-linked-item">
        <option value="">— Not linked —</option>
        ${linkedItemOptionsHtml()}
      </select>
      ${(() => {
        const picked = inventory.find(i => i.id === form.linkedItemId);
        return picked && !finishedIds.has(picked.id)
          ? `<div style="font-size:12px;color:var(--danger);margin-top:6px">⚠ "${esc(picked.name)}" isn't yet used as any recipe's finished output — double check this isn't a raw ingredient (flour, sugar, eggs, etc.) picked by mistake.</div>`
          : '';
      })()}
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Yield quantity</label><input type="number" class="form-input" id="rec-yield-qty" value="${form.yieldQty}" placeholder="1"></div>
      <div class="form-group"><label class="form-label">Yield unit</label><input class="form-input" id="rec-yield-unit" value="${esc(form.yieldUnit)}" placeholder="batch, dozen, loaves…"></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Prep time (minutes)</label><input type="number" class="form-input" id="rec-prep-time" value="${form.prepTimeMinutes}" placeholder="0"></div>
      <div class="form-group"><label class="form-label">Bake time (minutes)</label><input type="number" class="form-input" id="rec-bake-time" value="${form.bakeTimeMinutes}" placeholder="0"></div>
    </div>
    <div class="form-group">
      <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
        <span>Ingredients</span>
        <button type="button" class="btn btn-outline btn-sm" id="rec-add-ing">+ Add ingredient</button>
      </label>
      <div id="rec-ingredients">${form.ingredients.map((row, idx) => recipeIngredientRowHtml(row, idx, inventory, finishedIds)).join('')}</div>
    </div>
    <div class="form-group"><label class="form-label">Instructions</label><textarea class="form-input" id="rec-instructions" rows="5" placeholder="Step-by-step method…">${esc(form.instructions)}</textarea></div>
    <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="rec-notes" value="${esc(form.notes)}" placeholder="Substitutions, storage tips, etc."></div>
    <div style="text-align:right;font-size:14px;font-weight:700;padding-top:8px;border-top:1px solid var(--border)">Estimated cost per batch: ₹${inr(estCost())}</div>`;

  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="rec-save">${isEdit ? 'Save Changes' : 'Create Recipe'}</button>`;

  const readForm = (overlay) => {
    form.name = overlay.querySelector('#rec-name').value;
    form.category = overlay.querySelector('#rec-category').value;
    form.linkedItemId = overlay.querySelector('#rec-linked-item').value;
    form.yieldQty = overlay.querySelector('#rec-yield-qty').value;
    form.yieldUnit = overlay.querySelector('#rec-yield-unit').value;
    form.prepTimeMinutes = overlay.querySelector('#rec-prep-time').value;
    form.bakeTimeMinutes = overlay.querySelector('#rec-bake-time').value;
    form.instructions = overlay.querySelector('#rec-instructions').value;
    form.notes = overlay.querySelector('#rec-notes').value;
  };

  const rerenderBody = (overlay) => {
    readForm(overlay);
    overlay.querySelector('.modal-body').innerHTML = bodyHtml();
    wireBody(overlay);
  };

  const wireBody = (overlay) => {
    overlay.querySelector('#rec-linked-item').addEventListener('change', () => rerenderBody(overlay));
    overlay.querySelector('#rec-add-ing').addEventListener('click', () => {
      form.ingredients.push({ itemId: '', name: '', quantity: '', unit: '' });
      rerenderBody(overlay);
    });
    form.ingredients.forEach((row, idx) => {
      const sel = overlay.querySelector(`[data-rec-ing-select="${idx}"]`);
      if (sel) sel.addEventListener('change', (e) => {
        const invItem = inventory.find(i => i.id === e.target.value);
        row.itemId = e.target.value || '';
        row.name = invItem ? invItem.name : '';
        if (invItem && !row.unit) row.unit = invItem.unit;
        rerenderBody(overlay);
      });
      const nameInput = overlay.querySelector(`[data-rec-ing-name="${idx}"]`);
      if (nameInput) nameInput.addEventListener('input', (e) => { row.name = e.target.value; });
      const qtyInput = overlay.querySelector(`[data-rec-ing-qty="${idx}"]`);
      if (qtyInput) qtyInput.addEventListener('input', (e) => { row.quantity = e.target.value; rerenderBody(overlay); });
      const unitInput = overlay.querySelector(`[data-rec-ing-unit="${idx}"]`);
      if (unitInput) unitInput.addEventListener('input', (e) => { row.unit = e.target.value; });
      const removeBtn = overlay.querySelector(`[data-rec-ing-remove="${idx}"]`);
      if (removeBtn) removeBtn.addEventListener('click', () => {
        if (form.ingredients.length <= 1) return toast('At least one ingredient row is required', 'error');
        form.ingredients.splice(idx, 1);
        rerenderBody(overlay);
      });
    });
  };

  const buildPayload = (overlay) => {
    readForm(overlay);
    const ingredients = form.ingredients
      .filter(r => (r.name || '').trim() && Number(r.quantity) > 0)
      .map(r => ({ itemId: r.itemId || null, name: r.name, quantity: Number(r.quantity), unit: r.unit || '' }));
    return {
      name: form.name,
      category: form.category,
      linkedItemId: form.linkedItemId || null,
      yieldQty: Number(form.yieldQty) || 1,
      yieldUnit: form.yieldUnit || 'batch',
      prepTimeMinutes: Number(form.prepTimeMinutes) || 0,
      bakeTimeMinutes: Number(form.bakeTimeMinutes) || 0,
      instructions: form.instructions,
      notes: form.notes,
      imageUrl: form.imageUrl,
      ingredients,
    };
  };

  openModal({
    title: isEdit ? `Edit ${recipe.name}` : 'New Recipe',
    bodyHtml: bodyHtml(), footerHtml,
    onMount: (overlay) => {
      wireBody(overlay);
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#rec-save').addEventListener('click', async () => {
        const payload = buildPayload(overlay);
        if (!payload.name.trim()) return toast('Recipe name is required', 'error');
        if (!payload.ingredients.length) return toast('Add at least one ingredient with a quantity', 'error');
        try {
          if (isEdit) {
            await api.updateRecipe(recipe.id, payload);
            toast('Recipe updated!', 'success');
          } else {
            await api.createRecipe(payload);
            toast('Recipe created!', 'success');
          }
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function openRecipeDetailModal(id, inventory, onChanged, products) {
  let recipe;
  try { recipe = await api.getRecipe(id); } catch (err) { return toast(err.message, 'error'); }

  const bodyHtml = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div>
        <div style="font-size:12px;color:var(--text-tertiary)">${esc(recipe.category || 'Uncategorized')}</div>
        <div class="font-medium" style="font-size:15px">Yields ${recipe.yieldQty} ${esc(recipe.yieldUnit)}${recipe.linkedItemName ? ` · makes ${esc(recipe.linkedItemName)}` : ''}</div>
      </div>
      <div style="text-align:right;font-size:13px;color:var(--text-tertiary)">
        ${recipe.prepTimeMinutes ? `Prep ${recipe.prepTimeMinutes}m` : ''}${recipe.prepTimeMinutes && recipe.bakeTimeMinutes ? ' · ' : ''}${recipe.bakeTimeMinutes ? `Bake ${recipe.bakeTimeMinutes}m` : ''}
      </div>
    </div>
    <div class="table-wrap" style="margin-bottom:12px">
      <table>
        <thead><tr><th>Ingredient</th><th>Qty</th><th>Cost/unit</th><th>Total</th></tr></thead>
        <tbody>
          ${recipe.ingredients.map(i => `<tr><td>${esc(i.name)}</td><td>${i.quantity} ${esc(i.unit || '')}</td><td>₹${inr(i.costPerUnit)}</td><td class="font-medium">₹${inr(i.lineCost)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;padding-top:8px;border-top:1px solid var(--border);margin-bottom:6px">
      <span>Cost per batch</span><span>₹${inr(recipe.costPerBatch)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-tertiary);margin-bottom:14px">
      <span>Cost per ${esc(recipe.yieldUnit)} unit · suggested price</span><span>₹${inr(recipe.costPerUnit)} · ₹${inr(recipe.suggestedPrice)}</span>
    </div>
    ${recipe.instructions ? `<div style="margin-bottom:10px"><div class="form-label" style="margin-bottom:4px">Instructions</div><div style="white-space:pre-wrap;font-size:14px;color:var(--text-secondary)">${esc(recipe.instructions)}</div></div>` : ''}
    ${recipe.notes ? `<div class="text-muted" style="font-size:13px">Notes: ${esc(recipe.notes)}</div>` : ''}`;

  const footerHtml = `<button class="btn btn-outline" data-cancel>Close</button><button class="btn btn-outline" data-rec-edit>Edit</button><button class="btn btn-danger" data-rec-delete>Delete</button>`;

  openModal({
    title: recipe.name,
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('[data-rec-edit]').addEventListener('click', () => {
        closeModal();
        openRecipeModal(recipe, inventory, recipesState.list, onChanged, products);
      });
      overlay.querySelector('[data-rec-delete]').addEventListener('click', () => {
        confirmDialog(`Delete "${recipe.name}"?`, async () => {
          try {
            await api.deleteRecipe(recipe.id);
            toast('Recipe deleted', 'success');
            closeModal();
            onChanged();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    },
  });
}

async function renderRecipes(content) {
  const [data, inventory, productsData] = await Promise.all([api.getRecipes(), api.getInventory(), api.getProducts().catch(() => ({ products: [] }))]);
  recipesState.list = data.recipes;
  const products = productsData.products || productsData;

  const draw = () => {
    const filtered = recipesState.list.filter(r =>
      r.name.toLowerCase().includes(recipesState.search.toLowerCase()) ||
      (r.category || '').toLowerCase().includes(recipesState.search.toLowerCase()));
    const avgCost = recipesState.list.length
      ? recipesState.list.reduce((s, r) => s + r.costPerBatch, 0) / recipesState.list.length : 0;

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Total Recipes</div><div class="metric-value">${recipesState.list.length}</div></div>
        <div class="metric-card"><div class="metric-label">Avg. Cost / Batch</div><div class="metric-value">₹${inr(avgCost)}</div></div>
        <div class="metric-card"><div class="metric-label">Linked to Inventory</div><div class="metric-value">${recipesState.list.filter(r => r.linkedItemId).length}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recipes</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <div class="search-bar"><span>🔍</span><input id="rec-search" placeholder="Search…" value="${esc(recipesState.search)}"></div>
            <button class="btn btn-primary btn-sm" id="rec-add">+ New Recipe</button>
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('📖', 'No recipes found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Recipe</th><th>Category</th><th>Yield</th><th>Ingredients</th><th>Cost / batch</th><th>Cost / unit</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(r => `
                <tr>
                  <td class="font-medium">${esc(r.name)}</td>
                  <td class="text-muted">${esc(r.category || '—')}</td>
                  <td class="text-muted">${r.yieldQty} ${esc(r.yieldUnit)}</td>
                  <td class="text-muted">${r.ingredientCount}</td>
                  <td class="font-medium">₹${inr(r.costPerBatch)}</td>
                  <td class="text-muted">₹${inr(r.costPerUnit)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-rec-view="${r.id}">View</button>
                      <button class="btn btn-danger btn-sm btn-icon" data-rec-delete="${r.id}">✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $('#rec-search', content).addEventListener('input', (e) => { recipesState.search = e.target.value; draw(); });
    const refresh = async () => { const d = await api.getRecipes(); recipesState.list = d.recipes; draw(); };
    $('#rec-add', content).addEventListener('click', () => openRecipeModal(null, inventory, recipesState.list, refresh, products));
    $$('[data-rec-view]', content).forEach(btn => btn.addEventListener('click', () => openRecipeDetailModal(btn.dataset.recView, inventory, refresh, products)));
    $$('[data-rec-delete]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Delete this recipe?', async () => {
        try {
          await api.deleteRecipe(btn.dataset.recDelete);
          toast('Recipe deleted', 'success');
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Production ───────────────────────────────────────────────────────────
let productionState = { list: [], filter: 'all' };

function openScheduleBatchModal(recipes, inventory, onSaved) {
  const form = { recipeId: '', outputItemId: '', outputItemTouched: false, multiplier: 1, scheduledDate: '', notes: '' };

  // Only inventory items already used as a recipe's output are valid
  // production-batch outputs — raw ingredients (flour, sugar, butter...)
  // should never show up here, since "completing a batch" is supposed to
  // create finished goods, not accidentally restock an ingredient.
  const finishedItemIds = new Set(recipes.map(r => r.linkedItemId).filter(Boolean));
  const finishedItems = inventory.filter(i => finishedItemIds.has(i.id));

  const bodyHtml = () => {
    const recipe = recipes.find(r => r.id === form.recipeId);
    const estCost = recipe ? recipe.costPerBatch * (Number(form.multiplier) || 1) : 0;
    const estYield = recipe ? recipe.yieldQty * (Number(form.multiplier) || 1) : 0;
    return `
    <div class="form-group">
      <label class="form-label">Recipe</label>
      <select class="form-input" id="pb-recipe">
        <option value="">— Select a recipe —</option>
        ${recipes.map(r => `<option value="${r.id}" ${form.recipeId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Adds finished stock to</label>
      <select class="form-input" id="pb-output-item">
        <option value="">— Don't track finished stock —</option>
        ${finishedItems.map(i => `<option value="${i.id}" ${form.outputItemId === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}
      </select>
      ${!form.outputItemId ? `<div style="font-size:12px;color:var(--danger);margin-top:6px">⚠ No item selected — completing this batch will use up the ingredients but won't add any finished stock to Inventory.</div>` : ''}
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Multiplier (batches)</label><input type="number" class="form-input" id="pb-multiplier" value="${form.multiplier}" min="0.1" step="0.5"></div>
      <div class="form-group"><label class="form-label">Scheduled date</label><input type="date" class="form-input" id="pb-date" value="${esc(form.scheduledDate)}"></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="pb-notes" value="${esc(form.notes)}" placeholder="Special instructions, order this is for, etc."></div>
    ${recipe ? `<div style="text-align:right;font-size:14px;font-weight:700;padding-top:8px;border-top:1px solid var(--border)">Yields ${estYield} ${esc(recipe.yieldUnit)} · Est. cost ₹${inr(estCost)}</div>` : ''}`;
  };

  const readForm = (overlay) => {
    form.recipeId = overlay.querySelector('#pb-recipe').value;
    form.outputItemId = overlay.querySelector('#pb-output-item').value;
    form.multiplier = overlay.querySelector('#pb-multiplier').value;
    form.scheduledDate = overlay.querySelector('#pb-date').value;
    form.notes = overlay.querySelector('#pb-notes').value;
  };

  openModal({
    title: 'Schedule Production Batch',
    bodyHtml: bodyHtml(),
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="pb-save">Schedule Batch</button>`,
    onMount: (overlay) => {
      const rerender = () => { readForm(overlay); overlay.querySelector('.modal-body').innerHTML = bodyHtml(); wire(overlay); };
      const wire = (ov) => {
        ov.querySelector('#pb-recipe').addEventListener('change', () => {
          readForm(ov);
          // Pre-fill the output item from the recipe's own link the first
          // time a recipe is picked, but never overwrite a choice the
          // person already made themselves.
          if (!form.outputItemTouched) {
            const recipe = recipes.find(r => r.id === form.recipeId);
            form.outputItemId = (recipe && recipe.linkedItemId) || '';
          }
          rerender();
        });
        ov.querySelector('#pb-output-item').addEventListener('change', (e) => {
          form.outputItemTouched = true;
          form.outputItemId = e.target.value;
          rerender();
        });
        ov.querySelector('#pb-multiplier').addEventListener('input', rerender);
      };
      wire(overlay);
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#pb-save').addEventListener('click', async () => {
        readForm(overlay);
        if (!form.recipeId) return toast('Select a recipe', 'error');
        const proceed = async () => {
          try {
            await api.createProductionBatch({
              recipeId: form.recipeId,
              outputItemId: form.outputItemId || null,
              multiplier: Number(form.multiplier) || 1,
              scheduledDate: form.scheduledDate,
              notes: form.notes,
            });
            toast('Batch scheduled!', 'success');
            closeModal();
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        };
        if (!form.outputItemId) {
          confirmDialog("This batch won't add any finished stock to Inventory when completed. Schedule it anyway?", proceed, { confirmLabel: 'Schedule Anyway', confirmClass: 'btn-primary' });
        } else {
          await proceed();
        }
      });
    },
  });
}

async function openBatchDetailModal(id, onChanged) {
  let batch;
  try { batch = await api.getProductionBatch(id); } catch (err) { return toast(err.message, 'error'); }

  const bodyHtml = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div>
        <div style="font-size:12px;color:var(--text-tertiary)">${esc(batch.recipeName)} × ${batch.multiplier}</div>
        <div class="font-medium" style="font-size:15px">Yields ${batch.plannedQty} ${esc(batch.yieldUnit)}${batch.outputItemName ? ` of ${esc(batch.outputItemName)}` : ''}</div>
      </div>
      ${pbPill(batch.status)}
    </div>
    ${!batch.outputItemId && batch.status !== 'completed' ? `<div style="font-size:12px;color:var(--danger);background:var(--danger-bg);border-radius:8px;padding:8px 12px;margin-bottom:12px">⚠ No output item linked — completing this batch will use up the ingredients but won't add any finished stock to Inventory.</div>` : ''}
    <div class="table-wrap" style="margin-bottom:12px">
      <table>
        <thead><tr><th>Ingredient</th><th>Qty needed</th><th>Cost/unit</th><th>Total</th></tr></thead>
        <tbody>
          ${batch.ingredients.map(i => `<tr><td>${esc(i.name)}</td><td>${i.quantity} ${esc(i.unit || '')}</td><td>₹${inr(i.costPerUnit)}</td><td class="font-medium">₹${inr(i.totalCost)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;padding-top:8px;border-top:1px solid var(--border);margin-bottom:14px">
      <span>Total cost</span><span>₹${inr(batch.totalCost)}</span>
    </div>
    ${batch.scheduledDate ? `<div class="text-muted" style="font-size:13px;margin-bottom:4px">Scheduled: ${dateStr(batch.scheduledDate + ' 00:00:00')}</div>` : ''}
    ${batch.notes ? `<div class="text-muted" style="font-size:13px">Notes: ${esc(batch.notes)}</div>` : ''}`;

  const actions = [];
  if (batch.status === 'planned') {
    actions.push(`<button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)" data-pb-cancel>Cancel Batch</button>`);
    actions.push(`<button class="btn btn-primary" data-pb-start>Start Baking</button>`);
  } else if (batch.status === 'in_progress') {
    actions.push(`<button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)" data-pb-cancel>Cancel Batch</button>`);
    actions.push(`<button class="btn btn-primary" data-pb-complete>Mark Completed</button>`);
  }
  const footerHtml = `<button class="btn btn-outline" data-cancel>Close</button>${actions.join('')}`;

  openModal({
    title: batch.batchNumber,
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      const cancelBtn = overlay.querySelector('[data-pb-cancel]');
      if (cancelBtn) cancelBtn.addEventListener('click', () => {
        confirmDialog('Cancel this production batch?', async () => {
          try {
            await api.updateProductionBatchStatus(batch.id, 'cancelled');
            toast('Batch cancelled', 'success');
            closeModal();
            onChanged();
          } catch (err) { toast(err.message, 'error'); }
        }, { confirmLabel: 'Cancel Batch', confirmClass: 'btn-danger' });
      });
      const startBtn = overlay.querySelector('[data-pb-start]');
      if (startBtn) startBtn.addEventListener('click', async () => {
        try {
          await api.updateProductionBatchStatus(batch.id, 'in_progress');
          toast('Batch started', 'success');
          closeModal();
          onChanged();
        } catch (err) { toast(err.message, 'error'); }
      });
      const completeBtn = overlay.querySelector('[data-pb-complete]');
      if (completeBtn) completeBtn.addEventListener('click', async () => {
        try {
          await api.updateProductionBatchStatus(batch.id, 'completed');
          toast('Batch completed — stock updated', 'success');
          closeModal();
          onChanged();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function renderProduction(content) {
  const data = await api.getProductionBatches();
  productionState.list = data.batches;

  const draw = () => {
    const filtered = productionState.filter === 'all' ? productionState.list : productionState.list.filter(b => b.status === productionState.filter);

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Active Batches</div><div class="metric-value">${data.activeCount}</div></div>
        <div class="metric-card"><div class="metric-label">Completed Today</div><div class="metric-value">${data.completedToday}</div></div>
        <div class="metric-card"><div class="metric-label">Total Production Cost</div><div class="metric-value">₹${inr(data.completedCost)}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Production Batches</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${['all', 'planned', 'in_progress', 'completed', 'cancelled'].map(f => `<button class="btn btn-sm ${productionState.filter === f ? 'btn-primary' : 'btn-outline'}" data-pb-filter="${f}">${f === 'all' ? 'All' : (PB_STATUS_META[f] ? PB_STATUS_META[f].label : f)}</button>`).join('')}
            ${window.CURRENT_ROLE === 'admin' ? `<button class="btn btn-primary btn-sm" id="pb-add">+ Schedule Batch</button>` : ''}
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('🥖', 'No production batches found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Batch</th><th>Recipe</th><th>Yields</th><th>Cost</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(b => `
                <tr>
                  <td class="font-medium" style="color:var(--brand)">${esc(b.batchNumber)}</td>
                  <td>${esc(b.recipeName)} × ${b.multiplier}</td>
                  <td class="text-muted">${b.plannedQty} ${esc(b.yieldUnit)}</td>
                  <td class="font-medium">₹${inr(b.totalCost)}</td>
                  <td class="text-muted">${b.scheduledDate ? dateStr(b.scheduledDate + ' 00:00:00') : '—'}</td>
                  <td>${pbPill(b.status)}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-outline btn-sm" data-pb-view="${b.id}">View</button>
                      ${(window.CURRENT_ROLE === 'admin' && (b.status === 'planned' || b.status === 'cancelled')) ? `<button class="btn btn-danger btn-sm btn-icon" data-pb-delete="${b.id}">✕</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $$('[data-pb-filter]', content).forEach(btn => btn.addEventListener('click', () => { productionState.filter = btn.dataset.pbFilter; draw(); }));
    const refresh = async () => { const d = await api.getProductionBatches(); Object.assign(data, d); productionState.list = d.batches; draw(); };
    const addBtn = $('#pb-add', content);
    if (addBtn) addBtn.addEventListener('click', async () => {
      const [recipeData, inventory] = await Promise.all([api.getRecipes(), api.getInventory()]);
      if (!recipeData.recipes.length) return toast('Create a recipe first', 'error');
      openScheduleBatchModal(recipeData.recipes, inventory, refresh);
    });
    $$('[data-pb-view]', content).forEach(btn => btn.addEventListener('click', () => openBatchDetailModal(btn.dataset.pbView, refresh)));
    $$('[data-pb-delete]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Delete this production batch?', async () => {
        try {
          await api.deleteProductionBatch(btn.dataset.pbDelete);
          toast('Batch deleted', 'success');
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Supplier Restock Alerts ─────────────────────────────────────────────
let restockAlertsState = { tab: 'low-stock' };

function suggestedReorderQty(item) {
  const target = item.minStock * 2;
  const qty = Math.max(target - item.quantity, item.minStock, 1);
  return Math.round(qty * 100) / 100;
}

async function renderRestockAlerts(content) {
  const data = await api.getRestockAlerts();

  const draw = () => {
    const bySupplier = {};
    data.lowStock.forEach(item => {
      const key = item.supplierId || '__none__';
      if (!bySupplier[key]) bySupplier[key] = { supplierId: item.supplierId, supplierName: item.supplierName || 'No supplier assigned', items: [] };
      bySupplier[key].items.push(item);
    });
    const supplierGroups = Object.values(bySupplier).sort((a, b) => b.items.length - a.items.length);

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Low / Critical Items</div><div class="metric-value">${data.lowStock.length}</div></div>
        <div class="metric-card"><div class="metric-label">Critical</div><div class="metric-value">${data.criticalCount}</div></div>
        <div class="metric-card"><div class="metric-label">Suppliers Affected</div><div class="metric-value">${data.suppliersAffected}</div></div>
        <div class="metric-card"><div class="metric-label">Open Alerts</div><div class="metric-value">${data.openCount}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm ${restockAlertsState.tab === 'low-stock' ? 'btn-primary' : 'btn-outline'}" data-ra-tab="low-stock">Low Stock by Supplier</button>
            <button class="btn btn-sm ${restockAlertsState.tab === 'log' ? 'btn-primary' : 'btn-outline'}" data-ra-tab="log">Alert Log</button>
            ${window.CURRENT_ROLE !== 'supplier' ? `<button class="btn btn-sm ${restockAlertsState.tab === 'tracking' ? 'btn-primary' : 'btn-outline'}" data-ra-tab="tracking">🚚 Supplier Tracking</button>` : ''}
            ${window.CURRENT_ROLE === 'supplier' ? `<button class="btn btn-sm ${restockAlertsState.tab === 'delivery-partners' ? 'btn-primary' : 'btn-outline'}" data-ra-tab="delivery-partners">🧑‍✈️ Delivery Partners</button>` : ''}
          </div>
          ${restockAlertsState.tab === 'low-stock' && data.lowStock.length && window.CURRENT_ROLE !== 'supplier' ? `<button class="btn btn-primary btn-sm" id="ra-scan-all">🔔 Raise Alerts for All</button>` : ''}
        </div>
        ${restockAlertsState.tab === 'low-stock' ? renderLowStockTab(supplierGroups)
          : restockAlertsState.tab === 'tracking' ? renderSupplierTrackingTab(data.alerts)
          : restockAlertsState.tab === 'delivery-partners' ? '<div id="ra-delivery-partners">' + spinner() + '</div>'
          : renderLogTab(data.alerts)}
      </div>`;

    $$('[data-ra-tab]', content).forEach(btn => btn.addEventListener('click', () => { restockAlertsState.tab = btn.dataset.raTab; draw(); }));

    const loadDeliveryPartnersModule = async () => {
      const holder = $('#ra-delivery-partners', content);
      if (!holder) return;
      try {
        const partners = await api.getDeliveryPartners();
        holder.innerHTML = renderDeliveryPartnersModule(partners);
        const addBtn = $('#dp-add-btn', holder);
        if (addBtn) addBtn.addEventListener('click', () => addDeliveryPartnerModal(loadDeliveryPartnersModule));
        $$('[data-dp-delete]', holder).forEach(btn => btn.addEventListener('click', async () => {
          if (!confirm('Remove this delivery partner? This can\'t be undone.')) return;
          try {
            await api.deleteDeliveryPartner(btn.dataset.dpDelete);
            toast('Delivery partner removed', 'success');
            loadDeliveryPartnersModule();
          } catch (err) { toast(err.message, 'error'); }
        }));
      } catch (err) {
        holder.innerHTML = emptyState('⚠️', 'Could not load delivery partners');
      }
    };
    if (restockAlertsState.tab === 'delivery-partners') loadDeliveryPartnersModule();

    const refresh = async () => { const d = await api.getRestockAlerts(); Object.assign(data, d); draw(); };

    const scanBtn = $('#ra-scan-all', content);
    if (scanBtn) scanBtn.addEventListener('click', async () => {
      try {
        const res = await api.raiseAllRestockAlerts();
        toast(`Raised ${res.alerts.length} alert${res.alerts.length === 1 ? '' : 's'}`, 'success');
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    });

    $$('[data-ra-alert]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api.raiseRestockAlert(btn.dataset.raAlert);
        toast('Alert raised', 'success');
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    }));

    $$('[data-ra-po-supplier]', content).forEach(btn => btn.addEventListener('click', async () => {
      const group = supplierGroups.find(g => (g.supplierId || '__none__') === btn.dataset.raPoSupplier);
      if (!group) return;
      const [suppliers, inventory] = await Promise.all([api.getSuppliers(), api.getInventory()]);
      openPurchaseOrderModal(null, suppliers, inventory, refresh, {
        supplierId: group.supplierId || '',
        items: group.items.map(i => ({ itemId: i.itemId, name: i.itemName, quantity: suggestedReorderQty(i), costPerUnit: i.costPerUnit })),
      });
    }));

    $$('[data-ra-ack]', content).forEach(btn => btn.addEventListener('click', async () => {
      try { await api.updateRestockAlertStatus(btn.dataset.raAck, 'acknowledged'); toast('Alert acknowledged', 'success'); refresh(); } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-ra-ready]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api.updateRestockAlertStatus(btn.dataset.raReady, 'ready');
        toast('Order marked ready — assign a delivery partner to dispatch it', 'success');
        // Move straight into assigning a delivery partner + tracking number
        // so the supplier doesn't have to find and click a second button —
        // marking ready and dispatching are one continuous action.
        await assignDeliveryPartnerModal(async ({ deliveryPartner, trackingNumber }) => {
          await api.updateRestockAlertStatus(btn.dataset.raReady, 'dispatched', { deliveryPartner, trackingNumber });
          toast('Delivery partner assigned — order dispatched', 'success');
          refresh();
        });
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-ra-assign]', content).forEach(btn => btn.addEventListener('click', async () => {
      await assignDeliveryPartnerModal(async ({ deliveryPartner, trackingNumber }) => {
        await api.updateRestockAlertStatus(btn.dataset.raAssign, 'dispatched', { deliveryPartner, trackingNumber });
        toast('Delivery partner assigned', 'success');
        refresh();
      });
    }));
    $$('[data-ra-receive]', content).forEach(btn => btn.addEventListener('click', async () => {
      const alertRow = data.alerts.find(a => a.id === btn.dataset.raReceive);
      if (!alertRow) return;
      let suppliers, inventory;
      try {
        [suppliers, inventory] = await Promise.all([api.getSuppliers(), api.getInventory()]);
      } catch (err) { return toast(err.message, 'error'); }
      const invItem = inventory.find(i => i.id === alertRow.itemId);
      // Suggest enough to bring stock back above min: at least the gap
      // between what's on hand and min stock, or the min stock itself.
      const suggestedQty = Math.max(alertRow.minStock - alertRow.quantityAtAlert, alertRow.minStock, 1);
      openPurchaseOrderModal(null, suppliers, inventory, async (po) => {
        try {
          await api.updateRestockAlertStatus(alertRow.id, 'received');
          toast(po && po.poNumber ? `Alert marked as received — linked to ${po.poNumber}` : 'Marked as received', 'success');
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      }, {
        receiveMode: true,
        supplierId: alertRow.supplierId || '',
        notes: `Restock alert — ${alertRow.itemName}${alertRow.deliveryPartner ? ` (via ${alertRow.deliveryPartner}${alertRow.trackingNumber ? `, #${alertRow.trackingNumber}` : ''})` : ''}`,
        items: [{
          itemId: alertRow.itemId || '',
          name: alertRow.itemName,
          quantity: suggestedQty,
          costPerUnit: invItem ? invItem.costPerUnit : 0,
        }],
      });
    }));
    $$('[data-ra-resolve]', content).forEach(btn => btn.addEventListener('click', async () => {
      try { await api.updateRestockAlertStatus(btn.dataset.raResolve, 'resolved'); toast('Alert resolved', 'success'); refresh(); } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-ra-delete]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Remove this alert from the log?', async () => {
        try { await api.deleteRestockAlert(btn.dataset.raDelete); refresh(); } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// Shows the delivery partner accounts (username + phone) so a supplier can
// see who's available before assigning one to a dispatched restock — the
// same list used inside the "Assign Delivery Partner" modal, surfaced here
// as its own module for easy reference.
function renderDeliveryPartnersModule(partners) {
  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px 0">
      <div class="text-muted" style="font-size:12px">Use these credentials when assigning a delivery partner to dispatch a ready restock.</div>
      <button class="btn btn-primary btn-sm" id="dp-add-btn">+ Add Delivery Partner</button>
    </div>`;
  if (!partners.length) return header + emptyState('🧑\u200d✈️', 'No delivery partner accounts have been added yet');
  return header + `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Username</th><th>Phone</th><th></th></tr></thead>
        <tbody>
          ${partners.map(p => `
            <tr>
              <td class="font-medium">${esc(p.username)}</td>
              <td class="text-muted">${p.phone ? esc(p.phone) : '—'}</td>
              <td style="text-align:right"><button class="btn btn-outline btn-sm" data-dp-delete="${p.id}" title="Remove this delivery partner">🗑 Remove</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderLowStockTab(supplierGroups) {
  if (!supplierGroups.length) return emptyState('✅', 'Everything is well stocked — no low or critical items right now');
  const isSupplier = window.CURRENT_ROLE === 'supplier';
  return supplierGroups.map(group => `
    <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="font-medium">${esc(group.supplierName)}${group.supplierId ? '' : ' <span class="text-muted" style="font-weight:400">(link a supplier from Inventory to enable quick reordering)</span>'}</div>
        ${group.supplierId && !isSupplier ? `<button class="btn btn-outline btn-sm" data-ra-po-supplier="${group.supplierId}">Create Purchase Order</button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Stock</th><th>Min stock</th><th>Severity</th><th>Suggested reorder</th>${isSupplier ? '' : '<th>Actions</th>'}</tr></thead>
          <tbody>
            ${group.items.map(i => `
              <tr>
                <td class="font-medium">${esc(i.itemName)}</td>
                <td class="text-muted">${i.quantity} ${esc(i.unit)}</td>
                <td class="text-muted">${i.minStock} ${esc(i.unit)}</td>
                <td>${raSeverityPill(i.severity)}</td>
                <td class="text-muted">${suggestedReorderQty(i)} ${esc(i.unit)}</td>
                ${isSupplier ? '' : `<td>${i.openAlertId ? `<span class="text-muted" style="font-size:12px">Alert already open</span>` : `<button class="btn btn-outline btn-sm" data-ra-alert="${i.itemId}">Raise Alert</button>`}</td>`}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('');
}

// Actions column follows one path split across two roles:
// Supplier:   Acknowledge -> Ready for Pickup -> Assign Delivery Partner (dispatch)
// Admin/Staff: (once dispatched) Mark as Received -> Resolve
// Each step's button is the only one shown for that state/role, so there's
// never ambiguity about what happens next or who's responsible for it.
function raActionsForAlert(a) {
  const role = window.CURRENT_ROLE;
  if (role === 'supplier') {
    switch (a.status) {
      case 'open':
        return `<button class="btn btn-outline btn-sm" data-ra-ack="${a.id}">Acknowledge</button>`;
      case 'acknowledged':
        return `<button class="btn btn-primary btn-sm" data-ra-ready="${a.id}">📦 Ready — order is ready to be picked up by courier partner</button>`;
      case 'ready':
        return `<button class="btn btn-primary btn-sm" data-ra-assign="${a.id}">🚚 Dispatch</button>`;
      default:
        return '';
    }
  }
  if (role === 'admin' || role === 'staff') {
    switch (a.status) {
      case 'dispatched':
        return `<button class="btn btn-primary btn-sm" data-ra-receive="${a.id}">📥 Mark as Received</button>`;
      case 'received':
        return `<button class="btn btn-primary btn-sm" data-ra-resolve="${a.id}" title="Closes this alert only — it does not update inventory. Receive a Purchase Order to add stock.">Resolve</button>`;
      default:
        return '';
    }
  }
  return '';
}

function renderLogTab(alerts) {
  if (!alerts.length) return emptyState('🔔', 'No restock alerts raised yet');
  const isSupplier = window.CURRENT_ROLE === 'supplier';
  return `
    <div class="text-muted" style="font-size:12px;padding:10px 20px 0">Resolving an alert only closes it out — actual inventory quantity only updates when a Purchase Order for that item is marked <b>Received</b>.</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Supplier</th><th>Severity</th><th>Stock at alert</th><th>Status</th><th>Tracking</th><th>Raised</th><th>Actions</th></tr></thead>
        <tbody>
          ${alerts.map(a => `
            <tr>
              <td class="font-medium">${esc(a.itemName)}</td>
              <td class="text-muted">${esc(a.supplierName || '—')}</td>
              <td>${raSeverityPill(a.severity)}</td>
              <td class="text-muted">${a.quantityAtAlert} / min ${a.minStock}</td>
              <td>${raStatusPill(a.status)}</td>
              <td class="text-muted" style="font-size:12px">
                ${a.deliveryPartner ? `${esc(a.deliveryPartner)}<br>#${esc(a.trackingNumber)}` : '—'}
              </td>
              <td class="text-muted">${dateStr(a.createdAt)}</td>
              <td>
                <div style="display:flex;gap:6px;align-items:center">
                  ${raActionsForAlert(a)}
                  ${window.CURRENT_ROLE === 'admin' ? `<button class="btn btn-danger btn-sm btn-icon" data-ra-delete="${a.id}">✕</button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Supplier Tracking (admin/staff, read-only) ───────────────────────────
// A dedicated view of every alert that's actually moving — i.e. has a
// delivery partner + tracking number attached — grouped by supplier, so
// admin/staff can watch deliveries in flight without touching the
// supplier-only acknowledge/dispatch/receive/resolve actions themselves.
function renderSupplierTrackingTab(alerts) {
  const tracked = alerts.filter(a => a.deliveryPartner);
  if (!tracked.length) return emptyState('🚚', 'No deliveries in transit — tracking details appear here once a supplier assigns a delivery partner');

  const bySupplier = {};
  tracked.forEach(a => {
    const key = a.supplierId || '__none__';
    if (!bySupplier[key]) bySupplier[key] = { supplierName: a.supplierName || 'Unknown supplier', items: [] };
    bySupplier[key].items.push(a);
  });
  const groups = Object.values(bySupplier);

  return groups.map(group => `
    <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
      <div class="font-medium" style="margin-bottom:10px">${esc(group.supplierName)}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Delivery Partner</th><th>Tracking Number</th><th>Status</th><th>Dispatched</th><th>Received</th></tr></thead>
          <tbody>
            ${group.items.map(a => `
              <tr>
                <td class="font-medium">${esc(a.itemName)}</td>
                <td class="text-muted">${esc(a.deliveryPartner)}</td>
                <td class="text-muted">#${esc(a.trackingNumber)}</td>
                <td>${raStatusPill(a.status)}</td>
                <td class="text-muted">${a.dispatchedAt ? dateStr(a.dispatchedAt) : '—'}</td>
                <td class="text-muted">${a.receivedAt ? dateStr(a.receivedAt) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('');
}

// ── Users (admin only) ──────────────────────────────────────────────────
let usersState = { list: [], roleFilter: 'all' };

const ROLE_PILL = { admin: '<span class="pill pill-paid">Admin</span>', staff: '<span class="pill pill-ready">Staff</span>', customer: '<span class="pill pill-unpaid">Customer</span>', delivery: '<span class="pill pill-baking">Delivery</span>', supplier: '<span class="pill pill-baking">Supplier</span>' };
// Note: promoting an account *to* supplier isn't offered here as a quick
// one-click action, since it requires picking which supplier record to
// link — that flow lives in the "+ Add User" modal instead.
const NEXT_ROLE_ACTIONS = {
  admin: [{ role: 'staff', label: 'Make Staff' }, { role: 'customer', label: 'Make Customer' }, { role: 'delivery', label: 'Make Delivery' }],
  staff: [{ role: 'admin', label: 'Make Admin' }, { role: 'customer', label: 'Make Customer' }, { role: 'delivery', label: 'Make Delivery' }],
  customer: [{ role: 'admin', label: 'Make Admin' }, { role: 'staff', label: 'Make Staff' }, { role: 'delivery', label: 'Make Delivery' }],
  delivery: [{ role: 'admin', label: 'Make Admin' }, { role: 'staff', label: 'Make Staff' }, { role: 'customer', label: 'Make Customer' }],
  supplier: [{ role: 'admin', label: 'Make Admin' }, { role: 'staff', label: 'Make Staff' }, { role: 'customer', label: 'Make Customer' }],
};

async function openCreateUserModal(onSaved) {
  const form = { username: '', password: '', role: 'admin', phone: '', email: '', supplierId: '' };
  // Only suppliers without a login of their own can be linked to a new
  // supplier account.
  const allSuppliers = await api.getSuppliers();
  const linkableSuppliers = allSuppliers.filter(s => !s.userId);

  const supplierPickerHtml = () => `
    <div class="form-group" id="nu-supplier-group" style="display:${form.role === 'supplier' ? '' : 'none'}">
      <label class="form-label">Supplier</label>
      ${linkableSuppliers.length ? `
        <select class="form-input" id="nu-supplier">
          <option value="">Select a supplier…</option>
          ${linkableSuppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>` : `<div class="text-muted" style="font-size:12.5px">Every supplier already has a login, or none exist yet — add one from Supplier Management first.</div>`}
    </div>`;

  const bodyHtml = `
    <div class="form-group">
      <label class="form-label">Role</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['admin', 'staff', 'customer', 'delivery', 'supplier'].map(r => `<button type="button" class="btn ${form.role === r ? 'btn-primary' : 'btn-outline'} btn-sm" style="flex:1;justify-content:center" data-role-pick="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div id="nu-supplier-wrap">${supplierPickerHtml()}</div>
    <div class="form-group"><label class="form-label">Username</label><input class="form-input" id="nu-username" placeholder="e.g. priya.staff"></div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="nu-phone" placeholder="98XXXXXXXX"></div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="nu-email" placeholder="email@example.com"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input type="password" class="form-input" id="nu-password" placeholder="At least 8 characters, with upper/lowercase, a number and a symbol">
    </div>
    <div class="form-group">
      <label class="form-label">Confirm password</label>
      <input type="password" class="form-input" id="nu-password-confirm" placeholder="Re-enter the password">
    </div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="nu-save">Create Account</button>`;

  openModal({
    title: 'Add User',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      $$('[data-role-pick]', overlay).forEach(btn => btn.addEventListener('click', () => {
        form.role = btn.dataset.rolePick;
        $$('[data-role-pick]', overlay).forEach(b => {
          const active = b.dataset.rolePick === form.role;
          b.classList.toggle('btn-primary', active);
          b.classList.toggle('btn-outline', !active);
        });
        overlay.querySelector('#nu-supplier-wrap').innerHTML = supplierPickerHtml();
      }));
      overlay.querySelector('#nu-save').addEventListener('click', async () => {
        const username = overlay.querySelector('#nu-username').value.trim();
        const password = overlay.querySelector('#nu-password').value;
        const confirmPassword = overlay.querySelector('#nu-password-confirm').value;
        if (!username) return toast('Username required', 'error');
        if (!password) return toast('Password required', 'error');
        const strengthError = passwordStrengthError(password);
        if (strengthError) return toast(strengthError, 'error');
        if (password !== confirmPassword) return toast('Passwords do not match', 'error');
        const payload = {
          username, password, role: form.role,
          phone: overlay.querySelector('#nu-phone').value,
          email: overlay.querySelector('#nu-email').value,
        };
        if (form.role === 'supplier') {
          const supplierSelect = overlay.querySelector('#nu-supplier');
          if (!supplierSelect || !supplierSelect.value) return toast('Select which supplier this login belongs to', 'error');
          payload.supplierId = supplierSelect.value;
        }
        try {
          await api.createUser(payload);
          toast('Account created!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function renderUsers(content) {
  usersState.list = await api.getUsers();

  const draw = () => {
    const filtered = usersState.roleFilter === 'all' ? usersState.list : usersState.list.filter(u => u.role === usersState.roleFilter);
    const counts = { all: usersState.list.length, admin: 0, staff: 0, customer: 0, delivery: 0, supplier: 0 };
    usersState.list.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });

    content.innerHTML = `
      <div class="tab-row">
        ${['all', 'admin', 'staff', 'customer', 'delivery', 'supplier'].map(r => `<button class="btn ${usersState.roleFilter === r ? 'btn-primary' : 'btn-outline'} btn-sm" data-role-filter="${r}">${r[0].toUpperCase() + r.slice(1)} (${counts[r] || 0})</button>`).join('')}
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Accounts</span>
          <button class="btn btn-primary" id="user-add">+ Add User</button>
        </div>
        ${filtered.length === 0 ? emptyState('🔑', 'No accounts found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Username</th><th>Contact</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(u => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:10px">${avatar(u.username)}<span class="font-medium">${esc(u.username)}</span>${u.id === window.CURRENT_USER_ID ? '<span class="text-muted" style="font-size:11px">(you)</span>' : ''}</div></td>
                  <td class="text-muted" style="font-size:12.5px">${esc(u.phone || '')}${u.phone && u.email ? '<br>' : ''}${esc(u.email || '')}</td>
                  <td>${ROLE_PILL[u.role] || u.role}</td>
                  <td class="text-muted">${dateStr(u.createdAt)}</td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      ${(NEXT_ROLE_ACTIONS[u.role] || []).map(a => `<button class="btn btn-outline btn-sm" data-set-role="${u.id}" data-role="${a.role}">${a.label}</button>`).join('')}
                      <button class="btn btn-danger btn-sm btn-icon" data-delete-user="${u.id}" title="Delete" ${u.id === window.CURRENT_USER_ID ? 'disabled' : ''}>✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
      <p class="text-muted" style="font-size:12.5px;margin-top:12px">New customer accounts sign themselves up from the login page. Staff, admin and delivery-partner accounts are created here by an existing admin — use <strong>+ Add User</strong> above, or promote/demote an existing account's role.</p>`;

    $('#user-add', content).addEventListener('click', () => openCreateUserModal(async () => { usersState.list = await api.getUsers(); draw(); }));
    $$('[data-role-filter]', content).forEach(btn => btn.addEventListener('click', () => { usersState.roleFilter = btn.dataset.roleFilter; draw(); }));
    $$('[data-set-role]', content).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.setRole;
      const role = btn.dataset.role;
      confirmDialog(`Change this user's role to ${role[0].toUpperCase() + role.slice(1)}?`, async () => {
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
      confirmDialog('Delete this account? Their orders and invoices will also be removed from Sales & Billing.', async () => {
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

// ── Settings ─────────────────────────────────────────────────────────────
// Business configuration: identity/tax details used on invoices, plus the
// contact info and hours shown to customers who'd rather call in an order.
async function renderSettings(content) {
  const settings = await api.getSettings();
  const form = { ...settings };

  const draw = () => {
    content.innerHTML = `
      <div class="card" style="max-width:640px">
        <div class="card-header"><span class="card-title">Business Details</span></div>
        <div style="padding:20px">
          <div class="form-row cols-2">
            <div class="form-group"><label class="form-label">Bakery Name</label><input class="form-input" id="set-name" value="${esc(form.bakeryName || '')}" placeholder="Golden Crust Bakery"></div>
            <div class="form-group"><label class="form-label">GST Number</label><input class="form-input" id="set-gst" value="${esc(form.gstNumber || '')}" placeholder="22AAAAA0000A1Z5"></div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="set-phone" value="${esc(form.phone || '')}" placeholder="98765 43210"></div>
            <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="set-email" value="${esc(form.email || '')}" placeholder="orders@bakeandco.com"></div>
          </div>
          <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="set-address" value="${esc(form.address || '')}" placeholder="Shop address"></div>
          <div class="form-row cols-2">
            <div class="form-group"><label class="form-label">Tax Percentage</label><input type="number" class="form-input" id="set-tax" value="${form.taxPercentage}" min="0" max="100" step="0.01" placeholder="5"></div>
            <div class="form-group"><label class="form-label">Currency</label><input class="form-input" id="set-currency" value="${esc(form.currency || '')}" placeholder="INR" maxlength="10" style="text-transform:uppercase"></div>
          </div>
          <div class="form-group"><label class="form-label">Business Hours</label><input class="form-input" id="set-hours" value="${esc(form.businessHours || '')}" placeholder="Mon–Sat, 9:00 AM – 8:00 PM"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
            <button class="btn btn-primary" id="set-save">Save Settings</button>
          </div>
          ${settings.updatedAt ? `<p class="text-muted" style="font-size:12px;margin-top:10px">Last updated ${dateStr(settings.updatedAt)}</p>` : ''}
        </div>
      </div>`;

    $('#set-save', content).addEventListener('click', async () => {
      form.bakeryName = $('#set-name', content).value.trim();
      form.gstNumber = $('#set-gst', content).value.trim();
      form.phone = $('#set-phone', content).value.trim();
      form.email = $('#set-email', content).value.trim();
      form.address = $('#set-address', content).value.trim();
      form.taxPercentage = $('#set-tax', content).value;
      form.currency = $('#set-currency', content).value.trim().toUpperCase() || 'INR';
      form.businessHours = $('#set-hours', content).value.trim();

      if (!form.bakeryName) return toast('Bakery name is required', 'error');
      const tax = Number(form.taxPercentage);
      if (Number.isNaN(tax) || tax < 0 || tax > 100) return toast('Tax percentage must be between 0 and 100', 'error');

      try {
        const updated = await api.updateSettings(form);
        Object.assign(settings, updated);
        Object.assign(form, updated);
        toast('Settings saved!', 'success');
        draw();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  draw();
}



// ── Receipts / Payment Slips ─────────────────────────────────────────────
// How an order was paid, as Razorpay reported it (orders.payment_mode).
function paymentModeLabel(r) {
  if (r.paymentMethod !== 'online') return 'Cash / Offline';
  if (r.paymentCardLast4) return 'Card ending ' + r.paymentCardLast4;
  const modes = { upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay Later' };
  return modes[r.paymentMode] || 'Online';
}

// Builds a self-contained, printable HTML receipt for a paid order/invoice.
// Used both right after an online checkout succeeds, and from the Sales &
// Billing (payment history) page for any settled invoice.
function receiptHtml(r) {
  const items = r.items || [];
  const isOnline = r.paymentMethod === 'online';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt ${esc(r.invoiceNumber || r.orderNumber || '')}</title>
<style>
  body{font-family:'DM Sans',Arial,sans-serif;max-width:420px;margin:24px auto;color:#22201d;padding:0 16px}
  .head{text-align:center;margin-bottom:18px}
  .head .logo{font-size:28px}
  .head .logo-img{width:56px;height:56px;border-radius:50%;object-fit:cover}
  .head h1{font-size:18px;margin:6px 0 2px;font-family:'Playfair Display',serif;white-space:nowrap}
  .head p{font-size:12px;color:#8a8378;margin:2px 0}
  .badge{display:inline-block;margin-top:8px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:${isOnline ? '#eefaf1' : '#fef6ec'};color:${isOnline ? '#1c7a3d' : '#9a5b0f'}}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#8a8378;border-bottom:1px solid #e7e2da;padding:6px 0}
  td{padding:6px 0;border-bottom:1px dashed #e7e2da}
  .right{text-align:right}
  .row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#5c564d}
  .total{display:flex;justify-content:space-between;font-size:16px;font-weight:700;padding-top:10px;margin-top:6px;border-top:2px solid #22201d}
  .foot{text-align:center;margin-top:24px;font-size:11px;color:#8a8378}
  @media print{ body{margin:0 auto} }
</style></head>
<body>
  <div class="head">
    <img class="logo-img" src="assets/logo.jpg" alt="Bakery logo">
    <h1>Golden Crust Bakery</h1>
    <p>${esc(r.storeAddress || '')}</p>
    ${r.storePhone ? `<p>${esc(r.storePhone)}</p>` : ''}
    ${r.storeEmail ? `<p>${esc(r.storeEmail)}</p>` : ''}
    <div class="badge">${isOnline ? '✓ Paid Online' : (r.status === 'paid' ? '✓ Paid' : 'Unpaid')}</div>
  </div>
  <div class="row"><span>Invoice</span><span>${esc(r.invoiceNumber || '—')}</span></div>
  <div class="row"><span>Order</span><span>${esc(r.orderNumber || '—')}</span></div>
  <div class="row"><span>Date</span><span>${new Date((r.createdAt || '').replace(' ', 'T')).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="row"><span>Customer</span><span>${esc(r.customerName || '')}</span></div>
  ${isOnline ? `<div class="row"><span>Transaction ID</span><span>${esc(r.paymentTxnId || '')}</span></div>` : ''}
  <div class="row"><span>Payment method</span><span>${esc(paymentModeLabel(r))}</span></div>
  ${items.length ? `
  <table>
    <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${items.map(i => `<tr><td>${esc(i.name)}</td><td class="right">${i.qty}</td><td class="right">₹${inr(i.qty * i.price)}</td></tr>`).join('')}
      ${r.deliveryCharge > 0 ? `<tr><td>🚚 Delivery charge</td><td class="right">—</td><td class="right">₹${inr(r.deliveryCharge)}</td></tr>` : ''}
      ${r.discountAmount > 0 ? `<tr><td>🏷️ Discount${r.couponCode ? ` (${esc(r.couponCode)})` : ''}</td><td class="right">—</td><td class="right">−₹${inr(r.discountAmount)}</td></tr>` : ''}
    </tbody>
  </table>` : ''}
  <div class="total"><span>Total</span><span>₹${inr(r.amount != null ? r.amount : r.total)}</span></div>
  <div class="foot">Thank you for baking with us! 🥐<br>This is a system-generated receipt.</div>
</body></html>`;
}

function downloadReceipt(r) {
  const html = receiptHtml(r);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Receipt-${r.invoiceNumber || r.orderNumber || 'order'}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printReceipt(r) {
  const win = window.open('', '_blank', 'width=480,height=720');
  if (!win) return toast('Please allow popups to print the receipt', 'error');
  win.document.write(receiptHtml(r));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function openReceiptModal(r, opts = {}) {
  const isOnline = r.paymentMethod === 'online';
  const bodyHtml = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:36px">${isOnline ? '✅' : '🧾'}</div>
      <div style="font-size:17px;font-weight:700;margin-top:6px">${opts.title || (isOnline ? 'Payment Successful' : 'Order Placed')}</div>
      <div class="text-muted" style="font-size:13px;margin-top:2px">${esc(r.invoiceNumber || '')} · ${esc(r.orderNumber || '')}</div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px">
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span class="text-muted">Customer</span><span class="font-medium">${esc(r.customerName || '')}</span></div>
      ${isOnline ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span class="text-muted">Transaction ID</span><span class="font-medium">${esc(r.paymentTxnId || '')}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span class="text-muted">Payment method</span><span class="font-medium">${esc(paymentModeLabel(r))}</span></div>
      ${r.deliveryCharge > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span class="text-muted">🚚 Delivery charge</span><span class="font-medium">₹${inr(r.deliveryCharge)}</span></div>` : ''}
      ${r.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span class="text-muted">🏷️ Discount${r.couponCode ? ` (${esc(r.couponCode)})` : ''}</span><span class="font-medium" style="color:var(--success)">−₹${inr(r.discountAmount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding-top:8px;margin-top:6px;border-top:1px solid var(--border);font-weight:700;font-size:15px"><span>Total Paid</span><span>₹${inr(r.amount != null ? r.amount : r.total)}</span></div>
    </div>`;
  const footerHtml = `<button class="btn btn-outline" data-close-only>Close</button><button class="btn btn-outline" id="receipt-print">🖨 Print</button><button class="btn btn-primary" id="receipt-download">⬇ Download Slip</button>`;

  openModal({
    title: 'Receipt',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-close-only]').addEventListener('click', closeModal);
      overlay.querySelector('#receipt-download').addEventListener('click', () => downloadReceipt(r));
      overlay.querySelector('#receipt-print').addEventListener('click', () => printReceipt(r));
    },
  });
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
            <thead><tr><th>Invoice</th><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${filtered.map(inv => `
                <tr>
                  <td class="font-medium" style="color:var(--brand)">${esc(inv.invoiceNumber)}</td>
                  <td class="text-muted">${esc(inv.orderNumber)}</td>
                  <td>${esc(inv.customerName)}</td>
                  <td class="text-muted">${dateStr(inv.createdAt)}</td>
                  <td class="font-medium">₹${inr(inv.amount)}</td>
                  <td>${inv.paymentMethod === 'online' ? '<span class="pill pill-paid">🔒 Online</span>' : '<span class="pill pill-unpaid">💵 Offline</span>'}</td>
                  <td>${pill(inv.status)}</td>
                  <td>
                    <div style="display:flex;gap:6px;align-items:center">
                      ${inv.status === 'unpaid'
                        ? `<button class="btn btn-outline btn-sm" style="color:var(--success);border-color:var(--success)" data-mark-paid="${inv.id}">Mark Paid</button>`
                        : `<button class="btn btn-outline btn-sm" data-view-receipt="${inv.id}">🧾 Receipt</button>`}
                      <button class="btn btn-danger btn-sm btn-icon" data-delete-invoice="${inv.id}" title="Delete invoice">✕</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $$('[data-inv-filter]', content).forEach(btn => btn.addEventListener('click', () => { billingState.filter = btn.dataset.invFilter; draw(); }));
    $$('[data-view-receipt]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        const r = await api.getReceipt(btn.dataset.viewReceipt);
        openReceiptModal(r, { title: r.paymentMethod === 'online' ? 'Payment Receipt' : 'Order Receipt' });
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-mark-paid]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api.markInvoicePaid(btn.dataset.markPaid);
        toast('Invoice marked as paid!', 'success');
        Object.assign(data, await api.getInvoices());
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-delete-invoice]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Delete this invoice from Sales & Billing?', async () => {
        try {
          await api.deleteInvoice(btn.dataset.deleteInvoice);
          toast('Invoice deleted', 'success');
          Object.assign(data, await api.getInvoices());
          draw();
        } catch (err) { toast(err.message, 'error'); }
      });
    }));
  };

  draw();
}

// ── Reports Dashboard ────────────────────────────────────────────────────
function fmtDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const REPORT_TABS = [
  { key: 'daily', label: '📅 Daily Sales' },
  { key: 'monthly', label: '🗓️ Monthly Sales' },
  { key: 'inventory', label: '📦 Inventory' },
  { key: 'production', label: '🏭 Production' },
  { key: 'purchase', label: '🚚 Purchase' },
  { key: 'profit', label: '📈 Profit' },
];

const reportsState = { tab: 'daily', date: new Date().toISOString().slice(0, 10), month: new Date().toISOString().slice(0, 7),
  from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };

function reportTabsHtml() {
  return `<div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
    ${REPORT_TABS.map(t => `<button class="btn btn-sm ${reportsState.tab === t.key ? 'btn-primary' : 'btn-outline'}" data-report-tab="${t.key}">${t.label}</button>`).join('')}
  </div>`;
}

async function renderReports(content) {
  content.innerHTML = `${reportTabsHtml()}<div id="report-body"></div>`;
  $$('[data-report-tab]', content).forEach(btn => btn.addEventListener('click', () => {
    reportsState.tab = btn.dataset.reportTab;
    renderReports(content);
  }));
  const body = $('#report-body', content);
  body.innerHTML = `<div class="text-muted" style="padding:40px 0;text-align:center">Loading report…</div>`;
  try {
    if (reportsState.tab === 'daily') await drawDailySalesReport(body);
    else if (reportsState.tab === 'monthly') await drawMonthlySalesReport(body);
    else if (reportsState.tab === 'inventory') await drawInventoryReport(body);
    else if (reportsState.tab === 'production') await drawProductionReport(body);
    else if (reportsState.tab === 'purchase') await drawPurchaseReport(body);
    else if (reportsState.tab === 'profit') await drawProfitReport(body);
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>${esc(err.message)}</div></div>`;
  }
}

function reportDateBar(inputsHtml) {
  return `<div class="card" style="padding:14px 16px;margin-bottom:18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">${inputsHtml}</div>`;
}

// ── Daily Sales ───────────────────────────────────────────────────────────
async function drawDailySalesReport(body) {
  const data = await api.getReport('daily', { date: reportsState.date });
  const maxHour = Math.max(...data.hourly, 1);
  body.innerHTML = `
    ${reportDateBar(`
      <label class="form-label" style="margin:0">Date</label>
      <input type="date" class="form-input" style="max-width:180px" id="daily-date" value="${data.date}" max="${new Date().toISOString().slice(0, 10)}">
    `)}
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">💰 Total Sales</div>
        <div class="metric-value" style="color:var(--success,#16a34a)">₹${inr(data.totalSales)}</div>
        <div class="metric-change">${data.orderCount} order${data.orderCount === 1 ? '' : 's'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">🧾 Avg Order Value</div>
        <div class="metric-value">₹${inr(data.avgOrderValue)}</div>
        <div class="metric-change">on ${fmtDayLabel(data.date)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">✅ Delivered</div>
        <div class="metric-value">${data.statusCounts.delivered || 0}</div>
        <div class="metric-change">of ${data.orderCount} order${data.orderCount === 1 ? '' : 's'}</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px;padding:20px">
      <div class="card-title" style="margin-bottom:14px">Sales by hour</div>
      ${data.orderCount === 0 ? emptyState('🧾', 'No orders on this day') : `
      <div style="display:flex;align-items:flex-end;gap:3px;height:140px;padding:0 4px">
        ${data.hourly.map((v, h) => `<div title="${h}:00 — ₹${inr(v)}" style="flex:1;background:var(--brand);opacity:${v > 0 ? 0.85 : 0.15};border-radius:2px 2px 0 0;height:${Math.max(2, (v / maxHour) * 130)}px"></div>`).join('')}
      </div>
      <div class="text-muted" style="font-size:11px;margin-top:6px">12 AM → 11 PM</div>`}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start" class="reports-2col">
      <div class="card">
        <div class="card-header"><span class="card-title">🍰 Top Items</span></div>
        ${data.topItems.length === 0 ? emptyState('🍰', 'No items sold') : `
        <div class="table-wrap"><table>
          <thead><tr><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead>
          <tbody>${data.topItems.map(i => `<tr><td class="font-medium">${esc(i.name)}</td><td class="text-muted">${i.qty}</td><td class="font-medium">₹${inr(i.revenue)}</td></tr>`).join('')}</tbody>
        </table></div>`}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🧾 Orders</span></div>
        ${data.sales.length === 0 ? emptyState('🧾', 'No orders on this day') : `
        <div class="table-wrap"><table>
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>${data.sales.map(s => `<tr><td class="font-medium" style="color:var(--brand)">${esc(s.orderNumber)}</td><td>${esc(s.customerName)}</td><td>${pill(s.status)}</td><td class="font-medium">₹${inr(s.total)}</td></tr>`).join('')}</tbody>
        </table></div>`}
      </div>
    </div>`;
  $('#daily-date', body).addEventListener('change', (e) => {
    reportsState.date = e.target.value;
    drawDailySalesReport(body);
  });
}

// ── Monthly Sales ─────────────────────────────────────────────────────────
async function drawMonthlySalesReport(body) {
  const data = await api.getReport('monthly', { month: reportsState.month });
  const maxDay = Math.max(...data.daily.map(d => d.sales), 1);
  const changeColor = data.changePct == null ? 'var(--text-tertiary)' : (data.changePct >= 0 ? 'var(--success,#16a34a)' : 'var(--danger,#dc2626)');
  body.innerHTML = `
    ${reportDateBar(`
      <label class="form-label" style="margin:0">Month</label>
      <input type="month" class="form-input" style="max-width:180px" id="monthly-month" value="${data.month}" max="${new Date().toISOString().slice(0, 7)}">
    `)}
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">💰 Total Sales</div>
        <div class="metric-value" style="color:var(--success,#16a34a)">₹${inr(data.totalSales)}</div>
        <div class="metric-change">${data.orderCount} order${data.orderCount === 1 ? '' : 's'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">🧾 Avg Order Value</div>
        <div class="metric-value">₹${inr(data.avgOrderValue)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">📊 vs Previous Month</div>
        <div class="metric-value" style="color:${changeColor}">${data.changePct == null ? '—' : (data.changePct >= 0 ? '+' : '') + data.changePct + '%'}</div>
        <div class="metric-change">Prev: ₹${inr(data.prevMonthTotal)}</div>
      </div>
    </div>
    <div class="card" style="padding:20px">
      <div class="card-title" style="margin-bottom:14px">Daily sales — ${new Date(data.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>
      ${data.orderCount === 0 ? emptyState('🧾', 'No orders this month') : `
      <div style="display:flex;align-items:flex-end;gap:2px;height:150px;padding:0 4px;overflow-x:auto">
        ${data.daily.map(d => `<div title="${d.date} — ₹${inr(d.sales)} (${d.orders} orders)" style="flex:1;min-width:6px;background:var(--brand);opacity:${d.sales > 0 ? 0.85 : 0.15};border-radius:2px 2px 0 0;height:${Math.max(2, (d.sales / maxDay) * 140)}px"></div>`).join('')}
      </div>
      <div class="text-muted" style="font-size:11px;margin-top:6px">Day 1 → ${data.daily.length}</div>`}
    </div>`;
  $('#monthly-month', body).addEventListener('change', (e) => {
    reportsState.month = e.target.value;
    drawMonthlySalesReport(body);
  });
}

// ── Inventory Report ─────────────────────────────────────────────────────
async function drawInventoryReport(body) {
  const data = await api.getReport('inventory');
  const statusMeta = { ok: { label: 'In Stock', cls: 'good' }, low: { label: 'Low Stock', cls: 'medium' }, out: { label: 'Out of Stock', cls: 'critical' } };
  body.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">📦 Total Inventory Value</div>
        <div class="metric-value">₹${inr(data.totalValue)}</div>
        <div class="metric-change">${data.itemCount} item${data.itemCount === 1 ? '' : 's'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">⚠️ Low Stock</div>
        <div class="metric-value" style="color:#b45309">${data.lowStockCount}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">🚫 Out of Stock</div>
        <div class="metric-value" style="color:var(--danger,#dc2626)">${data.outOfStockCount}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Inventory Valuation</span></div>
      ${data.items.length === 0 ? emptyState('📦', 'No inventory items yet') : `
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Qty</th><th>Cost/unit</th><th>Value</th><th>Supplier</th><th>Status</th></tr></thead>
        <tbody>${data.items.map(i => `
          <tr>
            <td class="font-medium">${esc(i.name)}</td>
            <td class="text-muted">${i.quantity} ${esc(i.unit)}</td>
            <td class="text-muted">₹${inr(i.costPerUnit)}</td>
            <td class="font-medium">₹${inr(i.value)}</td>
            <td class="text-muted">${esc(i.supplierName || '—')}</td>
            <td><span class="pill pill-${statusMeta[i.status].cls}">${statusMeta[i.status].label}</span></td>
          </tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3" class="font-medium">Total value</td><td class="font-medium" colspan="3">₹${inr(data.totalValue)}</td></tr></tfoot>
      </table></div>`}
    </div>`;
}

// ── Production Report ────────────────────────────────────────────────────
function fromToBarHtml(prefix) {
  return `
    <label class="form-label" style="margin:0">From</label>
    <input type="date" class="form-input" style="max-width:170px" id="${prefix}-from" value="${reportsState.from}" max="${reportsState.to}">
    <label class="form-label" style="margin:0">To</label>
    <input type="date" class="form-input" style="max-width:170px" id="${prefix}-to" value="${reportsState.to}" max="${new Date().toISOString().slice(0, 10)}">`;
}

async function drawProductionReport(body) {
  const data = await api.getReport('production', { from: reportsState.from, to: reportsState.to });
  body.innerHTML = `
    ${reportDateBar(fromToBarHtml('prod'))}
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">🏭 Completed Batches</div>
        <div class="metric-value">${data.statusCounts.completed || 0}</div>
        <div class="metric-change">of ${data.batchCount} total</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">📦 Output Produced</div>
        <div class="metric-value">${inr(data.totalOutputQty)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">💸 Production Cost</div>
        <div class="metric-value" style="color:var(--danger,#dc2626)">₹${inr(data.totalCost)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start" class="reports-2col">
      <div class="card">
        <div class="card-header"><span class="card-title">👩‍🍳 Cost by Recipe</span></div>
        ${data.byRecipe.length === 0 ? emptyState('👩‍🍳', 'No completed batches in range') : `
        <div class="table-wrap"><table>
          <thead><tr><th>Recipe</th><th>Batches</th><th>Qty</th><th>Cost</th></tr></thead>
          <tbody>${data.byRecipe.map(r => `<tr><td class="font-medium">${esc(r.recipeName)}</td><td class="text-muted">${r.batches}</td><td class="text-muted">${inr(r.qty)}</td><td class="font-medium">₹${inr(r.cost)}</td></tr>`).join('')}</tbody>
        </table></div>`}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🗂️ Batches</span></div>
        ${data.batches.length === 0 ? emptyState('🗂️', 'No batches in range') : `
        <div class="table-wrap"><table>
          <thead><tr><th>Batch</th><th>Recipe</th><th>Status</th><th>Cost</th></tr></thead>
          <tbody>${data.batches.map(b => `<tr><td class="font-medium">${esc(b.batchNumber)}</td><td>${esc(b.recipeName)}</td><td>${pbPill(b.status)}</td><td class="text-muted">₹${inr(b.totalCost)}</td></tr>`).join('')}</tbody>
        </table></div>`}
      </div>
    </div>`;
  $('#prod-from', body).addEventListener('change', (e) => { reportsState.from = e.target.value; drawProductionReport(body); });
  $('#prod-to', body).addEventListener('change', (e) => { reportsState.to = e.target.value; drawProductionReport(body); });
}

// ── Purchase Report ───────────────────────────────────────────────────────
async function drawPurchaseReport(body) {
  const data = await api.getReport('purchase', { from: reportsState.from, to: reportsState.to });
  body.innerHTML = `
    ${reportDateBar(fromToBarHtml('pur'))}
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">🚚 Purchase Orders</div>
        <div class="metric-value">${data.poCount}</div>
        <div class="metric-change">${data.statusCounts.received || 0} received</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">💰 Total PO Amount</div>
        <div class="metric-value">₹${inr(data.totalPoAmount)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">📥 Received & Spent</div>
        <div class="metric-value" style="color:var(--danger,#dc2626)">₹${inr(data.totalReceivedAmount)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start" class="reports-2col">
      <div class="card">
        <div class="card-header"><span class="card-title">🏢 Spend by Supplier</span></div>
        ${data.bySupplier.length === 0 ? emptyState('🏢', 'No received orders in range') : `
        <div class="table-wrap"><table>
          <thead><tr><th>Supplier</th><th>Orders</th><th>Amount</th></tr></thead>
          <tbody>${data.bySupplier.map(s => `<tr><td class="font-medium">${esc(s.supplierName)}</td><td class="text-muted">${s.orders}</td><td class="font-medium">₹${inr(s.amount)}</td></tr>`).join('')}</tbody>
        </table></div>`}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Purchase Orders</span></div>
        ${data.purchaseOrders.length === 0 ? emptyState('📋', 'No purchase orders in range') : `
        <div class="table-wrap"><table>
          <thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>${data.purchaseOrders.map(p => `<tr><td class="font-medium" style="color:var(--brand)">${esc(p.poNumber)}</td><td>${esc(p.supplierName)}</td><td>${poPill(p.status)}</td><td class="text-muted">₹${inr(p.totalAmount)}</td></tr>`).join('')}</tbody>
        </table></div>`}
      </div>
    </div>`;
  $('#pur-from', body).addEventListener('change', (e) => { reportsState.from = e.target.value; drawPurchaseReport(body); });
  $('#pur-to', body).addEventListener('change', (e) => { reportsState.to = e.target.value; drawPurchaseReport(body); });
}

// ── Profit Report ─────────────────────────────────────────────────────────
async function drawProfitReport(body) {
  const data = await api.getReport('profit', { from: reportsState.from, to: reportsState.to });
  const maxAbs = Math.max(...data.daily.map(d => Math.max(d.sales, d.cost)), 1);
  body.innerHTML = `
    ${reportDateBar(fromToBarHtml('profit'))}
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">💰 Net Revenue</div>
        <div class="metric-value" style="color:var(--success,#16a34a)">₹${inr(data.netRevenue)}</div>
        <div class="metric-change">${data.orderCount} orders · refunds ₹${inr(data.totalRefunded)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">📥 Total Cost</div>
        <div class="metric-value" style="color:var(--danger,#dc2626)">₹${inr(data.totalCost)}</div>
        <div class="metric-change">Import ₹${inr(data.totalImportSpend)} · Production ₹${inr(data.totalProductionCost)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">📊 Profit</div>
        <div class="metric-value" style="color:${data.profit >= 0 ? 'var(--success,#16a34a)' : 'var(--danger,#dc2626)'}">₹${inr(data.profit)}</div>
        <div class="metric-change">${data.marginPct == null ? '—' : `${data.marginPct}% margin`}</div>
      </div>
    </div>
    <div class="card" style="padding:20px">
      <div class="card-title" style="margin-bottom:14px">Sales vs Cost by day</div>
      ${data.daily.every(d => d.sales === 0 && d.cost === 0) ? emptyState('📊', 'No activity in range') : `
      <div style="display:flex;align-items:flex-end;gap:3px;height:150px;padding:0 4px;overflow-x:auto">
        ${data.daily.map(d => `
          <div style="flex:1;min-width:10px;display:flex;align-items:flex-end;gap:1px;height:100%">
            <div title="Sales ₹${inr(d.sales)}" style="flex:1;background:var(--success,#16a34a);opacity:0.85;border-radius:2px 2px 0 0;height:${Math.max(1, (d.sales / maxAbs) * 140)}px"></div>
            <div title="Cost ₹${inr(d.cost)}" style="flex:1;background:var(--danger,#dc2626);opacity:0.75;border-radius:2px 2px 0 0;height:${Math.max(1, (d.cost / maxAbs) * 140)}px"></div>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:12px" class="text-muted">
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--success,#16a34a);opacity:0.85;border-radius:2px;margin-right:5px"></span>Sales</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--danger,#dc2626);opacity:0.75;border-radius:2px;margin-right:5px"></span>Cost</span>
      </div>`}
    </div>`;
  $('#profit-from', body).addEventListener('change', (e) => { reportsState.from = e.target.value; drawProfitReport(body); });
  $('#profit-to', body).addEventListener('change', (e) => { reportsState.to = e.target.value; drawProfitReport(body); });
}

// ── Returns & Refunds (admin/staff) ─────────────────────────────────────
const RETURN_STATUSES = ['all', 'requested', 'approved', 'pickup_assigned', 'picked_up', 'received', 'rejected', 'refunded'];
const returnsState = { activeTab: 'all', items: [] };

function openRefundModal(ret, onDone) {
  openModal({
    title: `Refund ${ret.returnNumber}`,
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-size:13px;color:var(--text-secondary)">Send ₹${inr(ret.refundAmount)} to:</div>
        <div style="padding:10px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--border);font-size:13px;line-height:1.6">
          <div><b>${esc(ret.bankAccountHolder)}</b></div>
          <div>A/C: ${esc(ret.bankAccountNumber)}</div>
          <div>IFSC: ${esc(ret.bankIfsc)}${ret.bankName ? ' · ' + esc(ret.bankName) : ''}</div>
        </div>
        <label class="form-label">Bank transfer reference</label>
        <input class="form-input" id="refund-txn" placeholder="e.g. NEFT2026070312345">
        <div id="refund-error"></div>
      </div>`,
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" data-confirm-refund>💸 Mark Refunded</button>`,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('[data-confirm-refund]').addEventListener('click', async () => {
        const errBox = overlay.querySelector('#refund-error');
        const txnId = overlay.querySelector('#refund-txn').value.trim();
        if (!txnId) { errBox.innerHTML = `<div style="margin-top:4px;font-size:12.5px;color:#b91c1c">Enter the transfer reference.</div>`; return; }
        try {
          await api.updateReturnStatus(ret.id, { status: 'refunded', refundTxnId: txnId });
          closeModal();
          toast('Refund recorded', 'success');
          onDone();
        } catch (err) {
          errBox.innerHTML = `<div style="margin-top:4px;font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
        }
      });
    },
  });
}

async function openReturnPickupPartnerModal(ret, onSaved) {
  let partners = [];
  try { partners = await api.getDeliveryPartners(); } catch (e) { /* fall back to free text only */ }
  const reassigning = ret.status === 'pickup_assigned';

  const bodyHtml = `
    <p class="text-muted" style="font-size:13px;margin-bottom:14px">${reassigning ? `Currently assigned to <strong>${esc(ret.pickupPartnerName)}</strong>. Choose a different partner below to reassign — a new pickup OTP will be issued.` : `Assign who will collect the damaged product for return <strong>${esc(ret.returnNumber)}</strong>. They'll be notified and must confirm pickup with an OTP.`}</p>
    ${partners.length > 0 ? `
    <div class="form-group">
      <label class="form-label">Delivery partner account</label>
      <select class="form-input" id="rp-account">
        <option value="">— Enter name/phone manually instead —</option>
        ${partners.map(p => `<option value="${p.id}" ${ret.pickupPartnerUserId === p.id ? 'selected' : ''}>${esc(p.username)}${p.phone ? ` (${esc(p.phone)})` : ''}</option>`).join('')}
      </select>
    </div>` : `<p class="text-muted" style="font-size:12.5px;margin-bottom:10px">No delivery partner accounts yet — create one from the Users page, or enter details manually below.</p>`}
    <div id="rp-manual-fields" style="display:${partners.length > 0 && ret.pickupPartnerUserId ? 'none' : 'block'}">
      <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="rp-name" value="${esc(ret.pickupPartnerName || '')}" placeholder="e.g. Ravi Kumar"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="rp-phone" value="${esc(ret.pickupPartnerPhone || '')}" placeholder="98XXXXXXXX"></div>
    </div>
    <div id="rp-error"></div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="rp-save">${reassigning ? 'Reassign' : 'Assign'}</button>`;

  openModal({
    title: reassigning ? 'Reassign Pickup Partner' : 'Assign Pickup Partner',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      const accountSelect = overlay.querySelector('#rp-account');
      const manualFields = overlay.querySelector('#rp-manual-fields');
      if (accountSelect) accountSelect.addEventListener('change', () => {
        manualFields.style.display = accountSelect.value ? 'none' : 'block';
      });
      overlay.querySelector('#rp-save').addEventListener('click', async () => {
        const errBox = overlay.querySelector('#rp-error');
        const partnerId = accountSelect ? accountSelect.value : '';
        const name = overlay.querySelector('#rp-name') ? overlay.querySelector('#rp-name').value.trim() : '';
        const phone = overlay.querySelector('#rp-phone') ? overlay.querySelector('#rp-phone').value.trim() : '';
        try {
          await api.assignReturnPickupPartner(ret.id, partnerId ? { partnerId } : { name, phone });
          toast(reassigning ? 'Pickup reassigned!' : 'Pickup partner assigned!', 'success');
          closeModal();
          onSaved();
        } catch (err) {
          errBox.innerHTML = `<div style="margin-top:4px;font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
        }
      });
    },
  });
}

async function renderReturns(content) {
  const isDelivery = window.CURRENT_ROLE === 'delivery';
  returnsState.items = await api.getReturns();

  const draw = () => {
    const filtered = returnsState.activeTab === 'all' ? returnsState.items : returnsState.items.filter(r => r.status === returnsState.activeTab);
    const counts = RETURN_STATUSES.reduce((acc, s) => { acc[s] = s === 'all' ? returnsState.items.length : returnsState.items.filter(r => r.status === s).length; return acc; }, {});

    content.innerHTML = `
      ${isDelivery ? `<div class="text-muted" style="font-size:13px;margin-bottom:12px">🚚 Showing return pickups assigned to you.</div>` : ''}
      <div class="tab-row">
        ${RETURN_STATUSES.map(s => `<button class="btn ${returnsState.activeTab === s ? 'btn-primary' : 'btn-outline'} btn-sm" data-tab="${s}">${s === 'all' ? 'All' : (RETURN_STATUS_STYLE[s]?.label || s)} (${counts[s]})</button>`).join('')}
      </div>
      <div class="card">
        ${filtered.length === 0 ? emptyState('↩️', isDelivery ? 'No pickups assigned to you' : 'No return requests found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Return #</th><th>Order</th><th>Customer</th><th>Reason</th><th>Amount</th>${isDelivery ? '' : '<th>Bank Details</th>'}<th>Status</th><th>Requested</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(r => `
                <tr>
                  <td class="font-medium">${esc(r.returnNumber)}</td>
                  <td>${esc(r.orderNumber)}</td>
                  <td>${esc(r.customerName)}</td>
                  <td style="max-width:200px">
                    <div>${esc(RETURN_REASON_LABELS[r.reason] || r.reason)}</div>
                    ${r.items && r.items.length ? `<div class="text-muted" style="font-size:11.5px">${r.items.map(it => `${it.qty}× ${esc(it.name)}`).join(', ')}</div>` : ''}
                    ${r.description ? `<div class="text-muted" style="font-size:11.5px">${esc(r.description)}</div>` : ''}
                  </td>
                  <td class="font-medium">₹${inr(r.refundAmount)}</td>
                  ${isDelivery ? '' : `<td style="font-size:11.5px;color:var(--text-secondary)">
                    ${esc(r.bankAccountHolder)}<br>${esc(r.bankAccountNumber)} · ${esc(r.bankIfsc)}
                  </td>`}
                  <td><span class="pill" style="background:${(RETURN_STATUS_STYLE[r.status]||{}).bg};color:${(RETURN_STATUS_STYLE[r.status]||{}).text};border:1px solid ${(RETURN_STATUS_STYLE[r.status]||{}).border}">${(RETURN_STATUS_STYLE[r.status]||{}).label || r.status}</span></td>
                  <td class="text-muted">${dateStr(r.requestedAt)}</td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      ${isDelivery
                        ? (r.status === 'pickup_assigned' ? `<button class="btn btn-primary btn-sm" data-confirm-pickup="${r.id}">✅ Confirm Pickup</button>` : `<span class="text-muted text-sm">${r.status === 'picked_up' || r.status === 'received' || r.status === 'refunded' ? '✓ Picked up' : 'Not ready yet'}</span>`)
                        : `
                        ${r.status === 'requested' ? `
                          <button class="btn btn-primary btn-sm" data-approve-return="${r.id}">Accept</button>
                          <button class="btn btn-danger btn-sm" data-reject-return="${r.id}">Reject</button>` : ''}
                        ${(r.status === 'approved' || r.status === 'pickup_assigned') ? `<button class="btn btn-outline btn-sm" data-assign-pickup="${r.id}">🚚${r.status === 'pickup_assigned' ? ' Reassign' : ' Assign Pickup'}</button>` : ''}
                        ${r.status === 'picked_up' ? `<button class="btn btn-primary btn-sm" data-mark-received="${r.id}">✅ Mark Received</button>` : ''}
                        ${r.status === 'received' ? `<button class="btn btn-primary btn-sm" data-refund-return="${r.id}">💸 Refund</button>` : ''}
                      `}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    $$('[data-tab]', content).forEach(btn => btn.addEventListener('click', () => { returnsState.activeTab = btn.dataset.tab; draw(); }));
    $$('[data-approve-return]', content).forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api.updateReturnStatus(btn.dataset.approveReturn, { status: 'approved' });
        toast('Return accepted', 'success');
        returnsState.items = await api.getReturns();
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-reject-return]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Reject this return request?', async () => {
        try {
          await api.updateReturnStatus(btn.dataset.rejectReturn, { status: 'rejected' });
          toast('Return rejected', 'success');
          returnsState.items = await api.getReturns();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      }, { confirmLabel: 'Reject', confirmClass: 'btn-danger' });
    }));
    $$('[data-assign-pickup]', content).forEach(btn => btn.addEventListener('click', () => {
      const ret = returnsState.items.find(x => x.id === btn.dataset.assignPickup);
      openReturnPickupPartnerModal(ret, async () => { returnsState.items = await api.getReturns(); draw(); });
    }));
    $$('[data-mark-received]', content).forEach(btn => btn.addEventListener('click', () => {
      confirmDialog('Confirm the returned product has arrived back at the bakery?', async () => {
        try {
          await api.updateReturnStatus(btn.dataset.markReceived, { status: 'received' });
          toast('Marked as received — ready to refund.', 'success');
          returnsState.items = await api.getReturns();
          draw();
        } catch (err) { toast(err.message, 'error'); }
      }, { confirmLabel: 'Mark Received', confirmClass: 'btn-primary' });
    }));
    $$('[data-refund-return]', content).forEach(btn => btn.addEventListener('click', () => {
      const ret = returnsState.items.find(x => x.id === btn.dataset.refundReturn);
      openRefundModal(ret, async () => { returnsState.items = await api.getReturns(); draw(); });
    }));
    $$('[data-confirm-pickup]', content).forEach(btn => btn.addEventListener('click', () => {
      const r = returnsState.items.find(x => x.id === btn.dataset.confirmPickup);
      otpConfirmModal(r ? r.orderNumber : '', async (otp) => {
        await api.updateReturnStatus(btn.dataset.confirmPickup, { status: 'picked_up', otp });
        toast('Pickup confirmed — refund will follow shortly.', 'success');
        returnsState.items = await api.getReturns();
        draw();
      }, () => api.regenerateReturnOtp(btn.dataset.confirmPickup), (r?.pickupOtpAttempts || 0) >= OTP_MAX_ATTEMPTS);
    }));
  };

  draw();
}


// ── Track Order ──────────────────────────────────────────────────────────
const STEP_ICONS = {
  pending: { icon: '📋', desc: 'Your order has been received and is queued.' },
  baking: { icon: '🔥', desc: 'Our bakers are working on your order right now!' },
  ready: { icon: '✅', desc: 'Your order is ready and waiting for pickup / delivery.' },
  out_for_delivery: { icon: '🚚', desc: 'Your order is on the way! Our delivery partner has left the shop.' },
  delivered: { icon: '🎉', desc: 'Order delivered. Enjoy every bite!' },
};

// Renders a flat list of step nodes (order-status steps and, when present,
// return/refund steps appended after them) as one continuous vertical
// timeline. Each entry is either a step node
// { icon, label, desc, completed, active, danger, extraHtml } or a divider
// node { divider: 'Section Title' } used to separate the return/refund
// steps from the order steps without breaking the connecting line.
function renderProgressSteps(nodes) {
  const lastStepIdx = (() => {
    for (let i = nodes.length - 1; i >= 0; i--) if (!nodes[i].divider) return i;
    return -1;
  })();
  return `<div style="padding:8px 0 0">
    ${nodes.map((node, idx) => {
      if (node.divider) {
        return `<div style="margin:4px 0 12px 52px;font-size:11px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em">${esc(node.divider)}</div>`;
      }
      const isLast = idx === lastStepIdx;
      const danger = !!node.danger;
      const dotBg = danger ? '#fef2f2' : (node.completed ? (node.active ? 'var(--accent,#4CAF50)' : '#e8f5e9') : '#f5f5f5');
      const dotBorder = danger ? '2px solid #f87171' : (node.active ? '2px solid var(--accent,#4CAF50)' : node.completed ? '2px solid #a5d6a7' : '2px solid var(--border)');
      const lineBg = danger ? '#f87171' : (node.completed ? 'var(--accent,#4CAF50)' : 'var(--border)');
      return `
      <div style="display:flex;gap:16px">
        <div style="display:flex;flex-direction:column;align-items:center;width:36px">
          <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;
            background:${dotBg};
            border:${dotBorder};
            box-shadow:${node.active && !danger ? '0 0 0 4px rgba(76,175,80,0.15)' : 'none'};">
            ${node.icon || ''}
          </div>
          ${!isLast ? `<div style="width:2px;flex:1;min-height:24px;background:${lineBg};margin:4px 0"></div>` : ''}
        </div>
        <div style="padding-bottom:${isLast ? 0 : 24}px;padding-top:4px">
          <div style="font-weight:${node.active ? 700 : 600};font-size:15px;color:${danger ? '#b91c1c' : (node.completed ? 'var(--text)' : 'var(--text-tertiary)')}">
            ${esc(node.label)}
            ${node.active ? `<span style="margin-left:8px;font-size:11px;font-weight:600;background:${danger ? '#dc2626' : 'var(--accent,#4CAF50)'};color:#fff;border-radius:999px;padding:2px 8px;vertical-align:middle">${danger ? 'REJECTED' : 'CURRENT'}</span>` : ''}
          </div>
          ${node.active && node.desc ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${esc(node.desc)}</div>` : ''}
          ${node.extraHtml || ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// Builds the order-status portion of the timeline as step nodes for
// renderProgressSteps().
function orderProgressSteps(timeline) {
  return timeline.map(step => {
    const meta = STEP_ICONS[step.step] || {};
    return { icon: meta.icon, label: step.label, desc: meta.desc, completed: step.completed, active: step.active };
  });
}

const RETURN_STEP_META = {
  requested: { icon: '🧾', label: 'Damage Return Requested', desc: 'We\'ve received your damage/return request and it\'s awaiting review.' },
  accepted: { icon: '👍', label: 'Return Accepted', desc: 'Your return request has been accepted.' },
  picked_up: { icon: '📦', label: 'Product Picked Up', desc: 'The delivery partner has collected the damaged product from you.' },
  received: { icon: '✅', label: 'Product Received', desc: 'We\'ve confirmed the product is back with us.' },
  refunded: { icon: '💸', label: 'Refund Processed', desc: 'Refunded to your bank account. Please allow 1–3 business days for it to reflect.' },
};

// Builds the return/refund portion of the timeline as step nodes for
// renderProgressSteps(), continuing on from the order-status steps. The
// pickup OTP is surfaced only on the "Return Accepted" step, and only while
// a pickup partner has actually been assigned and hasn't yet collected the
// item — matching the moment the partner needs to ask the customer for it.
function returnProgressSteps(info) {
  if (!info) return [];
  if (info.status === 'rejected') {
    return [
      { divider: 'Return & Refund' },
      { icon: RETURN_STEP_META.requested.icon, label: RETURN_STEP_META.requested.label, completed: true, active: false },
      { icon: '✕', label: 'Return Rejected', completed: true, active: true, danger: true,
        extraHtml: info.adminNotes ? `<div style="font-size:13px;color:#7f1d1d;margin-top:4px">Reason: ${esc(info.adminNotes)}</div>` : '' },
    ];
  }
  const order = ['requested', 'accepted', 'picked_up', 'received', 'refunded'];
  const statusIdx = { requested: 0, approved: 1, pickup_assigned: 1, picked_up: 2, received: 3, refunded: 4 }[info.status];
  const steps = order.map((key, idx) => {
    const completed = idx <= statusIdx;
    const active = idx === statusIdx;
    const meta = RETURN_STEP_META[key];
    let extraHtml = '';
    if (key === 'accepted' && active && info.status === 'pickup_assigned') {
      extraHtml = `
        ${info.pickupPartnerName ? `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:6px">🚚 ${esc(info.pickupPartnerName)}${info.pickupPartnerPhone ? ` · ${esc(info.pickupPartnerPhone)}` : ''} will collect the item.</div>` : ''}
        ${info.pickupOtp ? `
        <div style="text-align:center;margin-top:10px;padding:10px;border-radius:8px;background:#fff8e1;border:1px solid #ffe082">
          <div style="font-size:10px;font-weight:700;color:#8a6d00;text-transform:uppercase;letter-spacing:0.05em">🔐 Pickup OTP</div>
          <div style="font-size:22px;font-weight:800;letter-spacing:6px;color:#6b5300;margin-top:4px">${esc(info.pickupOtp)}</div>
          <div style="font-size:11.5px;color:#8a6d00;margin-top:4px">Share this with the delivery partner when they arrive to collect it.</div>
        </div>` : ''}`;
    } else if (key === 'accepted' && completed && !active && info.pickupPartnerName) {
      extraHtml = `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px">🚚 Collected by ${esc(info.pickupPartnerName)}</div>`;
    } else if (key === 'refunded' && active && info.refundTxnId) {
      extraHtml = `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px">Ref: ${esc(info.refundTxnId)}</div>`;
    }
    return { icon: meta.icon, label: meta.label, desc: meta.desc, completed, active, extraHtml };
  });
  return [{ divider: 'Return & Refund' }, ...steps];
}

const RETURN_REASON_LABELS = { damaged: 'Product damaged', wrong_item: 'Wrong item received', quality_issue: 'Quality issue', missing_item: 'Item(s) missing', other: 'Other' };
const RETURN_STATUS_STYLE = {
  requested: { bg: '#fff8e1', border: '#ffe082', text: '#8a6d00', label: 'Return Requested', icon: '⏳' },
  approved: { bg: '#e3f2fd', border: '#90caf9', text: '#0d47a1', label: 'Return Accepted', icon: '👍' },
  pickup_assigned: { bg: '#ede7f6', border: '#b39ddb', text: '#4527a0', label: 'Product Pickup Scheduled', icon: '🚚' },
  picked_up: { bg: '#e0f2f1', border: '#80cbc4', text: '#00695c', label: 'Product Picked Up', icon: '📦' },
  received: { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20', label: 'Product Received', icon: '✅' },
  rejected: { bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d', label: 'Return Rejected', icon: '✕' },
  refunded: { bg: '#eefaf1', border: '#bfe8c9', text: '#0f5c2a', label: 'Refunded', icon: '💸' },
};
// Compact status chip only — the step-by-step detail (pickup partner name,
// pickup OTP, refund note) now lives in the Order Progress timeline instead
// of being duplicated here, so this card just orients the customer and
// points them at the progress panel.
function returnInfoHtml(info) {
  const s = RETURN_STATUS_STYLE[info.status] || RETURN_STATUS_STYLE.requested;
  return `
  <div style="margin-bottom:20px;padding:14px 16px;border-radius:10px;background:${s.bg};border:1px solid ${s.border}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;font-weight:700;color:${s.text};text-transform:uppercase;letter-spacing:0.05em">${s.icon} ${s.label} · ${esc(info.returnNumber)}</div>
        <div style="font-size:13px;color:${s.text};margin-top:4px">${esc(RETURN_REASON_LABELS[info.reason] || info.reason)}${info.description ? ' — ' + esc(info.description) : ''}</div>
        ${info.items && info.items.length ? `<div style="font-size:12px;color:${s.text};margin-top:4px;opacity:0.9">${info.items.map(it => `${it.qty}× ${esc(it.name)}`).join(', ')}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:13px;font-weight:700;color:${s.text}">₹${inr(info.refundAmount)}</div>
    </div>
    <div style="font-size:11.5px;color:${s.text};margin-top:8px;opacity:0.85">See Order Progress for the full return &amp; refund timeline${info.status === 'pickup_assigned' && info.pickupOtp ? ', including the pickup OTP' : ''}.</div>
  </div>`;
}

function openReturnRequestModal(orderNumber, items, onDone) {
  items = items || [];
  // Each item's quantity is independently adjustable up to what was
  // ordered, so a customer can return e.g. 1 of the 2 units of a product,
  // or just one of several different products in the order.
  const selection = {};
  items.forEach(it => { selection[it.id] = { checked: false, qty: 1 }; });

  const renderItemsHtml = () => `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${items.map(it => {
        const sel = selection[it.id];
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px">
          <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
            <input type="checkbox" data-ret-item-check="${it.id}" ${sel.checked ? 'checked' : ''}>
            <span style="font-size:13.5px">${esc(it.name)} <span class="text-muted" style="font-size:11.5px">(${it.qty} ordered · ₹${inr(it.price)} each)</span></span>
          </label>
          ${it.qty > 1 ? `
          <input type="number" data-ret-item-qty="${it.id}" min="1" max="${it.qty}" value="${sel.qty}" style="width:56px" class="form-input" ${sel.checked ? '' : 'disabled'}>
          ` : ''}
        </div>`;
      }).join('')}
    </div>`;

  openModal({
    title: 'Request a Return',
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:12px">
        <p style="color:var(--text-secondary);font-size:13px;margin:0">Refunds are sent to the bank account you enter below — whether your order was paid online or offline.</p>
        <div>
          <label class="form-label">Which item(s) do you want to return?</label>
          <div id="ret-items">${renderItemsHtml()}</div>
        </div>
        <div>
          <label class="form-label">Reason</label>
          <select class="form-input" id="ret-reason">
            <option value="damaged">Product damaged</option>
            <option value="wrong_item">Wrong item received</option>
            <option value="quality_issue">Quality issue</option>
            <option value="missing_item">Item(s) missing</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label class="form-label">Describe the issue</label>
          <textarea class="form-input" id="ret-desc" rows="2" placeholder="e.g. Box arrived crushed, cake was smashed on one side"></textarea>
        </div>
        ${window.CURRENT_ROLE === 'customer' ? '' : `
        <div>
          <label class="form-label">Phone number used for this order</label>
          <input class="form-input" id="ret-phone" placeholder="To verify this order is yours">
        </div>`}
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:2px">
          <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Bank details for refund</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <input class="form-input" id="ret-bank-holder" placeholder="Account holder name">
            <input class="form-input" id="ret-bank-number" placeholder="Account number">
            <input class="form-input" id="ret-bank-ifsc" placeholder="IFSC code (e.g. HDFC0001234)" style="text-transform:uppercase">
            <input class="form-input" id="ret-bank-name" placeholder="Bank name (optional)">
          </div>
        </div>
        <div id="ret-error"></div>
      </div>`,
    footerHtml: `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" data-submit-return>Submit Return Request</button>`,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);

      const wireItemInputs = () => {
        $$('[data-ret-item-check]', overlay).forEach(cb => {
          cb.addEventListener('change', () => {
            const id = cb.dataset.retItemCheck;
            selection[id].checked = cb.checked;
            const qtyInput = overlay.querySelector(`[data-ret-item-qty="${id}"]`);
            if (qtyInput) qtyInput.disabled = !cb.checked;
          });
        });
        $$('[data-ret-item-qty]', overlay).forEach(inp => {
          inp.addEventListener('change', () => {
            const id = inp.dataset.retItemQty;
            const max = parseInt(inp.max, 10) || 1;
            let val = parseInt(inp.value, 10) || 1;
            val = Math.max(1, Math.min(max, val));
            inp.value = val;
            selection[id].qty = val;
          });
        });
      };
      wireItemInputs();

      overlay.querySelector('[data-submit-return]').addEventListener('click', async () => {
        const errBox = overlay.querySelector('#ret-error');
        errBox.innerHTML = '';
        const selectedItems = Object.keys(selection)
          .filter(id => selection[id].checked)
          .map(id => ({ orderItemId: parseInt(id, 10), qty: selection[id].qty }));
        if (selectedItems.length === 0) {
          errBox.innerHTML = `<div style="margin-top:4px;font-size:12.5px;color:#b91c1c">Select at least one item to return</div>`;
          return;
        }
        const body = {
          orderNumber,
          items: selectedItems,
          reason: overlay.querySelector('#ret-reason').value,
          description: overlay.querySelector('#ret-desc').value.trim(),
          bankAccountHolder: overlay.querySelector('#ret-bank-holder').value.trim(),
          bankAccountNumber: overlay.querySelector('#ret-bank-number').value.trim(),
          bankIfsc: overlay.querySelector('#ret-bank-ifsc').value.trim().toUpperCase(),
          bankName: overlay.querySelector('#ret-bank-name').value.trim(),
        };
        const phoneEl = overlay.querySelector('#ret-phone');
        if (phoneEl) body.customerPhone = phoneEl.value.trim();
        try {
          await api.createReturn(body);
          closeModal();
          toast('Return requested — we\'ll review it shortly.', 'success');
          if (onDone) onDone();
        } catch (err) {
          errBox.innerHTML = `<div style="margin-top:4px;font-size:12.5px;color:#b91c1c">${esc(err.message)}</div>`;
        }
      });
    },
  });
}

let trackState = { orderId: null, expandedItem: null, itemDetail: null, reviewableItems: null, reviewDraft: { rating: 5, comment: '', imageUrl: '' } };

function trackItemDetailPanelHtml(itemName) {
  const isCustomer = window.CURRENT_ROLE === 'customer';
  const detail = trackState.itemDetail;
  const reviewable = trackState.reviewableItems && trackState.reviewableItems.find(it => it.itemName === itemName);
  const canReview = isCustomer && reviewable && !reviewable.alreadyReviewed;

  return `
  <div class="card" style="margin-top:14px;padding:16px;background:var(--bg)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="font-medium" style="font-size:15px">${esc(itemName)}</div>
        ${detail ? `<span style="display:flex;align-items:center;gap:4px">${starsHtml(detail.averageRating, 13)}<span class="text-muted" style="font-size:12px">(${detail.reviewCount})</span></span>` : ''}
      </div>
      <button type="button" class="btn btn-outline btn-sm btn-icon" data-track-close-item title="Close">✕</button>
    </div>

    ${canReview ? `
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:12px">
        <div class="font-medium" style="font-size:13.5px;margin-bottom:8px">Rate this product</div>
        ${interactiveStarsHtml(trackState.reviewDraft.rating, 'track-review')}
        <textarea class="form-input" id="track-review-comment" rows="2" placeholder="Share your experience (optional)" style="margin-top:8px">${esc(trackState.reviewDraft.comment)}</textarea>
        <input type="file" accept="image/*" class="form-input" id="track-review-image-file" style="margin-top:8px">
        <img id="track-review-image-preview" src="${esc(trackState.reviewDraft.imageUrl || '')}" alt="" style="margin-top:8px;width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:${trackState.reviewDraft.imageUrl ? 'block' : 'none'}">
        <button class="btn btn-primary btn-sm" id="track-review-submit" style="margin-top:8px">Submit Review</button>
      </div>
    ` : (isCustomer && reviewable && reviewable.alreadyReviewed ? `
      <div class="text-muted" style="font-size:12.5px;border-top:1px solid var(--border);padding-top:10px;margin-bottom:12px">✓ You already reviewed this item.</div>
    ` : '')}

    <div class="font-medium" style="font-size:13px;margin-bottom:8px">Customer Reviews</div>
    ${!detail ? `<div class="text-muted" style="font-size:12.5px">Loading…</div>` : detail.reviews.length === 0 ? `
      <div class="text-muted" style="font-size:12.5px">No reviews yet — be the first to review this item.</div>` : `
      <div style="display:flex;flex-direction:column;gap:10px;max-height:220px;overflow-y:auto">
        ${detail.reviews.map(r => `
          <div style="border-bottom:1px solid var(--border);padding-bottom:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <div style="display:flex;align-items:center;gap:6px">
                ${starsHtml(r.rating, 12)}
                <span class="font-medium" style="font-size:12.5px">${esc(r.customerName)}</span>
              </div>
              <span class="text-muted" style="font-size:11px">${dateStr(r.createdAt)}</span>
            </div>
            ${r.comment ? `<div style="font-size:12.5px;margin-top:4px">${esc(r.comment)}</div>` : ''}
            ${r.imageUrl ? `<img src="${esc(r.imageUrl)}" alt="Review photo" style="margin-top:6px;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" data-track-review-image-view="${esc(r.imageUrl)}">` : ''}
          </div>`).join('')}
      </div>`}
  </div>`;
}

async function renderTrack(content) {
  content.innerHTML = `
    <div class="page" style="max-width:960px;margin:0 auto;padding:0">
      <div style="margin-bottom:28px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:4px">📦 Track Your Order</h1>
        <p style="color:var(--text-secondary);font-size:14px">Enter your order number — or a supplier restock tracking number — to see the current status and progress.</p>
      </div>
      <div class="card" style="padding:20px;margin-bottom:24px;max-width:600px">
        <div style="display:flex;gap:10px">
          <input class="form-input" style="flex:1;font-size:15px" id="track-input" placeholder="e.g. ORD-003 or TRK-2024-00123">
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
      if (result.type === 'supplier_tracking') {
        resultBox.innerHTML = `
          <div class="card" style="padding:24px;max-width:600px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px">
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em">🚚 Supplier Restock Tracking</div>
                <div style="font-size:20px;font-weight:700;margin-top:2px">#${esc(result.trackingNumber)}</div>
                <div style="color:var(--text-secondary);font-size:13px;margin-top:2px">${esc(result.itemName)} &nbsp;·&nbsp; ${esc(result.supplierName || 'Unknown supplier')}</div>
              </div>
              ${raStatusPill(result.status)}
            </div>
            <div style="margin-bottom:20px">
              <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">🧑‍✈️ Delivery Partner</div>
              <div class="font-medium" style="font-size:14px">${esc(result.deliveryPartner || '—')}</div>
            </div>
            <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px">Progress</div>
            ${renderProgressSteps(orderProgressSteps(result.timeline))}
          </div>`;
        return;
      }
      const progressNodes = [...orderProgressSteps(result.timeline), ...returnProgressSteps(result.returnInfo)];
      resultBox.innerHTML = `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:20px;align-items:start" class="track-result-grid">
          <div class="card" style="padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px">
              <div>
                <div style="font-size:20px;font-weight:700">${esc(result.orderNumber)}</div>
                <div style="color:var(--text-secondary);font-size:13px;margin-top:2px">${esc(result.customerName)} &nbsp;·&nbsp; ${new Date(result.createdAt.replace(' ', 'T')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
              <span class="pill pill-${result.status}" style="font-size:13px">${statusLabel(result.status)}</span>
            </div>
            ${result.expectedDeliveryDate && result.status !== 'delivered' ? `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:14px 16px;border-radius:10px;background:#eefaf1;border:1px solid #bfe8c9">
              <div style="font-size:22px">📅</div>
              <div>
                <div style="font-size:11px;font-weight:700;color:#1c7a3d;text-transform:uppercase;letter-spacing:0.05em">${result.deliveryType === 'delivery' ? 'Expected Delivery' : 'Expected Ready By'}</div>
                <div style="font-size:16px;font-weight:700;color:#0f5c2a;margin-top:2px">${new Date(result.expectedDeliveryDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              </div>
            </div>` : ''}
            ${result.status === 'delivered' ? `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:14px 16px;border-radius:10px;background:${DELIVERY_TIMING_STYLE[result.deliveryTiming]?.bg || '#eefaf1'};border:1px solid ${DELIVERY_TIMING_STYLE[result.deliveryTiming]?.border || '#bfe8c9'}">
              <div style="font-size:22px">${DELIVERY_TIMING_STYLE[result.deliveryTiming]?.icon || '🎉'}</div>
              <div>
                <div style="font-size:11px;font-weight:700;color:${DELIVERY_TIMING_STYLE[result.deliveryTiming]?.label || '#1c7a3d'};text-transform:uppercase;letter-spacing:0.05em">${DELIVERY_TIMING_STYLE[result.deliveryTiming]?.title || 'Delivered'}</div>
                <div style="font-size:16px;font-weight:700;color:${DELIVERY_TIMING_STYLE[result.deliveryTiming]?.text || '#0f5c2a'};margin-top:2px">${DELIVERY_TIMING_STYLE[result.deliveryTiming]?.message || 'Your order has arrived. Enjoy!'}</div>
              </div>
            </div>` : ''}
            ${result.paymentStatus ? `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
              <span style="color:var(--text-tertiary);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:0.05em">Payment</span>
              <span class="pill pill-${result.paymentStatus}">${result.paymentStatus[0].toUpperCase() + result.paymentStatus.slice(1)}</span>
            </div>` : ''}
            ${result.deliveryOtp ? `
            <div style="margin-bottom:20px;padding:16px;border-radius:10px;background:#fff8e1;border:1px solid #ffe082;text-align:center">
              <div style="font-size:11px;font-weight:700;color:#8a6d00;text-transform:uppercase;letter-spacing:0.05em">🔐 Delivery OTP</div>
              <div style="font-size:28px;font-weight:800;letter-spacing:8px;color:#6b5300;margin-top:6px">${esc(result.deliveryOtp)}</div>
              <div style="font-size:12.5px;color:#8a6d00;margin-top:6px">Share this code with the delivery partner when your order arrives — it confirms the parcel reached you.</div>
            </div>` : ''}
            ${result.returnInfo ? returnInfoHtml(result.returnInfo) : (result.returnEligible ? `
            <div style="margin-bottom:20px;padding:14px 16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
              <div>
                <div style="font-size:13px;font-weight:600;color:#7f1d1d">Product damaged or something wrong?</div>
                <div style="font-size:12px;color:#9b3a3a;margin-top:2px">Request a return and get refunded to your bank account.</div>
              </div>
              <button class="btn btn-danger btn-sm" id="track-return-btn">↩️ Request Return</button>
            </div>` : '')}
            ${result.deliveryType === 'delivery' ? `
            <div style="margin-bottom:20px;padding:14px;border-radius:10px;background:var(--bg);border:1px solid var(--border)">
              <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">🚚 Delivery Partner</div>
              ${result.deliveryPartnerName ? `
                <div style="display:flex;align-items:center;gap:10px">
                  ${avatar(result.deliveryPartnerName)}
                  <div>
                    <div class="font-medium" style="font-size:14px">${esc(result.deliveryPartnerName)}</div>
                    ${result.deliveryPartnerPhone ? `<div class="text-muted" style="font-size:12.5px">${esc(result.deliveryPartnerPhone)}</div>` : ''}
                  </div>
                </div>` : `<div class="text-muted" style="font-size:13px">A delivery partner hasn't been assigned yet — check back soon.</div>`}
            </div>` : ''}
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Items Ordered <span style="font-weight:400;text-transform:none;font-size:11.5px">(tap an item for details${result.status === 'delivered' ? ' & reviews' : ''})</span></div>
              ${result.items.map((item, i) => `
                <div data-track-view-item="${esc(item.name)}" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:${i < result.items.length - 1 ? '1px solid var(--border)' : 'none'};font-size:14px;cursor:pointer">
                  <span>${item.qty}× ${esc(item.name)}</span>
                  <span style="color:var(--text-secondary)">₹${inr(item.qty * item.price)}</span>
                </div>`).join('')}
              <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:700;font-size:15px">
                <span>Total</span><span>₹${inr(result.total)}</span>
              </div>
              <div id="track-item-detail"></div>
            </div>
          </div>
          <div class="card" style="padding:20px 24px;position:sticky;top:16px">
            <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px">Order Progress</div>
            ${renderProgressSteps(progressNodes)}
          </div>
        </div>
        <style>
          @media (max-width: 760px) {
            .track-result-grid { grid-template-columns: 1fr !important; }
            .track-result-grid .card[style*="sticky"] { position: static !important; }
          }
        </style>`;
      const returnBtn = $('#track-return-btn', resultBox);
      if (returnBtn) {
        returnBtn.addEventListener('click', () => {
          openReturnRequestModal(result.orderNumber, result.items, () => doSearch());
        });
      }

      trackState = { orderId: result.orderId, expandedItem: null, itemDetail: null, reviewableItems: null, reviewDraft: { rating: 5, comment: '', imageUrl: '' } };
      const isCustomer = window.CURRENT_ROLE === 'customer';
      if (result.status === 'delivered' && isCustomer) {
        try { trackState.reviewableItems = (await api.getReviewableItems(result.orderId)).items; } catch (e) { /* ignore */ }
      }

      const detailBox = $('#track-item-detail', resultBox);
      const drawItemDetail = () => {
        detailBox.innerHTML = trackState.expandedItem ? trackItemDetailPanelHtml(trackState.expandedItem) : '';
        wireItemDetail();
      };
      const wireItemDetail = () => {
        const closeBtn = $('[data-track-close-item]', detailBox);
        if (closeBtn) closeBtn.addEventListener('click', () => { trackState.expandedItem = null; trackState.itemDetail = null; drawItemDetail(); });
        $$('[data-track-review-image-view]', detailBox).forEach(img => img.addEventListener('click', () => {
          viewImageLightbox(img.dataset.trackReviewImageView);
        }));
        const starGroup = $('[data-star-group]', detailBox);
        if (starGroup) $$('[data-star-value]', starGroup).forEach(star => star.addEventListener('click', () => {
          trackState.reviewDraft.rating = parseInt(star.dataset.starValue, 10);
          $$('[data-star-value]', starGroup).forEach(s => { s.style.color = parseInt(s.dataset.starValue, 10) <= trackState.reviewDraft.rating ? '#f5a623' : 'var(--border)'; });
        }));
        const commentBox = $('#track-review-comment', detailBox);
        if (commentBox) commentBox.addEventListener('input', (e) => { trackState.reviewDraft.comment = e.target.value; });
        const imageFile = $('#track-review-image-file', detailBox);
        if (imageFile) imageFile.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) return toast('Please choose an image file', 'error');
          if (file.size > 8 * 1024 * 1024) return toast('Image is too large (max 8MB)', 'error');
          try {
            const dataUrl = await compressImageFile(file, 600, 0.75);
            trackState.reviewDraft.imageUrl = dataUrl;
            const preview = $('#track-review-image-preview', detailBox);
            if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
          } catch (err) {
            toast('Could not process that image, please try another', 'error');
          }
        });
        const submitBtn = $('#track-review-submit', detailBox);
        if (submitBtn) submitBtn.addEventListener('click', async () => {
          try {
            await api.submitReview({ orderId: trackState.orderId, itemName: trackState.expandedItem, rating: trackState.reviewDraft.rating, comment: trackState.reviewDraft.comment.trim(), imageUrl: trackState.reviewDraft.imageUrl || '' });
            toast('Thanks for your review!', 'success');
            const [detail, reviewable] = await Promise.all([api.getReviewsForItem(trackState.expandedItem), api.getReviewableItems(trackState.orderId)]);
            trackState.itemDetail = detail;
            trackState.reviewableItems = reviewable.items;
            trackState.reviewDraft = { rating: 5, comment: '', imageUrl: '' };
            drawItemDetail();
          } catch (err) { toast(err.message, 'error'); }
        });
      };

      $$('[data-track-view-item]', resultBox).forEach(el => el.addEventListener('click', async () => {
        const name = el.dataset.trackViewItem;
        if (trackState.expandedItem === name) {
          trackState.expandedItem = null; trackState.itemDetail = null;
          return drawItemDetail();
        }
        trackState.expandedItem = name;
        trackState.itemDetail = null;
        trackState.reviewDraft = { rating: 5, comment: '', imageUrl: '' };
        drawItemDetail();
        try {
          const detail = await api.getReviewsForItem(name);
          if (trackState.expandedItem !== name) return;
          trackState.itemDetail = detail;
          drawItemDetail();
        } catch (err) { toast(err.message, 'error'); }
      }));
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
// Mobile sidebar (hamburger menu) — the sidebar is fixed off-screen below
// 900px width; these slide it in/out and toggle the tap-to-close backdrop.
function openSidebar() {
  $('.sidebar').classList.add('open');
  $('#sidebar-backdrop').classList.add('open');
}
function closeSidebar() {
  $('.sidebar').classList.remove('open');
  $('#sidebar-backdrop').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.CURRENT_ROLE === 'staff') {
    $$('.nav-link').forEach(a => {
      if (STAFF_ALLOWED_ROUTES.indexOf(a.dataset.route) === -1) a.style.display = 'none';
    });
  } else if (window.CURRENT_ROLE === 'customer') {
    $$('.nav-link').forEach(a => {
      if (CUSTOMER_ALLOWED_ROUTES.indexOf(a.dataset.route) === -1) a.style.display = 'none';
    });
  } else if (window.CURRENT_ROLE === 'delivery') {
    $$('.nav-link').forEach(a => {
      if (DELIVERY_ALLOWED_ROUTES.indexOf(a.dataset.route) === -1) a.style.display = 'none';
    });
  } else if (window.CURRENT_ROLE === 'supplier') {
    $$('.nav-link').forEach(a => {
      if (SUPPLIER_ALLOWED_ROUTES.indexOf(a.dataset.route) === -1) a.style.display = 'none';
    });
  }
  // Hide any group whose sub-links are all hidden for this role (rather
  // than showing an empty, unclickable section header).
  $$('.nav-group').forEach(group => {
    const visibleLinks = $$('.nav-link', group).filter(a => a.style.display !== 'none');
    group.style.display = visibleLinks.length ? '' : 'none';
  });
  $$('.nav-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = $(`[data-group-body="${header.dataset.group}"]`);
      const willOpen = !header.classList.contains('open');
      // Accordion behavior: close every other group before opening this one.
      $$('.nav-group-header').forEach(h => { if (h !== header) h.classList.remove('open'); });
      $$('.nav-group-body').forEach(b => { if (b !== body) b.classList.remove('open'); });
      header.classList.toggle('open', willOpen);
      if (body) body.classList.toggle('open', willOpen);
    });
  });
  $$('.nav-link').forEach(a => a.addEventListener('click', () => { navigate(a.dataset.route); closeSidebar(); }));
  $('#sidebar-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  $('#btn-sidebar-toggle').addEventListener('click', () => {
    const sidebar = $('.sidebar');
    if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);
  $('#btn-logout').addEventListener('click', () => {
    confirmDialog('Sign out of Golden Crust Bakery?', async () => {
      clearSavedPosState();
      try { await api.logout(); } catch (e) { /* ignore */ }
      window.location.href = 'login.php';
    });
  });
  restorePosState();
  window.addEventListener('pagehide', savePosState);
  initNotifications();
  render();
  if (window.CURRENT_ROLE === 'customer') maybeShowWelcomeCouponPopup();
});

// Shows a one-time-per-login popup advertising the active "Welcome Offer"
// coupon (set by admin under Discounts & Coupons), unless this customer has
// already placed an order using it. Runs once on page load (i.e. once per
// login/session) rather than on every navigation — if they don't use it,
// it'll simply show again the next time they log in, per the requirement
// that it keep reminding them until it's actually redeemed.
async function maybeShowWelcomeCouponPopup() {
  let data;
  try { data = await api.getWelcomeCoupon(); } catch (err) { return; }
  const c = data.coupon;
  if (!c || data.alreadyUsed) return;

  openModal({
    title: '🎉 Welcome Offer',
    bodyHtml: `
      <div style="text-align:center;padding:6px 0 4px">
        <div style="font-size:32px">🎁</div>
        <div style="font-size:20px;font-weight:700;margin-top:8px;letter-spacing:1px">${esc(c.code)}</div>
        <div style="font-size:15px;margin-top:4px">${c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${inr(c.discountValue)} off`} your order</div>
        ${c.description ? `<div class="text-muted" style="font-size:13px;margin-top:6px">${esc(c.description)}</div>` : ''}
        ${c.minOrderAmount > 0 ? `<div class="text-muted" style="font-size:12px;margin-top:4px">Minimum order ₹${inr(c.minOrderAmount)}</div>` : ''}
      </div>`,
    footerHtml: `<button class="btn btn-outline" data-cancel>Maybe later</button><button class="btn btn-primary" id="welcome-coupon-use">Use it now</button>`,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#welcome-coupon-use').addEventListener('click', () => {
        closeModal();
        posState.coupon = { code: c.code, applied: null, error: '', checking: false };
        posState.cartOpen = false;
        navigate('new-order');
      });
    },
  });
}

// ── Notifications ────────────────────────────────────────────────────────
function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso.replace(' ', 'T'))) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initNotifications() {
  const btn = $('#btn-notifications');
  const dropdown = $('#notif-dropdown');
  const badge = $('#notif-badge');
  if (!btn || !dropdown || !badge) return;

  const setBadge = (count) => {
    badge.style.display = count > 0 ? 'flex' : 'none';
    badge.textContent = count > 9 ? '9+' : String(count);
  };

  const drawList = (data) => {
    if (!data.notifications.length) {
      dropdown.innerHTML = `<div class="notif-dropdown-header">Notifications</div><div class="notif-empty">🔔 No notifications yet</div>`;
      return;
    }
    dropdown.innerHTML = `
      <div class="notif-dropdown-header">
        <span>Notifications</span>
        ${data.unreadCount > 0 ? `<button class="btn btn-outline btn-sm" id="notif-mark-all" style="padding:3px 8px;font-size:11px">Mark all read</button>` : ''}
      </div>
      ${data.notifications.map(n => `
        <div class="notif-item ${n.isRead ? '' : 'unread'}">
          <div>${esc(n.message)}</div>
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>`).join('')}`;
    const markAllBtn = $('#notif-mark-all', dropdown);
    if (markAllBtn) markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await api.markAllNotificationsRead();
        await refresh();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  const refresh = async () => {
    try {
      const data = await api.getNotifications();
      setBadge(data.unreadCount);
      if (dropdown.style.display !== 'none') drawList(data);
      return data;
    } catch (e) { /* silent — notifications are best-effort */ }
  };

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const opening = dropdown.style.display === 'none';
    dropdown.style.display = opening ? 'block' : 'none';
    if (opening) {
      const data = await api.getNotifications();
      drawList(data);
      setBadge(data.unreadCount);
    }
  });
  document.addEventListener('click', (e) => {
    if (dropdown.style.display !== 'none' && !dropdown.contains(e.target) && e.target !== btn) {
      dropdown.style.display = 'none';
    }
  });

  refresh();
  setInterval(refresh, 20000);
}

// ── Staff Training ────────────────────────────────────────────────────────
let trainingState = { list: [], search: '', category: 'all' };

const TRAINING_AUDIENCE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'delivery', label: 'Delivery Partner' },
];

function openTrainingModal(material, onSaved) {
  const form = material
    ? { title: material.title, category: material.category || '', description: material.description || '', resourceUrl: material.resourceUrl || '', durationMinutes: material.durationMinutes || '', audience: (material.audience || 'admin,staff').split(',').map(s => s.trim()).filter(Boolean) }
    : { title: '', category: '', description: '', resourceUrl: '', durationMinutes: '', audience: ['admin', 'staff'] };

  const bodyHtml = `
    <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="tr-title" value="${esc(form.title)}" placeholder="e.g. Kitchen Hygiene Basics"></div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">Category</label><input class="form-input" id="tr-category" value="${esc(form.category)}" placeholder="e.g. Safety, POS, Baking"></div>
      <div class="form-group"><label class="form-label">Duration (minutes)</label><input type="number" class="form-input" id="tr-duration" value="${form.durationMinutes}" placeholder="e.g. 15"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Who should see this lesson?</label>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        ${TRAINING_AUDIENCE_OPTIONS.map(o => `
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:400">
            <input type="checkbox" class="tr-audience-cb" value="${o.value}" ${form.audience.indexOf(o.value) !== -1 ? 'checked' : ''}>${o.label}
          </label>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Resource link <span class="text-muted" style="font-weight:400">(optional — a video, PDF, or doc URL)</span></label><input class="form-input" id="tr-resource" value="${esc(form.resourceUrl)}" placeholder="https://…"></div>
    <div class="form-group"><label class="form-label">Description / instructions</label><textarea class="form-input" id="tr-description" rows="5" placeholder="What this audience needs to know or do">${esc(form.description)}</textarea></div>`;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" id="tr-save">${material ? 'Save Changes' : 'Add Material'}</button>`;

  openModal({
    title: material ? 'Edit Training Material' : 'Add Training Material',
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#tr-save').addEventListener('click', async () => {
        const title = overlay.querySelector('#tr-title').value.trim();
        if (!title) return toast('Title is required', 'error');
        const audience = $$('.tr-audience-cb', overlay).filter(cb => cb.checked).map(cb => cb.value);
        if (!audience.length) return toast('Pick at least one audience', 'error');
        const payload = {
          title,
          category: overlay.querySelector('#tr-category').value.trim(),
          audience,
          description: overlay.querySelector('#tr-description').value.trim(),
          resourceUrl: overlay.querySelector('#tr-resource').value.trim(),
          durationMinutes: overlay.querySelector('#tr-duration').value || 0,
        };
        try {
          if (material) await api.updateTrainingMaterial(material.id, payload);
          else await api.createTrainingMaterial(payload);
          toast(material ? 'Training material updated!' : 'Training material added!', 'success');
          closeModal();
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

function openLessonModal(material, onChanged) {
  const bodyHtml = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      ${material.category ? `<span class="pill">${esc(material.category)}</span>` : ''}
      ${material.durationMinutes ? `<span class="text-muted" style="font-size:12.5px">⏱ ${material.durationMinutes} min</span>` : ''}
      <span class="text-muted" style="font-size:12.5px">${material.completedCount} / ${material.totalStaff} completed</span>
    </div>
    <div style="font-size:13.5px;line-height:1.6;white-space:pre-wrap">${esc(material.description || 'No further details for this lesson yet.')}</div>
    ${material.resourceUrl ? `<div style="margin-top:14px"><a href="${esc(material.resourceUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🔗 Open resource</a></div>` : ''}
  `;
  const footerHtml = `<button class="btn btn-outline" data-cancel>Close</button><button class="btn ${material.isCompleted ? 'btn-outline' : 'btn-primary'}" id="lesson-toggle">${material.isCompleted ? 'Mark Incomplete' : 'Mark Complete'}</button>`;

  openModal({
    title: material.title,
    bodyHtml, footerHtml,
    onMount: (overlay) => {
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('#lesson-toggle').addEventListener('click', async () => {
        const nowCompleted = !material.isCompleted;
        try {
          await api.setTrainingComplete(material.id, nowCompleted);
          toast(nowCompleted ? 'Marked complete!' : 'Marked incomplete', 'success');
          closeModal();
          onChanged();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

async function renderTraining(content) {
  const isAdmin = window.CURRENT_ROLE === 'admin';
  const data = await api.getTraining();
  trainingState.list = data.materials;

  const draw = () => {
    const categories = ['all', ...new Set(trainingState.list.map(m => m.category).filter(Boolean))];
    const q = trainingState.search.toLowerCase();
    const filtered = trainingState.list.filter(m =>
      (trainingState.category === 'all' || m.category === trainingState.category) &&
      (m.title.toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)));
    const completedByMe = trainingState.list.filter(m => m.isCompleted).length;

    content.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:20px">
        <div class="metric-card"><div class="metric-label">Training Materials</div><div class="metric-value">${trainingState.list.length}</div></div>
        <div class="metric-card"><div class="metric-label">Completed by Me</div><div class="metric-value">${completedByMe} / ${trainingState.list.length}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Training</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select class="form-input" id="tr-cat-filter" style="width:auto">
              ${categories.map(c => `<option value="${esc(c)}" ${trainingState.category === c ? 'selected' : ''}>${c === 'all' ? 'All categories' : esc(c)}</option>`).join('')}
            </select>
            <div class="search-bar"><span>🔍</span><input id="tr-search" placeholder="Search…" value="${esc(trainingState.search)}"></div>
            ${isAdmin ? `<button class="btn btn-primary btn-sm" id="tr-add">+ New Material</button>` : ''}
          </div>
        </div>
        ${filtered.length === 0 ? emptyState('🎓', 'No training materials found') : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Material</th><th>Category</th>${isAdmin ? '<th>Audience</th>' : ''}<th>Duration</th><th>Team Progress</th><th>My Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(m => `
                <tr>
                  <td>
                    <div class="font-medium" data-lesson-open="${m.id}" style="cursor:pointer">${esc(m.title)}</div>
                    ${m.description ? `<div class="text-muted" data-lesson-open="${m.id}" style="font-size:12px;max-width:320px;cursor:pointer">${esc(m.description.length > 90 ? m.description.slice(0, 90) + '…' : m.description)}</div>` : ''}
                    ${m.resourceUrl ? `<a href="${esc(m.resourceUrl)}" target="_blank" rel="noopener" style="font-size:12px">🔗 Open resource</a>` : ''}
                  </td>
                  <td class="text-muted">${esc(m.category || '—')}</td>
                  ${isAdmin ? `<td class="text-muted" style="font-size:12px">${esc((m.audience || '').split(',').map(s => s.trim()).filter(Boolean).join(', '))}</td>` : ''}
                  <td class="text-muted">${m.durationMinutes ? m.durationMinutes + ' min' : '—'}</td>
                  <td class="text-muted">${m.completedCount} / ${m.totalStaff} completed</td>
                  <td>${m.isCompleted ? `<span class="pill pill-paid">✓ Completed</span>` : `<span class="pill pill-critical">Pending</span>`}</td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      <button class="btn ${m.isCompleted ? 'btn-outline' : 'btn-primary'} btn-sm" data-tr-toggle="${m.id}" data-completed="${m.isCompleted ? '1' : '0'}">${m.isCompleted ? 'Mark Incomplete' : 'Mark Complete'}</button>
                      ${isAdmin ? `<button class="btn btn-outline btn-sm" data-tr-edit="${m.id}">Edit</button>
                      <button class="btn btn-danger btn-sm btn-icon" data-tr-delete="${m.id}">✕</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;

    const refresh = async () => { const d = await api.getTraining(); trainingState.list = d.materials; draw(); };
    $('#tr-search', content).addEventListener('input', (e) => { trainingState.search = e.target.value; draw(); });
    $('#tr-cat-filter', content).addEventListener('change', (e) => { trainingState.category = e.target.value; draw(); });
    if (isAdmin) $('#tr-add', content).addEventListener('click', () => openTrainingModal(null, refresh));
    $$('[data-lesson-open]', content).forEach(el => el.addEventListener('click', () => {
      const m = trainingState.list.find(x => x.id === el.dataset.lessonOpen);
      if (m) openLessonModal(m, refresh);
    }));
    $$('[data-tr-toggle]', content).forEach(btn => btn.addEventListener('click', async () => {
      const nowCompleted = btn.dataset.completed !== '1';
      try {
        await api.setTrainingComplete(btn.dataset.trToggle, nowCompleted);
        toast(nowCompleted ? 'Marked complete!' : 'Marked incomplete', 'success');
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    }));
    if (isAdmin) {
      $$('[data-tr-edit]', content).forEach(btn => btn.addEventListener('click', () => {
        const m = trainingState.list.find(x => x.id === btn.dataset.trEdit);
        openTrainingModal(m, refresh);
      }));
      $$('[data-tr-delete]', content).forEach(btn => btn.addEventListener('click', () => {
        confirmDialog('Delete this training material?', async () => {
          try {
            await api.deleteTrainingMaterial(btn.dataset.trDelete);
            toast('Training material deleted', 'success');
            refresh();
          } catch (err) { toast(err.message, 'error'); }
        });
      }));
    }
  };

  draw();
}
