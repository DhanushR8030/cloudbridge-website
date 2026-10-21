// Enquiry storage, split into one file per month:
//   data/enq/2026-10.json  -> { items: [newest first...] }
//   data/meta.json         -> { firstMonth: "2026-10" }
// There is no limit on the total number of enquiries. Each save or edit
// touches one small month file, and the admin app only re-checks the current
// month when it refreshes, so it stays fast as enquiries pile up.
import { read, update, remove } from './store.js';

const META = 'data/meta.json';
const LEGACY = 'data/enquiries.json';
const IST_MS = 5.5 * 3600 * 1000;

export const monthOf = (ms) => new Date(Number(ms) + IST_MS).toISOString().slice(0, 7);
export const monthOfId = (id) => monthOf(String(id).split('-')[0]);
const monthPath = (m) => `data/enq/${m}.json`;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const validMonth = (m) => MONTH.test(m || '');

let firstMonthCache = null;
let legacyChecked = false;

async function ensureFirstMonth(month) {
  if (firstMonthCache && firstMonthCache <= month) return;
  await update(META, {}, (d) => {
    if (!d.firstMonth || month < d.firstMonth) d.firstMonth = month;
    firstMonthCache = d.firstMonth;
  });
}

/** Move enquiries from the earlier single-file format into month files (runs once). */
async function migrateLegacy() {
  if (legacyChecked) return;
  legacyChecked = true;
  const old = await read(LEGACY).catch(() => null);
  if (!old?.data?.items?.length) { if (old) await remove(LEGACY).catch(() => {}); return; }
  const byMonth = {};
  for (const it of old.data.items) (byMonth[monthOfId(it.id)] ||= []).push(it);
  for (const [m, list] of Object.entries(byMonth)) {
    await update(monthPath(m), { items: [] }, (d) => {
      const have = new Set(d.items.map((i) => i.id));
      d.items.push(...list.filter((i) => !have.has(i.id)));
      d.items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    });
    await ensureFirstMonth(m);
  }
  await remove(LEGACY).catch(() => {});
}

export async function addEnquiry(record) {
  const m = monthOf(Date.parse(record.createdAt));
  await update(monthPath(m), { items: [] }, (d) => { d.items.unshift(record); });
  await ensureFirstMonth(m);
}

/** Every month that can hold enquiries, newest first. */
export async function listMonths() {
  await migrateLegacy();
  const meta = await read(META).catch(() => null);
  const current = monthOf(Date.now());
  const first = meta?.data?.firstMonth;
  if (!first) return [];
  firstMonthCache = first;
  const out = [];
  let [y, mo] = current.split('-').map(Number);
  for (let guard = 0; guard < 600; guard++) {
    const m = `${y}-${String(mo).padStart(2, '0')}`;
    out.push(m);
    if (m <= first) break;
    mo -= 1; if (mo === 0) { mo = 12; y -= 1; }
  }
  return out;
}

/** One month's enquiries. Pass the etag you already have to skip downloading unchanged data. */
export async function readMonth(month, have) {
  const r = await read(monthPath(month), { ifNoneMatch: have || undefined });
  if (!r) return { items: [], etag: null };
  if (r.notModified) return { unchanged: true, etag: r.etag };
  return { items: r.data.items || [], etag: r.etag };
}

export async function updateEnquiry(id, change) {
  return update(monthPath(monthOfId(id)), { items: [] }, (d) => {
    const rec = d.items.find((i) => i.id === id);
    if (!rec) return null;
    change(rec);
    rec.updatedAt = new Date().toISOString();
    return rec;
  });
}

export async function deleteEnquiry(id) {
  await update(monthPath(monthOfId(id)), { items: [] }, (d) => { d.items = d.items.filter((i) => i.id !== id); });
}

