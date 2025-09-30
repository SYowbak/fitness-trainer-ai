import React, { useState, useEffect } from 'react';
import { UI_TEXT } from '../constants';

type View = 'profile' | 'workout' | 'progress';

interface NavbarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const NavItem: React.FC<{label: string, isActive: boolean, onClick: () => void, iconClass: string}> = ({ label, isActive, onClick, iconClass }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 sm:px-4 rounded-md text-sm sm:text-base font-medium transition-all duration-200 ease-in-out flex items-center space-x-2
                ${isActive 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transform scale-105 ring-2 ring-purple-400' 
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
  >
    <i className={`${iconClass} ${isActive ? 'text-yellow-300' : 'text-purple-400'}`}></i>
    <span>{label}</span>
  </button>
);

const Navbar: React.FC<NavbarProps> = ({ currentView, onViewChange }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Перевіряємо чи PWA вже встановлено
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Слухаємо подію готовності до встановлення
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Слухаємо подію після встановлення
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Показуємо prompt встановлення
    deferredPrompt.prompt();
    
    // Чекаємо на вибір користувача
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('🎉 Користувач погодився встановити PWA');
    } else {
      console.log('❌ Користувач відхилив встановлення PWA');
    }
    
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <nav className="flex space-x-1 sm:space-x-2 bg-gray-700/30 p-1 rounded-lg items-center">
      <NavItem 
        label={UI_TEXT.tabProfile} 
        isActive={currentView === 'profile'} 
        onClick={() => onViewChange('profile')}
        iconClass="fas fa-user-edit"
      />
      <NavItem 
        label={UI_TEXT.tabWorkout} 
        isActive={currentView === 'workout'} 
        onClick={() => onViewChange('workout')}
        iconClass="fas fa-bolt"
      />
      <NavItem 
        label={UI_TEXT.tabProgress} 
        isActive={currentView === 'progress'} 
        onClick={() => onViewChange('progress')}
        iconClass="fas fa-chart-line"
      />
      
      {/* Кнопка встановлення PWA */}
      {isInstallable && !isInstalled && (
        <button
          onClick={handleInstallClick}
          className="px-3 py-2 sm:px-4 rounded-md text-sm sm:text-base font-medium transition-all duration-200 ease-in-out flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg animate-pulse"
          title="Встановити додаток"
        >
          <i className="fas fa-download text-yellow-300"></i>
          <span className="hidden sm:inline">Встановити</span>
        </button>
      )}
      
      {/* Індикатор встановленого PWA */}
      {isInstalled && (
        <div className="px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 bg-green-600/20 text-green-400 border border-green-500/30">
          <i className="fas fa-check-circle"></i>
          <span className="hidden sm:inline">Встановлено</span>
        </div>
      )}
    </nav>
  );
};

export default Navbar;