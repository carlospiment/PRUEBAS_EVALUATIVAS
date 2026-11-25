/* ===================================================
   SERVICE WORKER - PRUEBAS SUMATIVAS MEDUCA (3°, 4°, 5° Y 6° GRADO)
   Soporte 100% Offline para PWA y GitHub Pages
   =================================================== */

const CACHE_NAME = 'meduca-agri-eval-v16';

const STATIC_ASSETS = [
  './',
  './index.html',
  './docente.html',
  './sexto_grado.html',
  './quinto_grado.html',
  './cuarto_grado.html',
  './tercer_grado.html',
  './css/style.css',
  './js/vendor/firebase-app-compat.js',
  './js/vendor/firebase-auth-compat.js',
  './js/vendor/firebase-firestore-compat.js',
  './js/firebase-config.js',
  './js/catalogo.js',
  './js/nav.js',
  './js/app.js',
  './js/docente.js',
  './js/qrcode.min.js',
  './data/estudiantes.json',
  './data/catalogo_pruebas.json',
  './data/prueba_3ro.json',
  './data/prueba_4to.json',
  './data/prueba_5to.json',
  './data/prueba_6to.json',
  './data/prueba_config.json',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v14] Precaching assets...');
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

  // Nunca interceptar Firebase Auth, Firestore, OAuth ni dominios externos
  if (url.origin !== self.location.origin) {
    return;
  }

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

  // Network-First con respaldo en caché para asegurar actualizaciones inmediatas en GitHub Pages
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
