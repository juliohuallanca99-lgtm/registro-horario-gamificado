/* HoraLog service worker: funciona sin señal y maneja los avisos */
const CACHE = 'horalog-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // datos: siempre a la red
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { caches.open(CACHE).then(c => c.put('/index.html', r.clone())); return r; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});

/* Avisos enviados desde el servidor (siguiente fase) */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'HoraLog', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'HoraLog', {
    body: d.body || '¿Qué hiciste en la última hora?', tag: d.tag || 'hl-hourly', renotify: true,
    icon: '/icon-192.png', badge: '/icon-192.png',
    actions: [{ action: 'igual', title: 'Sí, lo mismo' }, { action: 'registrar', title: 'Otra cosa' }],
    data: { url: '/?accion=registrar' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const accion = e.action || 'registrar';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all.find(x => new URL(x.url).origin === location.origin);
    if (c) { await c.focus(); c.postMessage({ accion }); }
    else await self.clients.openWindow('/?accion=' + accion);
  })());
});
