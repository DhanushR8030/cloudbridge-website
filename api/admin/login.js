import {
  json, readBody, clientIp, sameOrigin, adminConfigured, passwordMatches, sessionCookie,
  loginBlocked, recordFail, clearFails, isAdmin, createAdmin, changeAdminPassword, MIN_PASSWORD,
} from '../_lib/http.js';
import { storeConfigured } from '../_lib/store.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET: is the visitor logged in, and has a password been created yet?
export async function GET(request) {
  const storage = storeConfigured();
  return json({ loggedIn: await isAdmin(request), configured: await adminConfigured(), storage, minPassword: MIN_PASSWORD });
}

// POST { password }            -> sign in
// POST { password, setup:true } -> first-run: create the admin password
export async function POST(request) {
  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);
  if (!storeConfigured()) return json({ ok: false, error: 'storage_missing' }, 503);
  const ip = clientIp(request);
  if (await loginBlocked(ip)) return json({ ok: false, error: 'locked' }, 429);

  let body;
  try { body = await readBody(request, 2000); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  const password = String(body.password || '');

  if (body.setup) {
    if (password.length < MIN_PASSWORD) return json({ ok: false, error: 'too_short' }, 400);
    const created = await createAdmin(password);
    if (!created) return json({ ok: false, error: 'already_set' }, 409);
    return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie() });
  }

  if (!(await adminConfigured())) return json({ ok: false, error: 'needs_setup' }, 409);
  if (!(await passwordMatches(password))) {
    await recordFail(ip);
    await sleep(900);
    return json({ ok: false, error: 'wrong_password' }, 401);
  }
  await clearFails(ip);
  return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie() });
}

// PUT { current, next } -> change password (signs out all other devices)
export async function PUT(request) {
  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);
  if (!(await isAdmin(request))) return json({ ok: false, error: 'unauthorised' }, 401);
  if (process.env.ADMIN_PASSWORD) return json({ ok: false, error: 'managed_in_vercel' }, 409);
  let body;
  try { body = await readBody(request, 2000); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!(await passwordMatches(body.current))) { await sleep(900); return json({ ok: false, error: 'wrong_password' }, 401); }
  if (String(body.next || '').length < MIN_PASSWORD) return json({ ok: false, error: 'too_short' }, 400);
  await changeAdminPassword(String(body.next));
  return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie() });
}

