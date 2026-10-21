import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/inter';
import './admin.css';

const $ = (s) => document.querySelector(s);
const loginView = $('#login');
const appView = $('#app');
const listEl = $('#list');
const tpl = $('#card-tpl');

let items = [];
let filter = 'all';
let query = '';
let knownIds = null;
let timer;
let setupMode = false;

/* ---------- helpers ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data };
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('is-on'), 2600);
}

const fmtDate = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}
const LABEL = { new: 'New', contacted: 'Contacted', converted: 'Converted', closed: 'Closed' };
function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 ? d : '';
}

/* ---------- views ---------- */
function showLogin(sub, setup = false) {
  clearInterval(timer);
  setupMode = setup;
  appView.hidden = true;
  loginView.hidden = false;
  $('#login-title').textContent = setup ? 'Create your password' : 'Sign in';
  $('#password-label').textContent = setup ? 'New password (at least 10 characters)' : 'Password';
  $('#password').autocomplete = setup ? 'new-password' : 'current-password';
  $('#confirm-wrap').hidden = !setup;
  $('#login-btn').textContent = setup ? 'Create password & open' : 'Sign in';
  $('#login-sub').textContent = sub || (setup
    ? 'Welcome! Choose the password you will use to open this admin app. Only you will know it.'
    : 'Enter your admin password to see website enquiries.');
  setTimeout(() => $('#password').focus(), 50);
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  listEl.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  load();
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) load(true); }, 5 * 60000);
}

/* ---------- data ---------- */
async function load(quiet) {
  const { status, data } = await api('/api/admin/enquiries').catch(() => ({ status: 0, data: {} }));
  if (status === 401) return showLogin('Your session has ended. Please sign in again.');
  const banner = $('#banner');
  if (status === 503) {
    banner.hidden = false;
    banner.textContent = 'Enquiry storage is not connected. Connect the Blob store to this project in Vercel, then redeploy.';
    items = [];
    return render();
  }
  if (status !== 200) {
    if (!quiet) { banner.hidden = false; banner.textContent = 'Could not load enquiries. Check your internet connection and press Refresh.'; }
    return;
  }
  banner.hidden = true;
  const fresh = data.items || [];
  if (knownIds) {
    const added = fresh.filter((i) => !knownIds.has(i.id));
    if (added.length) toast(added.length === 1 ? `New enquiry from ${added[0].name}` : `${added.length} new enquiries`);
  }
  knownIds = new Set(fresh.map((i) => i.id));
  items = fresh;
  $('#updated').textContent = `Updated ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · refreshes automatically`;
  render();
}

function counts() {
  const c = { all: items.length, new: 0, contacted: 0, converted: 0, closed: 0 };
  items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
  Object.entries(c).forEach(([k, v]) => { const el = $(`#c-${k}`); if (el) el.textContent = v; });
  document.title = c.new ? `(${c.new}) CloudBridge Admin` : 'CloudBridge Admin';
  if ('setAppBadge' in navigator) { (c.new ? navigator.setAppBadge(c.new) : navigator.clearAppBadge()).catch(() => {}); }
}

function render() {
  counts();
  const q = query.toLowerCase();
  const shown = items.filter((i) => (filter === 'all' || i.status === filter)
    && (!q || [i.name, i.email, i.phone, i.service, i.message, i.notes].join(' ').toLowerCase().includes(q)));
  listEl.replaceChildren(...shown.map(card));
  $('#empty').hidden = shown.length > 0;
  if (!shown.length && items.length) {
    $('#empty').querySelector('h2').textContent = 'Nothing matches';
    $('#empty').querySelector('p').textContent = 'Try a different filter or search.';
  } else {
    $('#empty').querySelector('h2').textContent = 'No enquiries here yet';
    $('#empty').querySelector('p').textContent = 'New enquiries from the website contact form will appear here automatically.';
  }
}

