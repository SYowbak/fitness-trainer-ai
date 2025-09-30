import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Реєстрація Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker зареєстровано:', registration.scope);
        
        // Перевіряємо оновлення
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 Нова версія додатку доступна!');
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
  </React.StrictMode>
);