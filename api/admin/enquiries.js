// Admin-only: list, update (status / notes) and delete enquiries.
import { json, readBody, isAdmin, sameOrigin } from '../_lib/http.js';
import { read, update, storeConfigured } from '../_lib/store.js';

const FILE = 'data/enquiries.json';
const STATUSES = ['new', 'contacted', 'converted', 'closed'];
const ID = /^\d{10,16}-[a-f0-9]{8}$/;

async function guard(request, write = false) {
  if (write && !sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);
  if (!storeConfigured()) return json({ ok: false, error: 'not_configured' }, 503);
  if (!(await isAdmin(request))) return json({ ok: false, error: 'unauthorised' }, 401);
  return null;
}

export async function GET(request) {
  const denied = await guard(request);
  if (denied) return denied;
  const cur = await read(FILE);
  return json({ ok: true, items: cur ? cur.data.items : [] });
}

export async function PATCH(request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  let body;
  try { body = await readBody(request, 12000); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!ID.test(body.id || '')) return json({ ok: false, error: 'bad_id' }, 400);
  if (body.status !== undefined && !STATUSES.includes(body.status)) return json({ ok: false, error: 'bad_status' }, 400);

  const item = await update(FILE, { items: [] }, (d) => {
    const rec = d.items.find((i) => i.id === body.id);
    if (!rec) return null;
    if (body.status !== undefined) rec.status = body.status;
    if (body.notes !== undefined) rec.notes = String(body.notes).slice(0, 5000);
    rec.updatedAt = new Date().toISOString();
    return rec;
  });
  if (!item) return json({ ok: false, error: 'not_found' }, 404);
  return json({ ok: true, item });
}

export async function DELETE(request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID.test(id)) return json({ ok: false, error: 'bad_id' }, 400);
  await update(FILE, { items: [] }, (d) => { d.items = d.items.filter((i) => i.id !== id); });
  return json({ ok: true });
}
