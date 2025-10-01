import React from 'react';

interface WorkoutCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-gray-800 border border-fitness-gold-500/50 rounded-xl shadow-2xl max-w-md w-full p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-green-400 mb-5">
          <i className="fas fa-check-circle fa-4x animate-pulse"></i>
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Тренування завершено!</h2>
        <p className="text-gray-300 mb-2">
          Чудова робота! Ваше тренування збережено та відправлено на аналіз.
        </p>
        <p className="text-gray-300 mb-6">
          Результати, рекомендації та адаптований план будуть доступні у вкладці 'Прогрес'.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-fitness-gold-600 text-white rounded-lg hover:bg-fitness-gold-700 transition-colors py-3 font-semibold text-lg"
        >
          Перейти до Прогресу
        </button>
      </div>
    </div>
  );
};

export default WorkoutCompleteModal; 