function card(item) {
  const el = tpl.content.firstElementChild.cloneNode(true);
  el.classList.toggle('is-new', item.status === 'new');
  el.querySelector('.card__name').textContent = item.name;
  el.querySelector('.card__service').textContent = item.service || 'General enquiry';
  const date = el.querySelector('.card__date');
  date.dateTime = item.createdAt;
  date.textContent = ago(item.createdAt);
  date.title = fmtDate(item.createdAt);
  const pill = el.querySelector('.pill');
  pill.textContent = LABEL[item.status] || item.status;
  pill.className = `pill pill--${item.status}`;
  el.querySelector('.card__msg').textContent = item.message;

  const call = el.querySelector('.chip--call');
  const wa = el.querySelector('.chip--wa');
  if (item.phone) {
    call.href = `tel:${item.phone.replace(/[^+\d]/g, '')}`;
    call.querySelector('.t').textContent = item.phone;
    const n = waNumber(item.phone);
    if (n) wa.href = `https://wa.me/${n}?text=${encodeURIComponent(`Hi ${item.name.split(' ')[0]}, this is Dhanush from CloudBridge Technologies regarding your enquiry about ${item.service || 'your project'}.`)}`;
    else wa.remove();
  } else { call.remove(); wa.remove(); }
  const mail = el.querySelector('.chip--mail');
  mail.href = `mailto:${item.email}?subject=${encodeURIComponent(`Your enquiry - ${item.service || 'CloudBridge Technologies'}`)}`;
  mail.querySelector('.t').textContent = item.email;

  const status = el.querySelector('.status');
  status.value = item.status;
  status.addEventListener('change', async () => {
    const r = await api('/api/admin/enquiries', { method: 'PATCH', body: JSON.stringify({ id: item.id, status: status.value }) });
    if (r.status === 200) { Object.assign(item, r.data.item); toast(`Marked as ${LABEL[item.status]}`); render(); }
    else { status.value = item.status; toast('Could not update - try again'); }
  });

  const notes = el.querySelector('.notes');
  const save = el.querySelector('.save');
  notes.value = item.notes || '';
  notes.addEventListener('input', () => { save.disabled = notes.value === (item.notes || ''); });
  save.addEventListener('click', async () => {
    save.disabled = true;
    const r = await api('/api/admin/enquiries', { method: 'PATCH', body: JSON.stringify({ id: item.id, notes: notes.value }) });
    if (r.status === 200) { Object.assign(item, r.data.item); toast('Notes saved'); foot(); }
    else { save.disabled = false; toast('Could not save - try again'); }
  });

  el.querySelector('.del').addEventListener('click', async () => {
    if (!confirm(`Delete the enquiry from ${item.name}? This cannot be undone.`)) return;
    const r = await api(`/api/admin/enquiries?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    if (r.status === 200) { items = items.filter((i) => i.id !== item.id); knownIds?.delete(item.id); toast('Enquiry deleted'); render(); }
    else toast('Could not delete - try again');
  });

  const footEl = el.querySelector('.card__foot');
  const foot = () => { footEl.textContent = `Received ${fmtDate(item.createdAt)}${item.page ? ` from ${item.page}` : ''}${item.updatedAt !== item.createdAt ? ` · last updated ${ago(item.updatedAt)}` : ''}`; };
  foot();
  return el;
}

/* ---------- CSV export ---------- */
function exportCsv() {
  if (!items.length) return toast('No enquiries to export yet');
  const cols = ['createdAt', 'name', 'email', 'phone', 'service', 'status', 'message', 'notes', 'page'];
  const head = ['Date', 'Name', 'Email', 'Phone', 'Service', 'Status', 'Message', 'Notes', 'Page'];
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop Excel formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = items.map((i) => cols.map((c) => esc(c === 'createdAt' ? fmtDate(i[c]) : c === 'status' ? LABEL[i[c]] : i[c])).join(','));
  const blob = new Blob(['﻿' + [head.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cloudbridge-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- events ---------- */
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const msg = $('#login-msg');
  msg.textContent = '';
  const password = $('#password').value;
  if (setupMode) {
    if (password.length < 10) { msg.textContent = 'Please use at least 10 characters.'; return; }
    if (password !== $('#password2').value) { msg.textContent = 'The two passwords do not match.'; return; }
  }
  btn.disabled = true;
  const { status, data } = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password, setup: setupMode }) }).catch(() => ({ status: 0, data: {} }));
  btn.disabled = false;
  if (status === 200) {
    $('#password').value = ''; $('#password2').value = '';
    if (setupMode) toast('Password created - you are signed in');
    return showApp();
  }
  if (status === 409 && data.error === 'already_set') return showLogin('A password has already been created. Please sign in.');
  if (status === 409 && data.error === 'needs_setup') return showLogin('', true);
  msg.textContent = {
    400: 'Please use at least 10 characters.',
    401: 'Wrong password. Please try again.',
    429: 'Too many wrong attempts. Please wait 15 minutes and try again.',
    503: 'Enquiry storage is not connected yet.',
  }[status] || 'Could not sign in. Check your internet connection.';
});

$('#logout-btn').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  items = []; knownIds = null;
  if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
  showLogin('You have been logged out.');
});
const dlg = $('#pw-dlg');
$('#pw-btn').addEventListener('click', () => { $('#pw-msg').textContent = ''; $('#pw-form').reset(); dlg.showModal(); });
$('#pw-cancel').addEventListener('click', () => dlg.close());
$('#pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const next = $('#pw-new').value;
  if (next.length < 10) { $('#pw-msg').textContent = 'Please use at least 10 characters.'; return; }
  $('#pw-save').disabled = true;
  const r = await api('/api/admin/login', { method: 'PUT', body: JSON.stringify({ current: $('#pw-cur').value, next }) }).catch(() => ({ status: 0 }));
  $('#pw-save').disabled = false;
  if (r.status === 200) { dlg.close(); toast('Password changed'); return; }
  $('#pw-msg').textContent = { 401: 'Current password is wrong.', 400: 'Please use at least 10 characters.' }[r.status] || 'Could not change password. Try again.';
});
$('#refresh-btn').addEventListener('click', () => { load(); toast('Refreshed'); });
$('#export-btn').addEventListener('click', exportCsv);
$('#search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('is-on', x === b));
  render();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && !appView.hidden) load(true); });

/* ---------- install as an app ---------- */
let deferred;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#install-btn').hidden = false; });
$('#install-btn').addEventListener('click', async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice.catch(() => {});
  deferred = null;
  $('#install-btn').hidden = true;
});
addEventListener('appinstalled', () => { $('#install-btn').hidden = true; toast('Installed - open it from your desktop or home screen'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});

/* ---------- start ---------- */
(async () => {
  const { status, data } = await api('/api/admin/login').catch(() => ({ status: 0, data: {} }));
  if (status === 200 && data.loggedIn) return showApp();
  if (status === 200 && !data.storage) return showLogin('Enquiry storage is not connected to this website yet.');
  if (status === 200 && !data.configured) return showLogin('', true);
  showLogin();
})();
