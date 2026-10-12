// オフラインでも開けるようにアプリ本体をキャッシュする
const VERSION = 'v1';
const CACHE = `pixel-quest-diary-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/util.js',
  './js/store.js',
  './js/sprites.js',
  './js/events.js',
  './js/ui.js',
  './js/diaryEditor.js',
  './js/eventEditor.js',
  './js/views/home.js',
  './js/views/calendar.js',
  './js/views/review.js',
  './js/views/settings.js',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts はキャッシュ優先（初回だけネットから）
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // アプリ本体はネット優先（更新をすぐ反映）、オフラインならキャッシュ
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
