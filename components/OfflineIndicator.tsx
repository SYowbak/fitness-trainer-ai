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

  // Автоматично ховаємо повідомлення через 5 секунд
  useEffect(() => {
    if (showOfflineMessage) {
      const timer = setTimeout(() => {
        setShowOfflineMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showOfflineMessage]);

  if (!showOfflineMessage && isOnline) {
    return null;
  }

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
      showOfflineMessage ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
    }`}>
      <div className={`px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 ${
        isOnline 
          ? 'bg-green-600 text-white' 
          : 'bg-orange-600 text-white'
      }`}>
        <i className={`fas ${isOnline ? 'fa-wifi' : 'fa-wifi-slash'}`}></i>
        <span className="text-sm font-medium">
          {isOnline 
            ? '🌐 Мережа відновлена' 
            : '📵 Офлайн режим - дані з кешу'
          }
        </span>
        {!isOnline && (
          <button
            onClick={() => setShowOfflineMessage(false)}
            className="ml-2 text-white hover:text-gray-200"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
