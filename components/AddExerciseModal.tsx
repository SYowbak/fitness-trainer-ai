import React, { useState, useEffect } from 'react';
import { Exercise, WeightType } from '../types';

interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => Promise<void> | void;
}

const AddExerciseModal: React.FC<AddExerciseModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sets, setSets] = useState<string>('3');
  const [reps, setReps] = useState<string>('8-12');
  const [rest, setRest] = useState<string>('60 секунд');
  const [targetWeight, setTargetWeight] = useState<string>('');
  const [weightType, setWeightType] = useState<WeightType>('total'); // Додаємо стан для weightType
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Функція для визначення weightType на основі назви вправи
  const determineWeightType = (exerciseName: string): WeightType => {
    const lowerCaseName = exerciseName.toLowerCase();
    if (lowerCaseName.includes('штанга') || lowerCaseName.includes('жим') || lowerCaseName.includes('присід') || lowerCaseName.includes('тяга')) {
      return 'total';
    }
    if (lowerCaseName.includes('гантел') || lowerCaseName.includes('гир')) {
      return 'single';
    }
    if (lowerCaseName.includes('віджиман') || lowerCaseName.includes('підтягуван') || lowerCaseName.includes('планка') || lowerCaseName.includes('прес') || lowerCaseName.includes('своєю вагою')) {
      return 'bodyweight';
    }
    if (lowerCaseName.includes('розтяжка') || lowerCaseName.includes('кардіо') || lowerCaseName.includes('біг')) {
      return 'none';
    }
    return 'total'; // За замовчуванням
  };

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setSets('3');
      setReps('8-12');
      setRest('60 секунд');
      setTargetWeight('');
      setWeightType('total'); // Скидаємо weightType
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setWeightType(determineWeightType(name));
    if (determineWeightType(name) === 'bodyweight') {
      setTargetWeight('0'); // Для власної ваги встановлюємо 0
    } else if (determineWeightType(name) === 'none') {
      setTargetWeight(''); // Для без ваги очищаємо поле
    }
  }, [name]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-3 z-[110]" onClick={onClose}>
      <div className="bg-gray-700 p-4 sm:p-5 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg sm:text-xl font-semibold text-purple-300">Додати вправу</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-purple-200 mb-1">Назва*</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
              placeholder="Наприклад: Жим гантелей сидячи"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-purple-200 mb-1">Опис (необов’язково)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
              rows={3}
              placeholder="Короткий опис техніки"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-purple-200 mb-1">Підходи</label>
              <input
                type="number"
                min="1"
                value={parseInt(sets) || ''}
                onChange={(e) => setSets(e.target.value || '1')}
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-200 mb-1">Повторення</label>
              <input
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                placeholder="8-12"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-200 mb-1">Відпочинок</label>
              <input
                value={rest}
                onChange={(e) => setRest(e.target.value)}
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                placeholder="60 секунд"
              />
            </div>
          </div>
          {weightType !== 'none' && (
            <div>
              <label className="block text-xs text-purple-200 mb-1">
                Цільова вага (кг) {weightType === 'total' ? '(загальна)' : weightType === 'single' ? '(1 гантель)' : weightType === 'bodyweight' ? '(вага тіла)' : ''}
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-100 text-sm"
                disabled={weightType === 'bodyweight'}
                placeholder={weightType === 'bodyweight' ? '0' : ''}
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">Скасувати</button>
            <button
              disabled={!name || isSubmitting}
              onClick={async () => {
                if (!name) return;
                setIsSubmitting(true);
                const ex: Exercise = {
                  id: 'custom_' + Date.now().toString(),
                  name,
                  description: description || 'Користувацька вправа',
                  sets,
                  reps,
                  rest,
                  videoSearchQuery: null,
                  weightType: weightType, // Додаємо weightType
                  targetWeight: targetWeight === '' ? null : parseFloat(targetWeight),
                  targetReps: null,
                  recommendation: null,
                  isCompletedDuringSession: false,
                  sessionLoggedSets: [],
                  sessionSuccess: false,
                  notes: null,
                };
                try {
                  await onAdd(ex);
                  onClose();
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className={`px-4 py-2 rounded text-white text-sm ${!name || isSubmitting ? 'bg-purple-700/60 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              Додати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddExerciseModal;


