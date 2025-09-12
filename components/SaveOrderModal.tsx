import React from 'react';
import { Exercise } from '../types';

interface SaveOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscard: () => void;
  reorderedExercises: Exercise[];
  originalExercises: Exercise[];
}

const SaveOrderModal: React.FC<SaveOrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  reorderedExercises,
  originalExercises
}) => {
  if (!isOpen) return null;

  // Check if order actually changed
  const orderChanged = reorderedExercises.some((exercise, index) => 
    exercise.id !== originalExercises[index]?.id
  );

  if (!orderChanged) {
    // If no changes, auto-close
    setTimeout(onClose, 0);
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center mb-4">
          <i className="fas fa-question-circle text-yellow-400 text-2xl mr-3"></i>
          <h3 className="text-xl font-semibold text-white">
            Зберегти порядок вправ?
          </h3>
        </div>
        
        <p className="text-gray-300 mb-6">
          Ви змінили порядок вправ під час тренування. Хочете зберегти цей новий порядок 
          для майбутніх тренувань цього дня?
        </p>

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-2">Новий порядок:</p>
          <div className="bg-gray-700/50 p-3 rounded text-sm">
            {reorderedExercises.map((exercise, index) => (
              <div key={exercise.id} className="flex items-center mb-1 last:mb-0">
                <span className="text-purple-300 font-mono mr-2">{index + 1}.</span>
                <span className="text-gray-200">{exercise.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
          >
            <i className="fas fa-save mr-2"></i>
            Зберегти
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
          >
            <i className="fas fa-times mr-2"></i>
            Не зберігати
          </button>
        </div>
        
        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
        >
          Скасувати
        </button>
      </div>
    </div>
  );
};

export default SaveOrderModal;