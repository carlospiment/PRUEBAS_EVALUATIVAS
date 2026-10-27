/* ===================================================
   SERVICE WORKER - PRUEBAS SUMATIVAS MEDUCA (3° Y 4° GRADO)
   Soporte 100% Offline para PWA y GitHub Pages
   =================================================== */

const CACHE_NAME = 'meduca-agri-eval-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './docente.html',
  './cuarto_grado.html',
  './tercer_grado.html',
  './css/style.css',
  './js/app.js',
  './js/docente.js',
  './js/qrcode.min.js',
  './data/estudiantes.json',
  './data/prueba_3ro.json',
  './data/prueba_4to.json',
  './data/prueba_config.json',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Quicksand:wght@500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v3] Precaching assets 3er y 4to grado...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Error al cachear algunos recursos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ offline: true, error: 'Servidor no disponible en modo offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
