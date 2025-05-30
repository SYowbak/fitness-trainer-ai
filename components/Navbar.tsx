import React from 'react';
import { UI_TEXT } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../config/firebase';
import { deleteUser } from 'firebase/auth';

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
  const { user, logout } = useAuth();

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!window.confirm('Ви впевнені, що хочете видалити свій акаунт? Цю дію не можна скасувати!')) return;
    try {
      await deleteUser(auth.currentUser!);
      alert('Акаунт успішно видалено.');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert('Для видалення акаунта потрібно повторно увійти. Вийдіть і увійдіть знову, потім спробуйте ще раз.');
      } else {
        alert('Помилка при видаленні акаунта: ' + error.message);
      }
    }
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
      {user && (
        <>
          <button
            onClick={logout}
            className="ml-2 px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow transition"
          >
            <i className="fas fa-sign-out-alt mr-1"></i>Вийти
          </button>
          <button
            onClick={handleDeleteAccount}
            className="ml-2 px-3 py-2 rounded-md bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium shadow transition border border-red-400"
          >
            <i className="fas fa-user-slash mr-1"></i>Видалити акаунт
          </button>
        </>
      )}
    </nav>
  );
};

export default Navbar;