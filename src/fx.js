import Lenis from 'lenis';
// 3D interface effects that sit on top of the particle scene.
// Everything here only uses transforms and opacity (GPU-friendly), runs only
// for elements on screen, and is skipped for "reduce motion" and weak devices.

const root = document.documentElement;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ------------------------------------------------ 3D tilt cards with glare */
function tiltCards() {
  if (!finePointer) return;
  const sel = '.svc-card, .bento__card, .exp, .logo-tile, .step, .principle, .stat, .facts, .teaser-band, .cta__grid > div:last-child, .related a, .card-fx';
  document.querySelectorAll(sel).forEach((el) => {
    if (el.closest('.marquee') || el.dataset.tilt === 'off') return;
    el.classList.add('fx-tilt');
    // cards that also rise in on scroll: switch to tilt mode once that has finished
    if (el.hasAttribute('data-reveal')) {
      const ready = () => el.classList.add('fx-ready');
      el.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform' && el.classList.contains('is-in')) ready(); });
      setTimeout(() => { if (el.classList.contains('is-in')) ready(); }, 2500);
      new MutationObserver((m, mo) => { if (el.classList.contains('is-in')) { setTimeout(ready, 1600); mo.disconnect(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    const big = el.offsetWidth > 520;
    const max = big ? 1.5 : 4;
    let raf = 0, rx = 0, ry = 0, gx = 50, gy = 50;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--rx', `${rx}deg`);
      el.style.setProperty('--ry', `${ry}deg`);
      el.style.setProperty('--gx', `${gx}%`);
      el.style.setProperty('--gy', `${gy}%`);
    };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry = (px - 0.5) * 2 * max; rx = -(py - 0.5) * 2 * max;
      gx = px * 100; gy = py * 100;
      el.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    el.addEventListener('pointerleave', () => {
      rx = 0; ry = 0;
      el.classList.remove('is-tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    });
  });
}

/* --------------------------------------- headings flip in word by word (3D) */
function splitHeadings() {
  if (!('IntersectionObserver' in window)) return;
  // Only headings below the first screen, so the first view never flickers.
  const heads = [...document.querySelectorAll('main h2')].filter((h) => !h.classList.contains('sr-only') && h.getBoundingClientRect().top > innerHeight * 0.92);
  heads.forEach((h) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const w = document.createElement('span');
            w.className = 'fx-w';
            const inner = document.createElement('span');
            inner.className = 'fx-wi';
            inner.style.setProperty('--i', i++);
            inner.textContent = p;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.classList.contains('grad')) {
          // gradient text: animate it as one piece so the colour fill stays intact
          const w = document.createElement('span'); w.className = 'fx-w';
          const inner = document.createElement('span'); inner.className = 'fx-wi'; inner.style.setProperty('--i', i++);
          n.replaceWith(w); inner.appendChild(n); w.appendChild(inner);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(h);
    h.classList.add('fx-split');
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -10% 0px' });
  heads.forEach((h) => io.observe(h));
}

/* -------------------------------- photos tilt and drift in 3D while scrolling */
function scrollPhotos() {
  const figs = [...document.querySelectorAll('.photo')].filter((f) => !f.closest('.svc-card'));
  if (!figs.length || !('IntersectionObserver' in window)) return;
  const live = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { en.isIntersecting ? live.add(en.target) : live.delete(en.target); });
    kick();
  }, { rootMargin: '10% 0px' });
  figs.forEach((f) => { f.classList.add('fx-depth'); io.observe(f); });
  let raf = 0;
  const update = () => {
    raf = 0;
    const vh = innerHeight;
    live.forEach((f) => {
      const r = f.getBoundingClientRect();
      const p = Math.max(-1, Math.min(1, ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2)));
      f.style.setProperty('--sp', p.toFixed(4));
    });
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick, { passive: true });
  kick();
}

/* ------------------------------------------------------- magnetic buttons */
function magneticButtons() {
  if (!finePointer) return;
  document.querySelectorAll('.btn:not(.btn--small), .nav__cta, .fab, .floating-cta a').forEach((b) => {
    b.classList.add('fx-mag');
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      b.style.setProperty('--mx2', `${(x * 4).toFixed(2)}px`);
      b.style.setProperty('--my2', `${(y * 3).toFixed(2)}px`);
    }, { passive: true });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx2', '0px'); b.style.setProperty('--my2', '0px'); });
  });
}


/* ------------------------------------ client logos as a rotating 3D ring */
function logoRing() {
  const wall = document.querySelector('.clientwall');
  const group = wall?.querySelector('.marquee__group');
  if (!wall || !group) return;
  const chips = [...group.querySelectorAll('.logo-chip')];
  if (chips.length < 6) return;
  const n = chips.length;
  const ring = document.createElement('div');
  ring.className = 'ring3d';
  ring.setAttribute('role', 'list');
  ring.setAttribute('aria-label', 'Businesses we have worked with');
  const spin = document.createElement('div');
  spin.className = 'ring3d__spin';
  chips.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'ring3d__item';
    item.setAttribute('role', 'listitem');
    item.style.setProperty('--a', `${(360 / n) * i}deg`);
    item.appendChild(c.querySelector('img').cloneNode(true));
    spin.appendChild(item);
  });
  ring.appendChild(spin);
  const marquee = wall.querySelector('.marquee');
  marquee.hidden = true;
  marquee.after(ring);
  const setR = () => {
    const w = ring.querySelector('.ring3d__item').offsetWidth + (innerWidth < 640 ? 10 : 22);
    ring.style.setProperty('--r', `${Math.round((w / 2) / Math.tan(Math.PI / n))}px`);
  };
  setR(); addEventListener('resize', setR, { passive: true });
  // drag (or swipe) to spin it yourself; it keeps turning on its own otherwise
  let angle = 0, vel = 0.12, drag = null, last = performance.now(), visible = false;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) requestAnimationFrame(loop); }).observe(ring);
  ring.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, a: angle }; ring.setPointerCapture(e.pointerId); ring.classList.add('is-drag'); });
  ring.addEventListener('pointermove', (e) => { if (!drag) return; const na = drag.a + (e.clientX - drag.x) * 0.35; vel = (na - angle) * 0.5; angle = na; });
  const end = () => { drag = null; ring.classList.remove('is-drag'); };
  ring.addEventListener('pointerup', end); ring.addEventListener('pointercancel', end);
  let hover = false;
  ring.addEventListener('pointerenter', () => { hover = true; }); ring.addEventListener('pointerleave', () => { hover = false; });
  function loop(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag) {
      const base = hover ? 0.02 : 0.12;
      vel += (base - vel) * (1 - Math.exp(-dt * 1.5));
      angle += vel * dt * 60;
    }
    spin.style.transform = `translateZ(calc(var(--r) * -1)) rotateY(${angle.toFixed(2)}deg)`;
    requestAnimationFrame(loop);
  }
}

