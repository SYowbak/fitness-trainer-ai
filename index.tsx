import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Реєстрація Service Worker для PWA
if ('serviceWorker' in navigator) {
  // Автоматичне перезавантаження при оновленні Service Worker
  // Коли новий SW активується і бере контроль — сторінка перезавантажується
  // з новим кодом автоматично, без дій користувача
  let isRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isRefreshing) return; // Захист від повторного reload
    isRefreshing = true;
    console.log('🔄 Новий Service Worker активовано — перезавантаження...');
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker зареєстровано:', registration.scope);

        // Перевіряємо оновлення кожні 60 секунд
        setInterval(() => {
          registration.update().catch(() => {
            // Ігноруємо помилки перевірки (наприклад, офлайн)
          });
        }, 60 * 1000);

        // Логуємо коли знайдено оновлення
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 Нова версія додатку доступна — оновлення...');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ Помилка реєстрації Service Worker:', error);
      });
  });
}

// Додаємо обробник для встановлення PWA
let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 PWA готово до встановлення');
  // НЕ preventDefault() - дозволяємо браузеру показати іконку встановлення
  deferredPrompt = e;
  
  // Показуємо користувачу що можна встановити
  console.log('💡 Шукайте іконку встановлення в адресному рядку браузера!');
});

// Обробник після встановлення
window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA успішно встановлено!');
  deferredPrompt = null;
});

// Перевіряємо чи PWA вже встановлено
if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
  console.log('✅ PWA запущено як встановлений додаток');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Не вдалося знайти кореневий елемент для монтування");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
    <SpeedInsights />
  </React.StrictMode>
);