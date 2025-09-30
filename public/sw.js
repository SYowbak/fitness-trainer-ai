const CACHE_NAME = 'fitness-trainer-ai-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/sounds/',
  // Додаємо основні маршрути
  '/?tab=workout',
  '/?tab=profile',
  '/?tab=progress'
];

// Встановлення Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Встановлення...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Кешування файлів...');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
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
  console.log('✅ Service Worker: Активація...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
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

// Перехоплення запитів
self.addEventListener('fetch', (event) => {
  // Ігноруємо запити до Firebase та інших API
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('generativelanguage') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Повертаємо кешовану версію якщо є
        if (response) {
          console.log('📋 Service Worker: Завантаження з кешу:', event.request.url);
          return response;
        }

        // Інакше завантажуємо з мережі
        return fetch(event.request).then((response) => {
          // Перевіряємо чи відповідь валідна
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Клонуємо відповідь для кешування
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Якщо офлайн і немає в кеші, показуємо базову сторінку
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
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
