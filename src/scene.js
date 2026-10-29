import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  ShaderMaterial, Points, NormalBlending, Vector2, Vector3, Vector4, LineSegments, LineBasicMaterial,
} from 'three';
import { LOGO } from './logo-data.js';

const BG = 0xffffff;
const FOV = 38;
const SHAPES = 8; // logo, globe, bridge, terrain, phone, laptop, gears, code
const CAM_Z = 9;

const TIERS = {
  low: { count: 16000, dpr: 1, size: 3.3, mouse: false },
  mid: { count: 40000, dpr: 1.5, size: 2.9, mouse: true },
  high: { count: 90000, dpr: 2, size: 2.7, mouse: true },
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- helpers */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellsFromMask(b64) {
  const bin = atob(b64), n = LOGO.grid, cells = [];
  for (let bit = 0; bit < n * n; bit++) if (bin.charCodeAt(bit >> 3) & (128 >> (bit & 7))) cells.push(bit);
  return cells;
}

// A point on the outline of a rounded rectangle centred on 0,0.
function onRoundRect(w, h, r, u) {
  const sw = w - 2 * r, sh = h - 2 * r, arc = (Math.PI / 2) * r;
  let d = u * (2 * sw + 2 * sh + 4 * arc);
  const at = (cx, cy, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  if (d < sw) return [-sw / 2 + d, h / 2]; d -= sw;
  if (d < arc) return at(sw / 2, sh / 2, Math.PI / 2 - d / r); d -= arc;
  if (d < sh) return [w / 2, sh / 2 - d]; d -= sh;
  if (d < arc) return at(sw / 2, -sh / 2, -d / r); d -= arc;
  if (d < sw) return [sw / 2 - d, -h / 2]; d -= sw;
  if (d < arc) return at(-sw / 2, -sh / 2, -Math.PI / 2 - d / r); d -= arc;
  if (d < sh) return [-w / 2, -sh / 2 + d]; d -= sh;
  return at(-sw / 2, sh / 2, Math.PI - Math.min(d, arc) / r);
}
// An app icon: mostly its rounded outline, some fill.
function iconPoint(rand, s) {
  if (rand() < 0.62) return onRoundRect(s, s, s * 0.28, rand());
  return [(rand() - 0.5) * s * 0.8, (rand() - 0.5) * s * 0.8];
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function detectTier(gl) {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  let renderer = '';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer) || mem <= 2 || cores <= 2) return 'low';
  if (coarse || mem <= 4 || cores <= 4 || /Intel.*(HD|UHD) Graphics|Mali-[T4G]|Adreno \(TM\) [2-5]\d\d/i.test(renderer)) return 'mid';
  return 'high';
}

/* ------------------------------------------------------------ shape data */

function buildShapes(N) {
  const rand = mulberry32(20260921);
  const P = Array.from({ length: SHAPES }, () => new Float32Array(N * 3));
  const color = new Float32Array(N * 3);
  const rnd = new Float32Array(N * 4);
  const dust = new Float32Array(N);

  const gCells = cellsFromMask(LOGO.greenMask), dCells = cellsFromMask(LOGO.darkMask);
  const grid = LOGO.grid, k = 3.75 / LOGO.size;

  const put = (s, i, x, y, z) => { P[s][i * 3] = x; P[s][i * 3 + 1] = y; P[s][i * 3 + 2] = z; };
  const rotX = (y, z, a) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];

  const LATS = [-1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05];
  const ringTilt = [[0.5, 0.25], [-0.65, 0.95], [1.15, -0.45]];
  const columnStep = 0.42;

  for (let i = 0; i < N; i++) {
    rnd[i * 4] = rand(); rnd[i * 4 + 1] = rand(); rnd[i * 4 + 2] = rand(); rnd[i * 4 + 3] = rand();

    // ---- ambient dust: identical in every shape so it never morphs
    if (rand() < 0.13) {
      dust[i] = 1;
      const r = 3.3 + Math.pow(rand(), 0.85) * 6.2, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      const x = r * Math.sin(ph) * Math.cos(th), y = r * Math.sin(ph) * Math.sin(th) * 0.72, z = r * Math.cos(ph) * 0.5 - 2;
      for (let s = 0; s < SHAPES; s++) put(s, i, x, y, z);
      const b = 0.5 + rand() * 0.25;
      color[i * 3] = b * 0.8; color[i * 3 + 1] = b * 0.95; color[i * 3 + 2] = b * 0.86;
      continue;
    }

    // ---- 0: the logo, sampled from the real mark
    {
      const green = rand() < 0.5;
      const cells = green ? gCells : dCells;
      const c = cells[(rand() * cells.length) | 0];
      const u = ((c % grid) + rand()) / grid - 0.5, v = (((c / grid) | 0) + rand()) / grid - 0.5;
      const x = u * LOGO.size * k, y = -v * LOGO.size * k;
      const z = (green ? -1 : 1) * u * 0.85 + (rand() - 0.5) * 0.3;
      put(0, i, x, y, z);
      const t = 0.85 + rand() * 0.3;
      if (green) { color[i * 3] = 0.13 * t; color[i * 3 + 1] = 0.64 * t; color[i * 3 + 2] = 0.27 * t; }
      else { const d = 0.8 + rand() * 0.5; color[i * 3] = 0.13 * d; color[i * 3 + 1] = 0.15 * d; color[i * 3 + 2] = 0.17 * d; }
    }

    // ---- 1: wireframe globe with orbits and satellites
    {
      const t = rand();
      let x, y, z;
      const onSphere = (lat, lon, R) => [R * Math.cos(lat) * Math.cos(lon), R * Math.sin(lat), R * Math.cos(lat) * Math.sin(lon)];
      if (t < 0.3) {
        [x, y, z] = onSphere(Math.asin(2 * rand() - 1), rand() * 6.2832, 1.7);
      } else if (t < 0.52) {
        [x, y, z] = onSphere(LATS[(rand() * LATS.length) | 0] * 0.95, rand() * 6.2832, 1.75);
      } else if (t < 0.64) {
        [x, y, z] = onSphere((rand() - 0.5) * 3.1416, ((rand() * 12) | 0) * (Math.PI / 6), 1.75);
      } else if (t < 0.88) {
        const [ax, az] = ringTilt[(rand() * 3) | 0], a = rand() * 6.2832;
        let px = Math.cos(a) * 2.25, py = 0, pz = Math.sin(a) * 2.25;
        [py, pz] = rotX(py, pz, ax);
        const cz = Math.cos(az), sz = Math.sin(az);
        [x, y, z] = [px * cz - py * sz, px * sz + py * cz, pz];
      } else {
        [x, y, z] = onSphere(Math.asin(2 * rand() - 1), rand() * 6.2832, 2.4 + rand() * 0.9);
      }
      put(1, i, x, y, z);
    }

    // ---- 2: suspension bridge over water
    {
      const t = rand();
      const deckY = -0.55, towerX = 1.35, towerTop = 1.55;
      let x, y, z;
      if (t < 0.2) { x = (rand() - 0.5) * 6.4; y = deckY + (rand() - 0.5) * 0.05; z = (rand() - 0.5) * 0.62; }
      else if (t < 0.34) { x = (rand() < 0.5 ? -1 : 1) * towerX; y = deckY + rand() * (towerTop - deckY); z = (rand() < 0.5 ? -1 : 1) * 0.28; }
      else if (t < 0.5) { const s = rand() * 2 - 1; x = towerX * s; y = 0.5 + 1.05 * s * s; z = (rand() < 0.5 ? -1 : 1) * 0.28; }
      else if (t < 0.6) { const s = rand(), side = rand() < 0.5 ? -1 : 1; x = side * (towerX + s * 1.85); y = towerTop - (towerTop - deckY) * Math.pow(s, 1.5); z = (rand() < 0.5 ? -1 : 1) * 0.28; }
      else if (t < 0.74) { x = (Math.round(((rand() * 2 - 1) * towerX) / 0.2) * 0.2); const cable = 0.5 + 1.05 * (x / towerX) ** 2; y = deckY + rand() * (cable - deckY); z = (rand() < 0.5 ? -1 : 1) * 0.28; }
      else { x = (rand() - 0.5) * 7; z = (rand() - 0.5) * 2.6; y = -1.3 + 0.07 * Math.sin(x * 3 + z * 2.2); }
      put(2, i, x * 0.66, (y - 0.15) * 0.66, z * 0.66);
    }

    // ---- 3: wireframe terrain with a skyline of columns (foundations)
    {
      const t = rand();
      let x, y, z;
      if (t < 0.7) {
        const step = 0.42;
        if (rand() < 0.5) { x = (rand() - 0.5) * 6.6; z = Math.round(((rand() - 0.5) * 5.2) / step) * step; }
        else { z = (rand() - 0.5) * 5.2; x = Math.round(((rand() - 0.5) * 6.6) / step) * step; }
        y = -0.9 + 0.3 * Math.sin(x * 1.1 + 0.6) * Math.cos(z * 0.9);
      } else {
        x = Math.round(((rand() - 0.5) * 5.4) / columnStep) * columnStep;
        z = Math.round(((rand() - 0.5) * 4.2) / columnStep) * columnStep;
        const h = 0.2 + 1.55 * Math.pow(Math.abs(Math.sin(x * 1.7 + z * 0.9) * Math.cos(x * 0.6 - z * 1.3)), 1.4);
        y = -0.9 + 0.3 * Math.sin(x * 1.1 + 0.6) * Math.cos(z * 0.9) + rand() * h;
        x += (rand() - 0.5) * 0.03; z += (rand() - 0.5) * 0.03;
      }
      [y, z] = rotX(y, z, -0.5);
      put(3, i, x * 0.72, (y + 0.2) * 0.72, z * 0.72);
    }

    // ---- 4: smartphone with app grid and floating notifications
    {
      const t = rand(), d = 0.2;
      let x, y, z;
      if (t < 0.24) { [x, y] = onRoundRect(1.8, 3.4, 0.3, rand()); z = (rand() < 0.5 ? -1 : 1) * d / 2; }
      else if (t < 0.32) { [x, y] = onRoundRect(1.8, 3.4, 0.3, rand()); z = (rand() - 0.5) * d; }
      else if (t < 0.66) {
        const c = (rand() * 4) | 0, r = (rand() * 5) | 0;
        [x, y] = iconPoint(rand, 0.3); x += -0.6 + c * 0.4; y += 1.05 - r * 0.44; z = d / 2 + 0.02;
      } else if (t < 0.75) {
        const c = (rand() * 4) | 0; [x, y] = iconPoint(rand, 0.3); x += -0.6 + c * 0.4; y += -1.2; z = d / 2 + 0.02;
      } else if (t < 0.8) {
        const top = rand() < 0.5; x = (rand() - 0.5) * (top ? 0.5 : 0.62); y = top ? 1.52 : -1.52; y += (rand() - 0.5) * 0.04; z = d / 2 + 0.02;
      } else {
        const right = rand() < 0.55, cw = 1.35, chh = 0.4;
        const cx = right ? 1.05 : -1.0, cy = right ? 0.62 : -0.38, cz = right ? 0.55 : 0.75;
        if (rand() < 0.55) [x, y] = onRoundRect(cw, chh, 0.1, rand());
        else { const row = rand() < 0.5 ? 0.07 : -0.08; x = -cw / 2 + 0.36 + rand() * (row > 0 ? 0.75 : 0.5); y = row; }
        if (rand() < 0.12) { const [ix, iy] = iconPoint(rand, 0.2); x = -cw / 2 + 0.17 + ix; y = iy; }
        x += cx; y += cy; z = cz;
      }
      const ca = Math.cos(-0.32), sa = Math.sin(-0.32);
      put(4, i, (x * ca + z * sa) * 0.92, y * 0.92, (-x * sa + z * ca) * 0.92);
    }

    // ---- 5: laptop with code on the screen
    {
      const t = rand();
      let x, y, z;
      if (t < 0.17) { [x, y] = onRoundRect(3.3, 2.1, 0.08, rand()); y += 1.05; z = 0; }
      else if (t < 0.5) {
        const row = (rand() * 11) | 0;
        const indent = ((row * 7) % 4) * 0.2, len = 0.5 + ((row * 13) % 7) * 0.2;
        const split = (row * 5) % 3 === 0;
        let u = rand() * len;
        if (split && u > len * 0.45) u += 0.12;
        x = -1.4 + indent + u; y = 1.88 - row * 0.155 + (rand() - 0.5) * 0.02; z = 0.01;
      } else if (t < 0.6) {
        x = (rand() - 0.5) * 3.3; y = rand() * 2.1; z = -0.05;
      } else if (t < 0.85) {
        const kr = (rand() * 5) | 0, kc = (rand() * 13) | 0;
        x = -1.38 + kc * 0.23 + (rand() - 0.5) * 0.15; z = 0.28 + kr * 0.2 + (rand() - 0.5) * 0.13; y = 0;
      } else if (t < 0.92) { [x, z] = onRoundRect(1.0, 0.6, 0.06, rand()); z += 1.62; y = 0; }
      else { [x, z] = onRoundRect(3.5, 2.2, 0.12, rand()); z += 1.1; y = 0; }
      if (t < 0.6) [y, z] = rotX(y, z, -0.22);
      y -= 0.75; z -= 0.9;
      [y, z] = rotX(y, z, 0.42);
      put(5, i, x * 0.8, (y + 0.05) * 0.8, z * 0.8);
    }

    // ---- 6: two meshing gears
    {
      const big = rand() < 0.64;
      const R = big ? 1.25 : 0.78, teeth = big ? 14 : 9, cx = big ? -0.55 : 1.33, cy = big ? 0.28 : -0.66, off = big ? 0 : Math.PI / 9;
      const d = big ? 0.34 : 0.28, depthR = 0.24;
      const t = rand();
      let r, a, z;
      if (t < 0.46) {
        a = rand() * 6.2832;
        const f = ((((a - off) * teeth) / 6.2832) % 1 + 1) % 1;
        r = f < 0.5 ? R : R - depthR;
        z = (rand() < 0.5 ? -1 : 1) * d / 2;
      } else if (t < 0.62) {
        const k = (rand() * teeth) | 0;
        a = off + ((k + (rand() < 0.5 ? 0 : 0.5)) * 6.2832) / teeth;
        r = R - depthR + rand() * depthR; z = (rand() - 0.5) * d;
      } else if (t < 0.74) { a = rand() * 6.2832; r = (R - depthR) * 0.72; z = (rand() < 0.5 ? -1 : 1) * d / 2; }
      else if (t < 0.86) { a = rand() * 6.2832; r = R * 0.22; z = (rand() - 0.5) * d * 1.6; }
      else { const k = (rand() * 5) | 0; a = off + (k * 6.2832) / 5 + (rand() - 0.5) * 0.06; r = R * 0.22 + rand() * ((R - depthR) * 0.72 - R * 0.22); z = (rand() < 0.5 ? -1 : 1) * d / 2; }
      put(6, i, (cx + r * Math.cos(a)) * 0.95, (cy + r * Math.sin(a)) * 0.95, z);
    }

    // ---- 7: code brackets </> with a cloud of code dashes behind
    {
      const segs = [[-0.55, 0.95, -1.55, 0], [-1.55, 0, -0.55, -0.95], [0.38, 1.2, -0.38, -1.2], [0.55, 0.95, 1.55, 0], [1.55, 0, 0.55, -0.95]];
      let x, y, z;
      if (rand() < 0.76) {
        const sg = segs[(rand() * segs.length) | 0], u = rand();
        const dx = sg[2] - sg[0], dy = sg[3] - sg[1], L = Math.hypot(dx, dy);
        const side = rand() < 0.5 ? -1 : 1, w = 0.11;
        x = sg[0] + dx * u - (dy / L) * side * w; y = sg[1] + dy * u + (dx / L) * side * w;
        z = (rand() < 0.65 ? (rand() < 0.5 ? -1 : 1) * 0.16 : (rand() - 0.5) * 0.32);
      } else {
        let row, col, tries = 0;
        do { row = ((rand() * 14) | 0) - 7; col = ((rand() * 9) | 0) - 4; } while ((col / 4.6) ** 2 + (row / 7.4) ** 2 > 1 && ++tries < 6);
        const len = 0.18 + (((row * 31 + col * 17) % 5 + 5) % 5) * 0.07;
        x = col * 0.55 + rand() * len; y = row * 0.28; z = -1.1 - (((row + col) % 3 + 3) % 3) * 0.25;
      }
      put(7, i, x * 0.95, y * 0.95, z);
    }
  }
  return { P, color, rnd, dust };
}

