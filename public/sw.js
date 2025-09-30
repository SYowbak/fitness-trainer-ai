const CACHE_NAME = 'fitness-trainer-ai-v2';
const STATIC_CACHE = 'fitness-static-v2';
const DYNAMIC_CACHE = 'fitness-dynamic-v2';

// Критично важливі файли для офлайн роботи
const CORE_FILES = [
  '/',
  '/manifest.json',
  '/index.html',
  // Іконки для PWA
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

// Файли які кешуються динамічно
const CACHE_STRATEGIES = {
  // Статичні ресурси - кеш спочатку
  static: ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2'],
  // API запити - мережа спочатку, потім кеш
  api: ['firebase', 'googleapis', 'generativelanguage']
};

// Встановлення Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Встановлення v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Service Worker: Кешування критичних файлів...');
        return cache.addAll(CORE_FILES);
      })
      .then(() => {
        console.log('✅ Service Worker: Критичні файли закешовано');
      })
      .catch((error) => {
        console.error('❌ Service Worker: Помилка кешування:', error);
      })
  );
  // Примусово активувати новий service worker
  self.skipWaiting();
});

// Активація Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Активація v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Видаляємо старі кеші
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('🗑️ Service Worker: Видалення старого кешу:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Контролювати всі клієнти одразу
  self.clients.claim();
});

// Допоміжні функції для кешування
function isStaticResource(url) {
  return CACHE_STRATEGIES.static.some(ext => url.includes(ext));
}

function isAPIRequest(url) {
  return CACHE_STRATEGIES.api.some(api => url.includes(api));
}

// Стратегія "Cache First" для статичних ресурсів
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('📋 Завантаження з кешу:', request.url);
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('❌ Офлайн, файл не в кеші:', request.url);
    return new Response('Офлайн режим', { status: 503 });
  }
}

// Стратегія "Network First" для API запитів
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('🔄 Мережа недоступна, шукаємо в кеші:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Дані недоступні офлайн', { 
      status: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Офлайн режим', offline: true })
    });
  }
}

// Перехоплення запитів
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Ігноруємо не-GET запити
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    (async () => {
      // Статичні ресурси - Cache First
      if (isStaticResource(url)) {
        return cacheFirst(request);
      }
      
      // API запити - Network First
      if (isAPIRequest(url)) {
        return networkFirst(request);
      }
      
      // HTML сторінки - спочатку мережа, потім кеш
      if (request.destination === 'document') {
        try {
          const response = await fetch(request);
          return response;
        } catch (error) {
          console.log('📄 Показуємо кешовану сторінку');
          const cached = await caches.match('/');
          return cached || new Response('Додаток недоступний офлайн', { 
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        }
      }
      
      // Інші запити - стандартна обробка
      return fetch(request);
    })()
  );
});

// Обробка повідомлень від додатку
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Фонові синхронізації (для майбутнього)
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Фонова синхронізація:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Тут можна додати логіку синхронізації даних
      console.log('📡 Синхронізація даних в фоні...')
    );
  }
});

// Push-сповіщення (для майбутнього)
self.addEventListener('push', (event) => {
  console.log('🔔 Service Worker: Push-сповіщення отримано');
  
  const options = {
    body: event.data ? event.data.text() : 'Час для тренування!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Почати тренування',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Закрити',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Fitness Trainer AI', options)
  );
});
