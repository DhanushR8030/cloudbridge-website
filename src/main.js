import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/inter';
import './styles.css';
import { SITE } from './site.config.js';

const root = document.documentElement;

/* ---- analytics (only when an ID is configured in site.config.js) */
window.dataLayer = window.dataLayer || [];
if (SITE.gtagId) {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(SITE.gtagId)}`;
  document.head.appendChild(s);
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', SITE.gtagId);
}
const track = (name, params = {}) => {
  if (window.gtag) window.gtag('event', name, params);
  else window.dataLayer.push({ event: name, ...params });
};

/* ---- loading screen (home page, first visit of a session) */
const preloader = document.getElementById('preloader');
if (preloader && !root.classList.contains('preloading')) preloader.remove();
else if (preloader) {
  const pctEl = preloader.querySelector('.preloader__pct');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN = reduced ? 600 : 2400, MAX = 7000, t0 = performance.now();
  let shown = 0, finished = false, fontsReady = !document.fonts;
  document.fonts?.ready.then(() => { fontsReady = true; });
  const finish = () => {
    finished = true;
    preloader.style.setProperty('--p', 1);
    pctEl.textContent = '100';
    preloader.classList.add('preloader--done');
    setTimeout(() => root.classList.remove('preloading'), 380);
    setTimeout(() => preloader.remove(), 1700);
    try { sessionStorage.setItem('cb-seen', '1'); } catch {}
  };
  const step = (now) => {
    if (finished) return;
    const el = now - t0;
    const sceneDone = root.classList.contains('scene-ready') || root.classList.contains('no-webgl');
    const allReady = document.readyState === 'complete' && fontsReady && (sceneDone || el > 4800);
    const target = (allReady && el >= MIN) || el > MAX ? 1 : Math.min(0.92, (el / MIN) * 0.92);
    shown += (target - shown) * 0.11;
    if (target === 1 && shown > 0.985) { finish(); return; }
    preloader.style.setProperty('--p', shown.toFixed(4));
    pctEl.textContent = String(Math.round(shown * 100));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---- header: stuck state, progress bar, mobile menu */
const header = document.querySelector('.site-header');
const toggle = document.querySelector('.nav-toggle');
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    header?.classList.toggle('is-stuck', scrollY > 24);
    header?.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
    ticking = false;
  });
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

function setMenu(open) {
  root.classList.toggle('nav-open', open);
  toggle?.setAttribute('aria-expanded', String(open));
  toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
toggle?.addEventListener('click', () => setMenu(!root.classList.contains('nav-open')));
document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

/* ---- back-to-top links: #top targets the fixed header, which browsers can't scroll-to reliably */
document.querySelectorAll('a[href="#top"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    history.pushState(null, '', location.pathname + location.search);
  });
});

/* ---- reveal on scroll */
const reveals = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('is-in'));
}

/* ---- floating contact buttons */
if (!SITE.whatsapp) document.querySelector('[data-fab="whatsapp"]')?.remove();

/* ---- sample-content notice (toggle in site.config.js) */
if (SITE.showSampleNotice) root.classList.add('sample-on');

/* ---- project filters */
const filterBar = document.querySelector('.filters');
if (filterBar) {
  const cards = document.querySelectorAll('.work, .case');
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    const f = btn.dataset.filter;
    filterBar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    cards.forEach((c) => { c.hidden = f !== 'all' && c.dataset.cat !== f; });
  });
}

/* ---- animated counters */
const counters = document.querySelectorAll('[data-count]');
if (counters.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const co = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      co.unobserve(en.target);
      const el = en.target, end = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1600;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => { el.textContent = '0'; co.observe(el); });
}

/* ---- cursor spotlight on cards */
document.querySelectorAll('.card-fx').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
});

/* ---- contact forms */
document.querySelectorAll('form[data-cb-form]').forEach((form) => {
  const status = form.querySelector('.form__status');
  const say = (msg, err) => { status.textContent = msg; status.classList.toggle('is-error', !!err); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.elements.website?.value) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = Object.fromEntries(new FormData(form));
    delete data.website;
    data.page = location.pathname;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    say('Sending...');

    const mailFallback = () => {
      const body = `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || '-'}\nService: ${data.service}\n\n${data.message}`;
      location.href = `mailto:${SITE.email}?subject=${encodeURIComponent('New project enquiry - ' + data.service)}&body=${encodeURIComponent(body)}`;
      say('Your email app should open with the message ready to send.');
    };

    if (!SITE.formEndpoint) { mailFallback(); track('generate_lead', { method: 'mailto' }); btn.disabled = false; return; }
    try {
      const res = await fetch(SITE.formEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      say('Thank you - your message has been sent. We will reply shortly.');
      track('generate_lead', { method: 'form' });
    } catch {
      say('Could not send automatically. Opening your email app instead.', true);
      mailFallback();
    } finally { btn.disabled = false; }
  });
});

/* ---- 3D scene: loaded after the page is interactive so text paints first */
const canvas = document.getElementById('scene');
if (canvas) {
  const fail = () => root.classList.add('no-webgl');
  const start = () => import('./scene.js').then((m) => m.initScene(canvas)).catch(fail);
  const schedule = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 200));
  if (document.readyState === 'complete') schedule(); else addEventListener('load', schedule, { once: true });
}
