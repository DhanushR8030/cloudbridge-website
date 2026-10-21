// Admin-only enquiry API.
//   GET                          -> { months: ["2026-10", "2026-09", ...] }
//   GET ?month=2026-10&have=etag -> { items, etag } or { unchanged: true }
//   PATCH { id, status?, notes? }
//   DELETE ?id=...
import { json, readBody, isAdmin, sameOrigin } from '../_lib/http.js';
import { storeConfigured } from '../_lib/store.js';
import { listMonths, readMonth, updateEnquiry, deleteEnquiry, validMonth } from '../_lib/enquiries-db.js';

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
  const q = new URL(request.url).searchParams;
  const month = q.get('month');
  if (!month) return json({ ok: true, months: await listMonths() });
  if (!validMonth(month)) return json({ ok: false, error: 'bad_month' }, 400);
  const r = await readMonth(month, q.get('have'));
  return json({ ok: true, month, ...r });
}

export async function PATCH(request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  let body;
  try { body = await readBody(request, 12000); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!ID.test(body.id || '')) return json({ ok: false, error: 'bad_id' }, 400);
  if (body.status !== undefined && !STATUSES.includes(body.status)) return json({ ok: false, error: 'bad_status' }, 400);
  const item = await updateEnquiry(body.id, (rec) => {
    if (body.status !== undefined) rec.status = body.status;
    if (body.notes !== undefined) rec.notes = String(body.notes).slice(0, 5000);
  });
  if (!item) return json({ ok: false, error: 'not_found' }, 404);
  return json({ ok: true, item });
}

export async function DELETE(request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID.test(id)) return json({ ok: false, error: 'bad_id' }, 400);
  await deleteEnquiry(id);
  return json({ ok: true });
}
