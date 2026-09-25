import { PNG } from 'pngjs';
import fs from 'node:fs';

const png = PNG.sync.read(fs.readFileSync('public/logo-original.png'));
const { width: W, data } = png;
const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };

// The mark occupies the area above the wordmark.
const X0 = 380, X1 = 660, Y0 = 330, Y1 = 552;

const clamp = (v) => Math.max(0, Math.min(1, v));
function coverage(x, y) {
  const [r, g] = px(x, y);
  const chroma = g - r;
  const green = clamp(chroma / 115);
  const dark = chroma < 30 ? clamp((236 - r) / (236 - 38)) : 0;
  return { green, dark };
}

const bb = { green: [1e9, 1e9, -1, -1], dark: [1e9, 1e9, -1, -1] };
for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
  const c = coverage(x, y);
  for (const k of ['green', 'dark']) if (c[k] >= 0.5) {
    const b = bb[k]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
}
console.log('bbox', JSON.stringify(bb));
const minX = Math.min(bb.green[0], bb.dark[0]), minY = Math.min(bb.green[1], bb.dark[1]);
const maxX = Math.max(bb.green[2], bb.dark[2]), maxY = Math.max(bb.green[3], bb.dark[3]);
const pad = 3;
const ox = minX - pad, oy = minY - pad;
const vw = maxX - minX + 1 + pad * 2, vh = maxY - minY + 1 + pad * 2;
console.log('viewBox', vw, vh);

function field(kind) {
  const f = new Float32Array(vw * vh);
  for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) f[y * vw + x] = coverage(ox + x, oy + y)[kind];
  return f;
}

function contours(f, level = 0.5) {
  const segs = [];
  const v = (x, y) => f[y * vw + x];
  const lerp = (a, b) => (level - a) / (b - a);
  for (let y = 0; y < vh - 1; y++) for (let x = 0; x < vw - 1; x++) {
    const a = v(x, y), b = v(x + 1, y), c = v(x + 1, y + 1), d = v(x, y + 1);
    const idx = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const top = [x + lerp(a, b), y], right = [x + 1, y + lerp(b, c)], bottom = [x + lerp(d, c), y + 1], left = [x, y + lerp(a, d)];
    const add = (p, q) => segs.push([p, q]);
    switch (idx) {
      case 1: add(left, bottom); break; case 2: add(bottom, right); break; case 3: add(left, right); break;
      case 4: add(top, right); break; case 5: add(top, left); add(bottom, right); break; case 6: add(top, bottom); break;
      case 7: add(top, left); break; case 8: add(top, left); break; case 9: add(top, bottom); break;
      case 10: add(top, right); add(left, bottom); break; case 11: add(top, right); break; case 12: add(left, right); break;
      case 13: add(bottom, right); break; case 14: add(left, bottom); break;
    }
  }
  const key = (p) => p[0].toFixed(3) + ',' + p[1].toFixed(3);
  const map = new Map();
  segs.forEach((s, i) => { for (const p of s) { const k = key(p); if (!map.has(k)) map.set(k, []); map.get(k).push(i); } });
  const used = new Array(segs.length).fill(false), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const loop = [segs[i][0], segs[i][1]];
    for (;;) {
      const last = loop[loop.length - 1];
      const cand = (map.get(key(last)) || []).find((j) => !used[j]);
      if (cand === undefined) break;
      used[cand] = true;
      const s = segs[cand];
      loop.push(key(s[0]) === key(last) ? s[1] : s[0]);
    }
    loops.push(loop);
  }
  return loops.sort((a, b) => b.length - a.length)[0];
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let dmax = 0, idx = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}

function toPath(loop, eps = 0.45) {
  const pts = loop.slice(0, -1);
  const half = Math.floor(pts.length / 2);
  const s = rdp(pts.slice(0, half + 1), eps).slice(0, -1).concat(rdp(pts.slice(half).concat([pts[0]]), eps).slice(0, -1));
  const f = (n) => (Math.round(n * 10) / 10).toString();
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const n = s.length;
  let d = 'M' + mid(s[n - 1], s[0]).map(f).join(' ');
  for (let i = 0; i < n; i++) {
    const c = s[i], e = mid(s[i], s[(i + 1) % n]);
    d += 'Q' + c.map(f).join(' ') + ' ' + e.map(f).join(' ');
  }
  return d + 'Z';
}

const greenPath = toPath(contours(field('green')));
const darkPath = toPath(contours(field('dark')));

const GRID = 176;
const S = Math.max(vw, vh);
const cxm = vw / 2, cym = vh / 2;
function mask(kind) {
  const bytes = new Uint8Array(Math.ceil(GRID * GRID / 8));
  const f = field(kind);
  for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
    const x = cxm + ((gx + 0.5) / GRID - 0.5) * S, y = cym + ((gy + 0.5) / GRID - 0.5) * S;
    const ix = Math.round(x - 0.5), iy = Math.round(y - 0.5);
    if (ix < 0 || iy < 0 || ix >= vw || iy >= vh) continue;
    if (f[iy * vw + ix] >= 0.5) { const bit = gy * GRID + gx; bytes[bit >> 3] |= 128 >> (bit & 7); }
  }
  return Buffer.from(bytes).toString('base64');
}

const out = `// Generated by scripts/extract-logo.mjs from public/logo-original.png - do not edit by hand.
export const LOGO = {
  width: ${vw},
  height: ${vh},
  size: ${S},
  grid: ${GRID},
  greenPath: '${greenPath}',
  darkPath: '${darkPath}',
  greenMask: '${mask('green')}',
  darkMask: '${mask('dark')}',
};
`;
fs.writeFileSync('src/logo-data.js', out);
fs.writeFileSync('public/favicon.svg',
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw + 28} ${vh + 28}"><rect width="${vw + 28}" height="${vh + 28}" rx="34" fill="#fff"/><g transform="translate(14 14)"><path fill="#2ca24a" d="${greenPath}"/><path fill="#25292e" d="${darkPath}"/></g></svg>`);
console.log('ok', out.length, 'bytes');
