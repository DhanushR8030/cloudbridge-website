// CloudBridge Admin service worker: makes the panel installable and lets the
// app shell open even on a flaky connection. Enquiry data is never cached.
const CACHE = 'cb-admin-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate' || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/admin/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('/admin/')))
    );
  }
});
