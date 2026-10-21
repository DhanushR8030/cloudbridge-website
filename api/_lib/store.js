// Storage for the admin app. Production uses a PRIVATE Vercel Blob store
// (BLOB_READ_WRITE_TOKEN / BLOB_STORE_ID are added automatically when the store
// is connected to the project). CB_LOCAL_STORE=<dir> switches to plain files
// for local testing.
//
// Enquiries are stored one file per month (see enquiries-db.js). Old months
// never need re-downloading, and refreshes only check the current month.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const LOCAL = process.env.CB_LOCAL_STORE;
const ACCESS = 'private';

const blob = () => import('@vercel/blob');
const localEtag = (text) => crypto.createHash('md5').update(text).digest('hex');

export function storeConfigured() {
  return Boolean(LOCAL || process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/**
 * Read a JSON file. Returns { data, etag }, or null when it does not exist.
 * With ifNoneMatch, returns { notModified: true, etag } when unchanged, so
 * nothing is downloaded.
 */
export async function read(pathname, { ifNoneMatch } = {}) {
  if (LOCAL) {
    try {
      const text = await fs.readFile(path.join(LOCAL, pathname), 'utf8');
      const etag = localEtag(text);
      if (ifNoneMatch && ifNoneMatch === etag) return { notModified: true, etag };
      return { data: JSON.parse(text), etag };
    } catch { return null; }
  }
  const { get } = await blob();
  const res = await get(pathname, { access: ACCESS, useCache: false, ...(ifNoneMatch ? { ifNoneMatch } : {}) });
  if (!res) return null;
  if (res.statusCode === 304) return { notModified: true, etag: res.blob.etag };
  if (res.statusCode !== 200) return null;
  const text = await new Response(res.stream).text();
  return { data: JSON.parse(text), etag: res.blob.etag };
}

/**
 * Write a JSON file.
 *  - create: true  -> fail if the file already exists
 *  - ifMatch: etag -> fail if someone else changed it since we read it
 */
export async function write(pathname, data, { create = false, ifMatch } = {}) {
  const text = JSON.stringify(data);
  if (LOCAL) {
    const file = path.join(LOCAL, pathname);
    await fs.mkdir(path.dirname(file), { recursive: true });
    let current = null;
    try { current = await fs.readFile(file, 'utf8'); } catch { /* missing */ }
    if (create && current !== null) throw Object.assign(new Error('exists'), { conflict: true });
    if (ifMatch && (current === null || localEtag(current) !== ifMatch)) throw Object.assign(new Error('changed'), { conflict: true });
    await fs.writeFile(file, text);
    return;
  }
  const { put } = await blob();
  try {
    await put(pathname, text, {
      access: ACCESS,
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: !create,
      ...(ifMatch ? { ifMatch } : {}),
      cacheControlMaxAge: 60,
    });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/exist|precondition|etag|412|409|conflict/i.test(msg)) throw Object.assign(new Error(msg), { conflict: true });
    throw err;
  }
}

export async function remove(pathname) {
  if (LOCAL) { await fs.rm(path.join(LOCAL, pathname), { force: true }); return; }
  const { del } = await blob();
  await del(pathname);
}

/** Read-modify-write with retries, so two writes at the same moment never overwrite each other. */
export async function update(pathname, fallback, change) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await read(pathname);
    const data = cur ? cur.data : structuredClone(fallback);
    const result = await change(data);
    try {
      await write(pathname, data, cur ? { ifMatch: cur.etag } : { create: true });
      return result;
    } catch (err) {
      if (!err.conflict) throw err;
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 220));
    }
  }
  throw new Error('busy');
}
