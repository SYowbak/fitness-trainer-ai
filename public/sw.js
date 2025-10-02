const CACHE_NAME = 'fitness-trainer-ai-v3';
const STATIC_CACHE = 'fitness-static-v3';
const DYNAMIC_CACHE = 'fitness-dynamic-v3';
const RUNTIME_CACHE = 'fitness-runtime-v3';

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

// Максимальний розмір кешу (50MB)
const MAX_CACHE_SIZE = 50 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 100;

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
          // Видаляємо старі кеші, але зберігаємо поточні версії
          if (cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== RUNTIME_CACHE) {
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

// Функція очищення кешу при перевищенні ліміту
async function cleanupCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > MAX_CACHE_ENTRIES) {
    console.log(`🧹 Очищення кешу ${cacheName}: ${keys.length} -> ${MAX_CACHE_ENTRIES}`);
    const keysToDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Перевірка розміру кешу
async function getCacheSize(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let totalSize = 0;
  
  for (const key of keys) {
    try {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    } catch (error) {
      // Ігноруємо помилки при підрахунку розміру
    }
  }
  
  return totalSize;
}

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
      await cache.put(request, response.clone());
      // Очищуємо кеш при необхідності
      await cleanupCache(STATIC_CACHE);
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
      
      // HTML сторінки - покращена стратегія без блимання
      if (request.destination === 'document') {
        try {
          // Спочатку показуємо кеш для швидкості
          const cached = await caches.match('/');
          if (cached) {
            // Паралельно оновлюємо кеш в фоні
            fetch(request).then(response => {
              if (response.status === 200) {
                caches.open(STATIC_CACHE).then(cache => {
                  cache.put(request, response.clone());
                });
              }
            }).catch(() => {
              // Ігноруємо помилки фонового оновлення
            });
            return cached;
          }
          
          // Якщо немає кешу - завантажуємо з мережі
          const response = await fetch(request);
          if (response.status === 200) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
          }
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
  
  // Повідомлення про готовність до оновлення
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_INFO',
      version: CACHE_NAME
    });
  }
});

// Повідомлення клієнтів про оновлення
function notifyClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

// Повідомлення про нове оновлення при встановленні
self.addEventListener('install', (event) => {
  // ... існуючий код встановлення ...
  
  // Повідомляємо клієнтів про нове оновлення
  notifyClients({
    type: 'UPDATE_AVAILABLE',
    version: CACHE_NAME
  });
});

// Фонові синхронізації
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Фонова синхронізація:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      syncOfflineData()
    );
  }
});

// Функція синхронізації офлайн даних в фоні
async function syncOfflineData() {
  try {
    console.log('📡 Початок фонової синхронізації даних...');
    
    // Отримуємо дані з localStorage
    const offlineData = localStorage.getItem('fitness-offline-queue');
    if (!offlineData) {
      console.log('✅ Немає даних для синхронізації');
      return;
    }
    
    const queue = JSON.parse(offlineData);
    if (queue.length === 0) {
      console.log('✅ Черга синхронізації порожня');
      return;
    }
    
    // Повідомляємо клієнтів про початок синхронізації
    notifyClients({
      type: 'SYNC_STARTED',
      count: queue.length
    });
    
    console.log(`🔄 Синхронізуємо ${queue.length} елементів в фоні`);
    
    // Повідомляємо про завершення (реальна синхронізація буде в основному додатку)
    notifyClients({
      type: 'SYNC_NEEDED',
      queue: queue
    });
    
  } catch (error) {
    console.error('❌ Помилка фонової синхронізації:', error);
    notifyClients({
      type: 'SYNC_ERROR',
      error: error.message
    });
  }
}

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
