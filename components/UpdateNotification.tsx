import React, { useState, useEffect } from 'react';

interface UpdateNotificationProps {
  onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate }) => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');

  useEffect(() => {
    // Слухаємо повідомлення від Service Worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        setUpdateVersion(event.data.version);
        setShowUpdate(true);
        console.log('🔄 Доступне оновлення додатку:', event.data.version);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleUpdate = () => {
    setShowUpdate(false);
    onUpdate();
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300">
      <div className="bg-fitness-gold-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-4 max-w-md">
        <div className="flex-shrink-0">
          <i className="fas fa-download text-xl"></i>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">Доступне оновлення</h4>
          <p className="text-xs opacity-90">
            Нова версія додатку готова до встановлення
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleUpdate}
            className="bg-white text-fitness-gold-600 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100 transition-colors"
          >
            Оновити
          </button>
          <button
            onClick={handleDismiss}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
