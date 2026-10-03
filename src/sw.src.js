/* Sum Sort service worker: the game opens and plays offline once it has been loaded.
   The page itself goes network first, so a new build shows on the next visit; everything else (three.js, icons,
   fonts) comes from the cache first. The build stamps VERSION, and an old cache is dropped when a new one is ready. */
const CACHE = 'sum-sort-__VERSION__';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'vendor/three/three.module.min.js',
  'vendor/three/addons/geometries/RoundedBoxGeometry.js', 'vendor/three/addons/environments/RoomEnvironment.js',
  'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('sum-sort-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url), font = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !font) return;
  const keep = r => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; };
  if (req.mode === 'navigate') {
    // only the game itself is kept as the offline page, never another file opened in a tab (og.png, the manifest)
    const game = url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname);
    e.respondWith(fetch(req).then(r => {
      if (game && r.ok && /text\/html/.test(r.headers.get('content-type') || '')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
      return r;
    }).catch(() => game ? caches.match('index.html') : Response.error()));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(keep)));
});
