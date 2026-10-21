// Public endpoint: the website contact form posts here. Saves the enquiry
// so it appears in the admin app. Write-only - nothing can be read back.
import crypto from 'node:crypto';
import { storeConfigured } from './_lib/store.js';
import { addEnquiry } from './_lib/enquiries-db.js';
import { json, readBody, clientIp, sameOrigin } from './_lib/http.js';

const recent = new Map(); // per-instance soft throttle: ip -> [timestamps]

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

export async function POST(request) {
  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);
  if (!storeConfigured()) return json({ ok: false, error: 'not_configured' }, 503);

  let body;
  try { body = await readBody(request, 20000); } catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (body.website) return json({ ok: true });

  const ip = clientIp(request);
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= 5) return json({ ok: false, error: 'too_many' }, 429);
  hits.push(now);
  recent.set(ip, hits);

  const e = {
    name: clean(body.name, 120),
    email: clean(body.email, 200),
    phone: clean(body.phone, 40),
    service: clean(body.service, 80),
    message: clean(body.message, 5000),
    page: clean(body.page, 200),
  };
  if (!e.name || !e.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  const iso = new Date(now).toISOString();
  const record = { id: `${now}-${crypto.randomBytes(4).toString('hex')}`, ...e, createdAt: iso, updatedAt: iso, status: 'new', notes: '' };

  try {
    await addEnquiry(record);
  } catch (err) {
    console.error('enquiry save failed', err);
    return json({ ok: false, error: 'save_failed' }, 500);
  }
  return json({ ok: true });
}

export function GET() {
  return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
}