/* ------------------- hero tilts back into the screen as you scroll away */
function heroDepth() {
  const hero = document.querySelector('.hero__center, .page-hero .hero__content');
  if (!hero) return;
  const sec = hero.closest('section');
  const tags = [...document.querySelectorAll('.htag')];
  hero.classList.add('fx-hero');
  let raf = 0, mx = 0, my = 0;
  const update = () => {
    raf = 0;
    const h = sec.offsetHeight || innerHeight;
    const p = Math.max(0, Math.min(1, scrollY / (h * 0.75)));
    if (p >= 1 && hero.dataset.done) return;
    hero.dataset.done = p >= 1 ? '1' : '';
    hero.style.transform = p > 0 ? `translate3d(0, ${(p * 70).toFixed(1)}px, 0) scale(${(1 - p * 0.06).toFixed(4)})` : '';
    hero.style.opacity = p > 0 ? String(Math.max(0, 1 - p * 1.15)) : '';
    tags.forEach((t, i) => { t.style.translate = `${(mx * (14 + i * 7)).toFixed(1)}px ${(my * (10 + i * 5) - p * (60 + i * 30)).toFixed(1)}px`; });
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', kick, { passive: true });
  if (finePointer) addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; kick(); }, { passive: true });
  kick();
}

/* ------------------------------------------- smooth inertia scrolling */
function smoothScroll() {
  if (!finePointer) return; // phones keep their own native momentum scrolling
  const lenis = new Lenis({ autoRaf: true, lerp: 0.095, anchors: { offset: -90 } });
  window.__lenis = lenis;
  // pause while the mobile menu is open
  new MutationObserver(() => (root.classList.contains('nav-open') ? lenis.stop() : lenis.start()))
    .observe(root, { attributes: true, attributeFilter: ['class'] });
}

