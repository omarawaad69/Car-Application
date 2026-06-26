// إصدار جديد للكاش (تغيير الرقم يجبر على الحذف)
const CACHE_NAME = 'obd-v3';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/obd_codes.json'
];

// تثبيت الكاش الجديد
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  // تخطي الانتظار والتفعيل فوراً
  self.skipWaiting();
});

// تفعيل: حذف كل الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// استراتيجية: Network First للصفحة الرئيسية، Cache First للباقي
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}
