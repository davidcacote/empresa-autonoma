// Service worker simples: guarda em cache só ficheiros do próprio app (mesma origem). Caminhos relativos ao /turno-certo/.
const VERSAO = 'turno-certo-v1';
const FICHEIROS = ['./', 'index.html', 'js/app.js', 'js/logica.js', 'js/armazem.js', 'styles/app.css', 'styles/print.css', 'manifest.webmanifest', 'icone.svg'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(FICHEIROS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then((r) => r ?? fetch(e.request)));
});
