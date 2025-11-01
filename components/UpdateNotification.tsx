import React, { useState, useEffect } from 'react';

interface UpdateNotificationProps {
  onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate }) => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');

  useEffect(() => {
    // Function to register message listener
    const registerMessageListener = async () => {
      if ('serviceWorker' in navigator) {
        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;

        // Listen for messages from service worker
        const handleMessage = (event: MessageEvent) => {
          if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
            setUpdateVersion(event.data.version);
            setShowUpdate(true);
            console.log('🔄 Доступне оновлення додатку:', event.data.version);
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        // Also check if there's already a waiting worker
        if (registration.waiting) {
          console.log('🔄 Виявлено waiting worker - показуємо банер');
          setUpdateVersion(registration.waiting.scriptURL);
          setShowUpdate(true);
        }

        return () => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
      }
    };

    registerMessageListener();
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