/* --------------------------------------------------------- network globe */
// A small precomputed wireframe sphere (fibonacci point set + nearest-neighbour
// edges) that fades in only while the globe shape is active - a cheap, static
// mesh, so it adds negligible cost even though it looks technically involved.
function buildNetworkGlobe(count, radius) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]);
  }
  const edgeSet = new Set();
  const positions = [];
  for (let i = 0; i < count; i++) {
    const dists = [];
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dz = pts[i][2] - pts[j][2];
      dists.push([dx * dx + dy * dy + dz * dz, j]);
    }
    dists.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 3; k++) {
      const j = dists[k][1];
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      positions.push(...pts[i], ...pts[j]);
    }
  }
  return new Float32Array(positions);
}

/* ---------------------------------------------------------------- shaders */

const VERT = /* glsl */`
attribute vec3 aP1; attribute vec3 aP2; attribute vec3 aP3;
attribute vec3 aP4; attribute vec3 aP5; attribute vec3 aP6; attribute vec3 aP7;
attribute vec3 aColor; attribute vec4 aRand; attribute float aDust;
uniform vec4 uW; uniform vec4 uW2; uniform vec3 uShock; uniform float uSwirl; uniform float uTime; uniform float uEnergy; uniform float uSize;
uniform float uPR; uniform float uOpacity; uniform vec2 uMouse; uniform float uMouseOn; uniform float uAspect;
varying vec3 vColor; varying float vA;
void main() {
  vec3 p = position * uW.x + aP1 * uW.y + aP2 * uW.z + aP3 * uW.w
        + aP4 * uW2.x + aP5 * uW2.y + aP6 * uW2.z + aP7 * uW2.w;
  float ph = aRand.z * 6.2831;
  p += 0.03 * vec3(sin(uTime * 0.6 + ph), cos(uTime * 0.5 + ph * 1.3), sin(uTime * 0.4 + ph * 0.7)) * (1.0 + aDust * 4.0);
  float e = uEnergy * (1.0 - aDust * 0.7);
  vec3 dir = vec3(cos(ph * 3.0), sin(ph * 2.0), cos(ph * 5.0));
  p += dir * e * (0.6 + aRand.w * 2.6);
  // vortex: while morphing, particles spiral around the centre (inner ones faster)
  float rr = length(p.xy);
  float va = uSwirl * (1.6 + aRand.w) * exp(-rr * 0.38);
  float vc = cos(va), vs = sin(va);
  p.xy = mat2(vc, -vs, vs, vc) * p.xy;
  p.z += uSwirl * (aRand.y - 0.5) * 1.4;
  float ang = e * 2.0 * (aRand.w - 0.3);
  float cs = cos(ang), sn = sin(ang);
  p.xz = mat2(cs, -sn, sn, cs) * p.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 dm = clip.xy / clip.w - uMouse; dm.x *= uAspect;
  float md = length(dm);
  mv.xy += (dm / (md + 0.001)) * uMouseOn * smoothstep(0.32, 0.0, md) * 0.32;
  // click shockwave: an expanding ring that pushes particles outward and forward
  vec2 ds = clip.xy / clip.w - uShock.xy; ds.x *= uAspect;
  float sd = length(ds);
  float ring = exp(-pow((sd - uShock.z * 1.5) * 6.0, 2.0)) * max(0.0, 1.0 - uShock.z / 1.2);
  mv.xy += (ds / (sd + 0.001)) * ring * 0.42;
  mv.z += ring * 0.9;
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float size = uSize * (0.55 + aRand.x * 0.95) * (1.0 - aDust * 0.5) * (1.0 + e * 0.55);
  gl_PointSize = clamp(size * uPR * (${CAM_Z}.0 / depth), 1.0, 30.0 * uPR);
  vec3 c2 = mix(vec3(0.13, 0.64, 0.28), vec3(0.14, 0.17, 0.19), smoothstep(0.5, 0.72, aRand.y));
  vColor = mix(aColor, c2, 1.0 - uW.x);
  float twinkle = mix(1.0, 0.7 + 0.3 * sin(uTime * 1.3 + ph * 9.0), aDust);
  vA = uOpacity * clamp(1.2 - (depth - 5.0) / 11.0, 0.25, 1.0) * mix(1.0, 0.5, aDust) * (0.72 + 0.28 * aRand.x) * twinkle;
}`;

