// ============================================================
// Service Worker v5 — агресивне автооновлення
// HTML: Network-First (завжди свіжа версія, кеш лише для офлайн)
// Статика (.js/.css з хешами): Cache-First (Vite додає хеш у назву)
// API: не перехоплюється (завжди йде з мережі)
// ============================================================

const SW_VERSION = 'v5';
const CACHE_PREFIX = 'fitness-trainer-ai';
const STATIC_CACHE = CACHE_PREFIX + '-static-' + SW_VERSION;
const DYNAMIC_CACHE = CACHE_PREFIX + '-dynamic-' + SW_VERSION;

// Максимум записів в одному кеші
const MAX_CACHE_ENTRIES = 100;

// Файли, які кешуються при встановленні (для офлайн)
const CORE_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

// Розширення статичних ресурсів (Cache-First — файли мають хеш у назві)
var STATIC_EXTENSIONS = ['.js', '.css', '.woff', '.woff2'];

// Розширення зображень (Cache-First)
var IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico'];

// Домени API — НЕ перехоплюються Service Worker
var API_KEYWORDS = ['generativelanguage', 'firestore', 'firebase', 'identitytoolkit', 'googleapis.com/identitytoolkit'];

// ============================================================
//  INSTALL — кешуємо критичні файли, активуємося негайно
// ============================================================
self.addEventListener('install', function (event) {
  console.log('[SW ' + SW_VERSION + '] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function (cache) {
        console.log('[SW ' + SW_VERSION + '] Pre-caching core files...');
        return cache.addAll(CORE_FILES);
      })
      .then(function () {
        console.log('[SW ' + SW_VERSION + '] Core files cached. Calling skipWaiting().');
        return self.skipWaiting();
      })
      .catch(function (error) {
        console.error('[SW ' + SW_VERSION + '] Install error:', error);
      })
  );
});

// ============================================================
//  ACTIVATE — видаляємо ВСІ старі кеші, беремо контроль
// ============================================================
self.addEventListener('activate', function (event) {
  console.log('[SW ' + SW_VERSION + '] Activating...');
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) {
              // Залишаємо тільки кеші поточної версії
              return name !== STATIC_CACHE && name !== DYNAMIC_CACHE;
            })
            .map(function (name) {
              console.log('[SW ' + SW_VERSION + '] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(function () {
        console.log('[SW ' + SW_VERSION + '] Old caches removed. Claiming clients.');
        return self.clients.claim();
      })
      .then(function () {
        // Повідомляємо всіх клієнтів про оновлення
        return self.clients.matchAll().then(function (clients) {
          clients.forEach(function (client) {
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              version: SW_VERSION
            });
          });
        });
      })
  );
});

// ============================================================
//  HELPERS — визначення типу запиту
// ============================================================

function isStaticAsset(url) {
  var pathname = url.pathname || '';
  for (var i = 0; i < STATIC_EXTENSIONS.length; i++) {
    if (pathname.indexOf(STATIC_EXTENSIONS[i]) !== -1) return true;
  }
  return false;
}

function isImageAsset(url) {
  var pathname = url.pathname || '';
  for (var i = 0; i < IMAGE_EXTENSIONS.length; i++) {
    if (pathname.endsWith(IMAGE_EXTENSIONS[i])) return true;
  }
  return false;
}

function isAPIRequest(url) {
  var href = url.href || '';
  for (var i = 0; i < API_KEYWORDS.length; i++) {
    if (href.indexOf(API_KEYWORDS[i]) !== -1) return true;
  }
  return false;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

// ============================================================
//  FETCH — маршрутизація запитів за стратегіями
// ============================================================
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Тільки GET запити
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // API запити — НЕ перехоплюємо, браузер зробить звичайний fetch
  if (isAPIRequest(url)) {
    return;
  }

  // HTML / навігація — Network-First (ГОЛОВНА ЗМІНА для автооновлення)
  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  // Статичні ресурси (.js, .css, шрифти) — Cache-First
  // (Vite додає content-hash в ім'я файлу, тому кешувати безпечно)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // Зображення — Cache-First
  if (isImageAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // Зовнішні ресурси (CDN, шрифти Google тощо) — Network з fallback
  event.respondWith(
    fetch(request).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || new Response('Ресурс недоступний', { status: 503 });
      });
    })
  );
});

