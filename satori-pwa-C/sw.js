/* Satori OS · Service Worker (offline shell). DRAFT — Fase 3 de PLAN-C.
 * Estrategia:
 *  - App shell (index.html, css, js, íconos): precache + cache-first → la app
 *    ABRE offline (muestra el marco; los datos requieren red).
 *  - API (POST a GAS): network-only con fallback "sin conexión" (los datos NO
 *    se cachean acá; el cache de datos vive en IndexedDB del front, Fase 3b).
 */
var CACHE = 'satori-shell-v1';
var SHELL = [
  './', './index.html', './app.css', './app.js', './gas-shim.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './offline.html'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  // El API de datos (POST) nunca se sirve de cache.
  if (req.method !== 'GET') {
    e.respondWith(fetch(req).catch(function () {
      return new Response(JSON.stringify({ ok: false, error: 'offline' }), { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }
  // Shell: cache-first, con red de respaldo y fallback offline para navegaciones.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        return caches.open(CACHE).then(function (c) { c.put(req, res.clone()); return res; });
      }).catch(function () {
        if (req.mode === 'navigate') return caches.match('./offline.html');
      });
    })
  );
});

/* Push (Fase 4). iOS: requiere PWA instalada en pantalla de inicio (iOS ≥16.4)
 * + suscripción Web Push (VAPID). El SENDER no es GAS: un worker aparte
 * (CF Worker/servicio) firma y envía. Acá solo se muestra la notificación. */
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Satori OS', {
    body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', data: d.url || './'
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || './'));
});
