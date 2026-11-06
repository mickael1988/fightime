// Hors ligne : tous les fichiers de l'app sont mis en cache à l'installation.
// Réseau d'abord pour avoir la dernière version, cache si pas de réseau ou réseau trop lent.
const CACHE = 'fightime-v8';
const ASSETS = [
  './', './index.html', './style.css?v=8', './app.js?v=8',
  './manifest.webmanifest', './logo.png', './favicon-32.png', './apple-touch-icon.png',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './fonts/bebas-neue-latin.woff2',
];
const NETWORK_TIMEOUT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(request) {
  // no-cache : revalide auprès du serveur au lieu de servir une copie périmée du navigateur
  const req = request.mode === 'navigate' ? fetch(request) : fetch(request, { cache: 'no-cache' });
  return req.then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return res;
  });
}

function fromCache(request) {
  return caches.match(request, { ignoreSearch: request.mode === 'navigate' })
    .then(hit => hit || (request.mode === 'navigate' ? caches.match('./') : undefined));
}

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  e.respondWith(new Promise(resolve => {
    let settled = false;
    const done = res => { if (!settled && res) { settled = true; resolve(res); } };

    // Réseau trop lent : on sert le cache sans attendre
    const timer = setTimeout(() => fromCache(request).then(done), NETWORK_TIMEOUT);

    fromNetwork(request)
      .then(res => { clearTimeout(timer); done(res); })
      .catch(() => {
        clearTimeout(timer);
        fromCache(request).then(hit => done(hit || Response.error()));
      });
  }));
});