// ============================================================
//  Network-First для HTML — ЗАВЖДИ показувати свіжу версію
//  Кеш використовується ТІЛЬКИ коли немає мережі (офлайн)
// ============================================================
function networkFirstHTML(request) {
  return fetch(request)
    .then(function (response) {
      if (response.ok) {
        // Зберігаємо свіжу копію для офлайн
        var responseClone = response.clone();
        caches.open(STATIC_CACHE).then(function (cache) {
          cache.put('/', responseClone);
        });
      }
      return response;
    })
    .catch(function () {
      // Офлайн — показуємо закешовану версію
      return caches.match('/').then(function (cached) {
        if (cached) return cached;
        return new Response(
          '<html><body style="background:#1f2937;color:#f3f4f6;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h1>Офлайн</h1><p>Додаток недоступний без мережі</p></div></body></html>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      });
    });
}

// ============================================================
//  Cache-First для статичних ресурсів (файли з хешами від Vite)
// ============================================================
function cacheFirstStatic(request) {
  return caches.match(request).then(function (cached) {
    if (cached) {
      // Перевірка: якщо в кеші HTML замість JS/CSS — це помилка, видаляємо
      var contentType = cached.headers.get('content-type') || '';
      if (contentType.indexOf('text/html') !== -1 && !request.url.endsWith('.html')) {
        // HTML у кеші для не-HTML ресурсу — видаляємо
        caches.open(STATIC_CACHE).then(function (cache) {
          cache.delete(request);
        });
        // Завантажуємо з мережі
        return fetchAndCacheStatic(request);
      }
      return cached;
    }

    return fetchAndCacheStatic(request);
  });
}

function fetchAndCacheStatic(request) {
  return fetch(request)
    .then(function (response) {
      if (response.ok) {
        var contentType = response.headers.get('content-type') || '';
        // Не кешуємо HTML для статичних ресурсів (помилка сервера/rewrite)
        if (contentType.indexOf('text/html') === -1) {
          var responseClone = response.clone();
          caches.open(STATIC_CACHE).then(function (cache) {
            cache.put(request, responseClone);
            // Очищуємо кеш при перевищенні ліміту
            cleanupCache(STATIC_CACHE);
          });
        }
      }
      return response;
    })
    .catch(function () {
      return new Response('Ресурс недоступний офлайн', { status: 503 });
    });
}

// ============================================================
//  Очищення кешу при перевищенні ліміту записів
// ============================================================
function cleanupCache(cacheName) {
  caches.open(cacheName).then(function (cache) {
    cache.keys().then(function (keys) {
      if (keys.length > MAX_CACHE_ENTRIES) {
        console.log('[SW ' + SW_VERSION + '] Cache cleanup: ' + keys.length + ' → ' + MAX_CACHE_ENTRIES);
        var keysToDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
        keysToDelete.forEach(function (key) {
          cache.delete(key);
        });
      }
    });
  });
}

// ============================================================
//  MESSAGES — обробка повідомлень від додатку
// ============================================================
self.addEventListener('message', function (event) {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW ' + SW_VERSION + '] Received SKIP_WAITING message.');
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        type: 'VERSION_INFO',
        version: SW_VERSION
      });
    }
  }
});

// ============================================================
//  BACKGROUND SYNC — повідомляємо клієнтів про необхідність синхронізації
//  (реальна синхронізація виконується в основному додатку, який має доступ
//   до Firebase та localStorage)
// ============================================================
self.addEventListener('sync', function (event) {
  console.log('[SW ' + SW_VERSION + '] Background sync:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(
      self.clients.matchAll().then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({
            type: 'SYNC_NEEDED'
          });
        });
      })
    );
  }
});

// ============================================================
//  PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', function (event) {
  var options = {
    body: event.data ? event.data.text() : 'Час для тренування!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'explore', title: 'Почати тренування', icon: '/icon-192.png' },
      { action: 'close', title: 'Закрити', icon: '/icon-192.png' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Fitness Trainer AI', options)
  );
});
