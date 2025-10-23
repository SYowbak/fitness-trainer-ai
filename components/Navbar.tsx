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
    className={`nav-button ${isActive ? 'active' : ''}`}
  >
    <i className={iconClass}></i>
    <span>{label}</span>
  </button>
);

const Navbar: React.FC<NavbarProps> = ({ currentView, onViewChange }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Слухаємо зміни мережі
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
    <nav className="flex space-x-1 sm:space-x-2 bg-fitness-dark-700/30 p-1 rounded-lg items-center border border-fitness-gold-600/20">
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
      
    </nav>
  );
};

export default Navbar;