const FRAG = /* glsl */`
varying vec3 vColor; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.3, d);
  gl_FragColor = vec4(vColor, a * vA);
}`;

/* ------------------------------------------------------------------ scene */

function softwareGpu(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
  return /swiftshader|llvmpipe|software|basic render/i.test(r);
}

// Returns false when this device can't run the animation smoothly, so the
// caller shows the static background instead.
export function initScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, depth: false });
  const forced = new URLSearchParams(location.search).get('quality');
  // No real graphics chip: the CPU would have to draw every frame, which
  // freezes the page on phones. Use the static background.
  if (!TIERS[forced] && softwareGpu(renderer.getContext())) { renderer.dispose(); return false; }
  const tierName = TIERS[forced] ? forced : detectTier(renderer.getContext());
  const tier = { ...TIERS[tierName] };
  document.documentElement.dataset.sceneTier = tierName;

  renderer.setClearColor(BG, 1);
  let dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.z = CAM_Z;

  const { P, color, rnd, dust } = buildShapes(tier.count);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(P[0], 3));
  geo.setAttribute('aP1', new BufferAttribute(P[1], 3));
  geo.setAttribute('aP2', new BufferAttribute(P[2], 3));
  geo.setAttribute('aP3', new BufferAttribute(P[3], 3));
  for (let k = 4; k < SHAPES; k++) geo.setAttribute('aP' + k, new BufferAttribute(P[k], 3));
  geo.setAttribute('aColor', new BufferAttribute(color, 3));
  geo.setAttribute('aRand', new BufferAttribute(rnd, 4));
  geo.setAttribute('aDust', new BufferAttribute(dust, 1));

  const uniforms = {
    uW: { value: new Vector4(1, 0, 0, 0) }, uW2: { value: new Vector4(0, 0, 0, 0) },
    uShock: { value: new Vector3(0, 0, 9) }, uSwirl: { value: 0 },
    uTime: { value: 0 }, uEnergy: { value: 0 }, uSize: { value: tier.size },
    uPR: { value: dpr }, uOpacity: { value: 1 },
    uMouse: { value: new Vector2(9, 9) }, uMouseOn: { value: 0 }, uAspect: { value: 1 },
  };
  const material = new ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: NormalBlending,
  });
  const points = new Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  let netGlobe = null;
  if (tierName !== 'low' && !reduceMotion) {
    const gCount = tierName === 'high' ? 170 : 120;
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute('position', new BufferAttribute(buildNetworkGlobe(gCount, 1.78), 3));
    const lineMat = new LineBasicMaterial({ color: 0x2fb350, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
    netGlobe = new LineSegments(lineGeo, lineMat);
    netGlobe.frustumCulled = false;
    points.add(netGlobe);
  }

  /* ---- size handling */
  let cw = 1, ch = 1, sizeFactor = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === cw && h === ch) return;
    cw = w; ch = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = w / h;
    sizeFactor = Math.min(1.5, Math.max(0.7, h / 900));
    keyframesDirty = true;
  }

  /* ---- scroll-driven keyframes from [data-shape] sections */
  let keyframes = [], keyframesDirty = true;
  const fs = parseInt(new URLSearchParams(location.search).get('shape'), 10);
  const forceShape = fs >= 0 && fs < SHAPES ? fs : null; // ?shape=N previews one shape
  function readKeyframes() {
    const narrow = innerWidth < 860;
    keyframes = [...document.querySelectorAll('[data-shape]')].map((el) => {
      const r = el.getBoundingClientRect(), d = el.dataset, hero = 'hero' in d;
      const kf = {
        y: r.top + scrollY + r.height / 2,
        shape: forceShape ?? Math.max(0, Math.min(SHAPES - 1, parseInt(d.shape, 10) || 0)),
        x: narrow ? 0 : parseFloat(d.x || 0),
        oy: narrow ? (hero ? 0.28 : 0.02) : parseFloat(d.y || 0),
        s: (parseFloat(d.scale || 1)) * (narrow ? (hero ? 0.7 : 0.82) : 1),
        dim: narrow && !hero ? Math.min(parseFloat(d.dim || 1), 0.3) : parseFloat(d.dim || 1),
      };
      // Centred hero: size and place the shape in the free space above the text block.
      const block = 'fit' in d && el.querySelector('.hero__center');
      if (block) {
        const top = block.getBoundingClientRect().top + scrollY, header = 76;
        const avail = Math.max(140, top - header - 26);
        kf.s = Math.min(1.25, Math.max(0.4, (avail * 1.653 * 0.93) / ch));
        kf.oy = 0.5 - (header + 10 + avail / 2) / ch;
        kf.x = 0;
      }
      return kf;
    });
    if (!keyframes.length) keyframes = [{ y: 0, shape: 0, x: 0, oy: 0, s: 1, dim: 1 }];
    keyframesDirty = false;
  }

  const w = new Array(SHAPES).fill(0); w[0] = 1;
  const cur = { x: 0, oy: 0, s: 1, dim: 1 };
  let firstFrame = true;

  function scrollTarget() {
    const pos = scrollY + innerHeight * 0.5;
    let a = keyframes[0], b = keyframes[0], f = 0;
    for (let i = 0; i < keyframes.length; i++) {
      if (pos >= keyframes[i].y) {
        a = keyframes[i]; b = keyframes[Math.min(i + 1, keyframes.length - 1)];
        f = b.y > a.y ? Math.min(1, (pos - a.y) / (b.y - a.y)) : 0;
      }
    }
    const e = smooth(0.3, 0.7, f);
    const tw = new Array(SHAPES).fill(0);
    tw[a.shape] += 1 - e; tw[b.shape] += e;
    const mix = (p, q) => p + (q - p) * e;
    return { tw, x: mix(a.x, b.x), oy: mix(a.oy, b.oy), s: mix(a.s, b.s), dim: mix(a.dim, b.dim) };
  }

  /* ---- pointer */
  const mouse = new Vector2(9, 9), mouseT = new Vector2(9, 9);
  let mouseOnT = 0;
  if (tier.mouse && !reduceMotion) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      mouseT.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
      mouseOnT = 1;
    }, { passive: true });
    document.addEventListener('mouseleave', () => { mouseOnT = 0; });
  }
  const look = new Vector2(), ZERO = new Vector2();
  let lastY = scrollY, velS = 0, shockAge = 9, swirlS = 0, swirlDir = 1, lastSwirlY = scrollY;
  if (tierName !== 'low' && !reduceMotion) {
    addEventListener('pointerdown', (e) => {
      uniforms.uShock.value.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1), 0);
      shockAge = 0;
    }, { passive: true });
  }

  /* ---- adaptive quality */
  let drawCount = tier.count, slowTime = 0, slowFrames = 0, calm = 0;
  function degrade() {
    if (drawCount > 4500) {
      drawCount = Math.max(4500, Math.floor(drawCount * 0.7));
      geo.setDrawRange(0, drawCount);
      uniforms.uSize.value = tier.size * (1 + (1 - drawCount / tier.count) * 0.55);
    } else if (dpr > 1) {
      dpr = 1; renderer.setPixelRatio(1); uniforms.uPR.value = 1; cw = 0;
      resize();
    } else if (++strikes >= 2) {
      giveUp();
    }
  }
  // Still choppy at the lowest quality: stop drawing and fade back to the
  // static background, so scrolling and taps stay smooth.
  let strikes = 0;
  function giveUp() {
    running = false;
    const root = document.documentElement;
    root.classList.remove('scene-ready');
    root.classList.add('no-webgl');
    setTimeout(() => { ro.disconnect(); geo.dispose(); material.dispose(); renderer.dispose(); }, 1500);
  }
  // Low-end devices: 30 frames a second is plenty and halves the work.
  const minGap = tierName === 'low' ? 1000 / 31 : 0;
  let lastDraw = 0;

  /* ---- loop */
  let last = performance.now(), time = 0, running = true, intro = reduceMotion ? 0 : 1;
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    if (document.hidden) { last = now; return; }
    if (minGap && now - lastDraw < minGap) return;
    lastDraw = now;
    const rawDt = (now - last) / 1000;
    last = now;
    const dt = Math.min(rawDt, 0.1);

    if (rawDt < 0.25 && !firstFrame) {
      slowTime += rawDt; slowFrames++;
      if (slowTime > 1.4) {
        const avg = slowTime / slowFrames;
        if (avg > (minGap ? 1 / 22 : 1 / 36)) { calm = 0; degrade(); } else calm++;
        slowTime = 0; slowFrames = 0;
      }
    }

    if (keyframesDirty) readKeyframes();
    const tg = scrollTarget();
    const kf = firstFrame || reduceMotion ? 1 : 1 - Math.exp(-dt * 3.4);
    for (let i = 0; i < SHAPES; i++) w[i] += (tg.tw[i] - w[i]) * kf;
    cur.x += (tg.x - cur.x) * kf; cur.oy += (tg.oy - cur.oy) * kf;
    cur.s += (tg.s - cur.s) * kf; cur.dim += (tg.dim - cur.dim) * kf;

    if (!reduceMotion) time += dt;
    uniforms.uTime.value = time;
    uniforms.uW.value.set(w[0], w[1], w[2], w[3]);
    uniforms.uW2.value.set(w[4], w[5], w[6], w[7]);
    if (intro > 0 && !document.documentElement.classList.contains('preloading')) intro = Math.max(0, intro - dt / 2.6);
    const introE = intro * intro * (3 - 2 * intro);
    // fast scrolling makes the particles scatter a little
    const sy = scrollY, vel = Math.abs(sy - lastY) / Math.max(dt, 0.001) / innerHeight; lastY = sy;
    velS += (Math.min(vel, 6) - velS) * (1 - Math.exp(-dt * 5));
    const scrollKick = reduceMotion ? 0 : Math.min(0.14, velS * 0.035);
    uniforms.uEnergy.value = Math.max(introE, Math.min(1, (1 - Math.max(...w)) * 2) * (reduceMotion ? 0.3 : 1)) + scrollKick;
    // cinematic transitions: swirl and dive the camera in while between shapes
    const trans = Math.min(1, (1 - Math.max(...w)) * 2);
    swirlDir = scrollY >= lastSwirlY ? 1 : -1; lastSwirlY = scrollY;
    swirlS += ((reduceMotion ? 0 : trans * swirlDir) - swirlS) * (1 - Math.exp(-dt * 2.5));
    uniforms.uSwirl.value = swirlS * 1.15;
    camera.position.z = CAM_Z - Math.abs(swirlS) * 1.7;
    camera.rotation.z = swirlS * 0.1;
    if (shockAge < 5) { shockAge += dt; uniforms.uShock.value.z = shockAge; }
    uniforms.uOpacity.value = cur.dim;
    if (netGlobe) netGlobe.material.opacity = w[1] * cur.dim * 0.26;

    const km = 1 - Math.exp(-dt * 5);
    mouse.lerp(mouseT, km);
    uniforms.uMouse.value.copy(mouse);
    uniforms.uMouseOn.value += (mouseOnT - uniforms.uMouseOn.value) * km;

    look.lerp(mouseOnT ? mouseT : ZERO, km);
    const visH = 2 * Math.tan((FOV * Math.PI) / 360) * CAM_Z, visW = visH * camera.aspect;
    points.position.set(cur.x * visW, cur.oy * visH, 0);
    points.scale.setScalar(cur.s);
    const scrollRot = (scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * 0.9;
    points.rotation.y = Math.sin(time * 0.25) * 0.42 + look.x * 0.16 + scrollRot * 0.35;
    points.rotation.x = Math.sin(time * 0.19) * 0.06 - look.y * 0.1;

    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; document.documentElement.classList.add('scene-ready'); }
  }

  /* ---- lifecycle */
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  addEventListener('load', () => { keyframesDirty = true; });
  addEventListener('resize', () => { keyframesDirty = true; }, { passive: true });
  document.fonts?.ready.then(() => { keyframesDirty = true; });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); running = false;
    document.documentElement.classList.remove('scene-ready');
    document.documentElement.classList.add('no-webgl');
  });

  requestAnimationFrame((t) => { last = t; tick(t); });
}