/* ------------------------- "How we work": steps pinned while you scroll */
function pinSteps() {
  const boxes = document.querySelectorAll('[data-pinsteps]');
  if (!boxes.length) return;
  const all = [];
  boxes.forEach((box) => {
    const list = box.querySelector('.pinsteps__list');
    const items = [...list.children];
    const n = items.length;
    const sec = box.closest('section');
    box.classList.add('is-pinned');
    box.style.setProperty('--n', n);
    const stage = document.createElement('div');
    stage.className = 'pinsteps__stage';
    const rail = document.createElement('div');
    rail.className = 'pinsteps__rail';
    rail.setAttribute('aria-hidden', 'true');
    rail.innerHTML = '<i class="pinsteps__bar"></i>' + items.map((li) =>
      `<span class="pinsteps__tick"><b>${li.querySelector('.pinstep__n').textContent}</b>${li.querySelector('h3').textContent}</span>`).join('');
    list.before(stage);
    stage.append(rail, list);
    const ticks = [...rail.querySelectorAll('.pinsteps__tick')];
    // one particle shape per step: markers the 3D scene follows as you scroll
    if (sec?.dataset.shape) {
      const dim = sec.dataset.dim || '0.26';
      sec.removeAttribute('data-shape');
      items.forEach((li, i) => {
        const m = document.createElement('div');
        m.className = 'pinsteps__mark';
        m.dataset.shape = li.dataset.stepShape || '1';
        m.dataset.x = '0.3'; m.dataset.y = '0.02'; m.dataset.dim = dim; m.dataset.scale = '0.85';
        m.style.top = `calc(${i} * var(--seg) + ${i === 0 ? 0 : 50}vh)`;
        box.appendChild(m);
      });
    }
    all.push({ box, stage, items, ticks, n, last: -1 });
  });
  let raf = 0;
  const update = () => {
    raf = 0;
    const head = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 76;
    all.forEach((o) => {
      const r = o.box.getBoundingClientRect();
      const total = Math.max(1, o.box.offsetHeight - o.stage.offsetHeight);
      const p = Math.max(0, Math.min(1, (head - r.top) / total));
      o.box.style.setProperty('--p', p.toFixed(4));
      const active = Math.min(o.n - 1, Math.floor(p * o.n * 0.999));
      if (active === o.last) return;
      o.last = active;
      o.items.forEach((li, i) => { li.classList.toggle('is-on', i === active); li.classList.toggle('is-past', i < active); });
      o.ticks.forEach((t, i) => { t.classList.toggle('is-on', i === active); t.classList.toggle('is-done', i < active); });
    });
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick, { passive: true });
  update();
  dispatchEvent(new Event('cb:layout'));
}

/* ------------------------------------------- custom cursor (desktop) */
function cursor() {
  if (!finePointer) return;
  const c = document.createElement('div');
  c.className = 'cur';
  c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<span class="cur__ring"><span class="cur__label"></span></span><span class="cur__dot"></span>';
  document.body.appendChild(c);
  root.classList.add('cursor-on');
  const ring = c.querySelector('.cur__ring'), dot = c.querySelector('.cur__dot'), label = c.querySelector('.cur__label');
  let x = -100, y = -100, rx = x, ry = y, raf = 0;
  const loop = () => {
    rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    c.classList.add('is-in');
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener('mouseleave', () => c.classList.remove('is-in'));
  document.addEventListener('pointerdown', () => c.classList.add('is-down'));
  document.addEventListener('pointerup', () => c.classList.remove('is-down'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const text = t.closest?.('input, textarea, select, [contenteditable]');
    const view = t.closest?.('.svc-card, .bento__card, .related a, .industry');
    const drag = t.closest?.('.ring3d');
    const link = t.closest?.('a, button, summary, label, [role="button"]');
    c.classList.toggle('is-text', !!text);
    c.classList.toggle('is-link', !!link && !view);
    const l = view ? 'View' : drag ? 'Drag' : '';
    c.classList.toggle('has-label', !!l);
    if (l) label.textContent = l;
  });
}

/* ----------------------------- paragraphs that light up as you read them */
function scrubText() {
  const paras = [...document.querySelectorAll('[data-scrub]')];
  if (!paras.length) return;
  const data = paras.map((p) => {
    const words = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span'); w.className = 'sw'; w.textContent = part; words.push(w); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(p);
    p.classList.add('is-scrub');
    return { p, words, live: false, last: -1 };
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { const d = data.find((x) => x.p === en.target); if (d) d.live = en.isIntersecting; });
    kick();
  });
  data.forEach((d) => io.observe(d.p));
  let raf = 0;
  const update = () => {
    raf = 0;
    const vh = innerHeight;
    data.forEach((d) => {
      if (!d.live) return;
      const r = d.p.getBoundingClientRect();
      const prog = Math.max(0, Math.min(1, (vh * 0.86 - r.top) / (r.height + vh * 0.42)));
      const lit = prog * (d.words.length + 2);
      const key = Math.round(lit * 8);
      if (key === d.last) return;
      d.last = key;
      d.words.forEach((w, i) => { w.style.opacity = (0.18 + 0.82 * Math.max(0, Math.min(1, lit - i))).toFixed(3); });
    });
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', kick, { passive: true });
  kick();
}

export function initFx() {
  root.classList.add('fx-on');
  smoothScroll();
  pinSteps();
  cursor();
  scrubText();
  splitHeadings();
  tiltCards();
  scrollPhotos();
  magneticButtons();
  logoRing();
  heroDepth();
}
