import crypto from 'node:crypto';
import { read, write, update, storeConfigured } from './store.js';

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...extra,
    },
  });
}

export async function readBody(request, maxBytes = 20000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('too_large');
  try { return JSON.parse(text || '{}'); } catch { throw new Error('bad_json'); }
}

export function clientIp(request) {
  const h = request.headers;
  return (h.get('x-real-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim();
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

/* ---------------- admin password ----------------
 * The owner chooses the password in the app on first use. Only a salted
 * scrypt hash is stored (data/admin.json in the private store).
 * ADMIN_PASSWORD in Vercel env vars, if ever set, takes priority. */
const ADMIN_FILE = 'data/admin.json';
let cache = { at: 0, rec: undefined };

async function adminRecord() {
  if (process.env.ADMIN_PASSWORD) return { env: true };
  if (cache.rec !== undefined && Date.now() - cache.at < 60000) return cache.rec;
  const r = storeConfigured() ? await read(ADMIN_FILE).catch(() => null) : null;
  cache = { at: Date.now(), rec: r ? r.data : null };
  return cache.rec;
}

const scrypt = (pw, salt) => new Promise((res, rej) =>
  crypto.scrypt(String(pw), Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

export async function adminConfigured() {
  return Boolean(await adminRecord());
}

export const MIN_PASSWORD = 10;

/** First-run setup: only works while no password exists yet. */
export async function createAdmin(password) {
  if (await adminRecord()) return false;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt)).toString('hex');
  try {
    await write(ADMIN_FILE, { salt, hash, createdAt: new Date().toISOString() }, { create: true });
  } catch (err) {
    if (err.conflict) return false; // someone else finished setup first
    throw err;
  }
  cache = { at: 0, rec: undefined };
  return true;
}

export async function changeAdminPassword(newPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(newPassword, salt)).toString('hex');
  await update(ADMIN_FILE, {}, (d) => { d.salt = salt; d.hash = hash; d.changedAt = new Date().toISOString(); });
  cache = { at: 0, rec: undefined };
}

export async function passwordMatches(candidate) {
  const rec = await adminRecord();
  if (!rec) return false;
  if (rec.env) {
    const a = crypto.createHash('sha256').update(String(candidate || '')).digest();
    const b = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
    return crypto.timingSafeEqual(a, b);
  }
  const got = await scrypt(candidate || '', rec.salt);
  const want = Buffer.from(rec.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/* ---------------- admin session cookie ---------------- */
const COOKIE = 'cb_admin';
const SESSION_DAYS = 30;
const b64u = (buf) => Buffer.from(buf).toString('base64url');

async function secret() {
  const rec = await adminRecord();
  const base = rec?.env ? process.env.ADMIN_PASSWORD : rec?.hash || '';
  const extra = process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || 'cb-local';
  // Changing the password changes the secret, which signs out every device.
  return crypto.createHmac('sha256', 'cb-admin-session-v2').update(base + '|' + extra).digest();
}

export async function sessionCookie() {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = b64u(JSON.stringify({ exp, n: crypto.randomBytes(8).toString('hex') }));
  const sig = b64u(crypto.createHmac('sha256', await secret()).update(payload).digest());
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isAdmin(request) {
  const raw = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  if (!(await adminConfigured())) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return false;
  const expect = crypto.createHmac('sha256', await secret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expect.length || !crypto.timingSafeEqual(given, expect)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

/* ---------------- wrong-password limiting (persisted per IP) ---------------- */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const failKey = (ip) => `data/login-fails/${crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32)}.json`;

export async function loginBlocked(ip) {
  const r = await read(failKey(ip)).catch(() => null);
  return Boolean(r && Date.now() - r.data.first < WINDOW_MS && r.data.fails >= MAX_FAILS);
}

export async function recordFail(ip) {
  await update(failKey(ip), { fails: 0, first: Date.now() }, (d) => {
    if (Date.now() - d.first > WINDOW_MS) { d.fails = 0; d.first = Date.now(); }
    d.fails += 1;
  }).catch(() => {});
}

export async function clearFails(ip) {
  const { remove } = await import('./store.js');
  await remove(failKey(ip)).catch(() => {});
}
