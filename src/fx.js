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
    const glare = document.createElement('span');
    glare.className = 'fx-glare';
    glare.setAttribute('aria-hidden', 'true');
    el.appendChild(glare);
    const big = el.offsetWidth > 520;
    const max = big ? 3.5 : 9;
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
      b.style.setProperty('--mx2', `${(x * 7).toFixed(2)}px`);
      b.style.setProperty('--my2', `${(y * 5).toFixed(2)}px`);
    }, { passive: true });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx2', '0px'); b.style.setProperty('--my2', '0px'); });
  });
}

export function initFx() {
  root.classList.add('fx-on');
  splitHeadings();
  tiltCards();
  scrollPhotos();
  magneticButtons();
}
