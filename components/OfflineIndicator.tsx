import React, { useState, useEffect } from 'react';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
      console.log('🌐 Мережа відновлена');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      console.log('📵 Мережа недоступна - працюємо офлайн');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Показуємо повідомлення якщо вже офлайн
    if (!navigator.onLine) {
      setShowOfflineMessage(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Автоматично ховаємо повідомлення про відновлення мережі через 3 секунди
  // Офлайн повідомлення залишається до ручного закриття
  useEffect(() => {
    if (showOfflineMessage && isOnline) {
      const timer = setTimeout(() => {
        setShowOfflineMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showOfflineMessage, isOnline]);

  // Не показуємо повідомлення - тільки індикатор в навігації
  return null;
};

export default OfflineIndicator;
