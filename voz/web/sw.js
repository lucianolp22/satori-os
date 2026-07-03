// sw.js — Service Worker mínimo, PASS-THROUGH puro.
// Existe SOLO para habilitar la instalación/standalone de la PWA.
// NO cachea NADA: no hay handler de 'fetch', así que toda request va directo
// a la red. El shell se sirve con Cache-Control: no-store. Cachear el shell
// dejaría al iPhone varado en una versión rota por días (truco iOS #7, Kevin).
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
// (sin 'fetch' handler a propósito = pass-through real)
