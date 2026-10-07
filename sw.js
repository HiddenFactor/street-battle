// =====================================================================
// sw.js – Service Worker: immer die neueste Spielversion laden
// ---------------------------------------------------------------------
// GitHub Pages erlaubt dem Browser, Dateien 10 Minuten lang zwischen-
// zuspeichern. Nach einem Update würde man dann noch die alte Version
// sehen. Dieser kleine Helfer fragt bei jeder Spieldatei kurz beim Server
// nach, ob es eine neuere gibt (unveränderte Dateien kosten fast nichts).
// =====================================================================

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Nur eigene Dateien (nicht PeerJS vom CDN), keine Seitenaufrufe
  if (request.method !== 'GET' || request.mode === 'navigate') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request, { cache: 'no-cache' }));
});
