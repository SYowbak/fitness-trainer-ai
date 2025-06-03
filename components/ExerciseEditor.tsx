import React, { useState } from 'react';
import { Exercise, MuscleGroup } from '../types';
import { MUSCLE_GROUP_OPTIONS } from '../constants';
import Spinner from './Spinner';

interface ExerciseEditorProps {
  exercise: Exercise;
  userProfile: any;
  onSave: (updatedExercise: Exercise) => void;
  onDelete: () => void;
  onRegenerate: (targetMuscleGroup: MuscleGroup) => Promise<void>;
  onCancel: () => void;
}

const ExerciseEditor: React.FC<ExerciseEditorProps> = ({
  exercise,
  onSave,
  onDelete,
  onRegenerate,
  onCancel
}) => {
  const [editedExercise, setEditedExercise] = useState<Exercise>(exercise);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>(MUSCLE_GROUP_OPTIONS[0].value as MuscleGroup);

  const handleInputChange = (field: keyof Exercise, value: string) => {
    setEditedExercise(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(editedExercise);
  };

  const handleRegenerate = async () => {
    setIsLoading(true);
    try {
      await onRegenerate(selectedMuscleGroup);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <Spinner message="Генерація вправи..." />;
  }

  return (
    <div className="bg-gray-800/80 rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-purple-300">Редагування вправи</h3>
        <div className="space-x-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
          >
            Скасувати
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-500"
          >
            Зберегти
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500"
          >
            Видалити
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-purple-200 mb-1">Назва вправи</label>
          <input
            type="text"
            value={editedExercise.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-200 mb-1">Опис техніки</label>
          <textarea
            value={editedExercise.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200 h-32"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1">Підходи</label>
            <input
              type="text"
              value={editedExercise.sets}
              onChange={(e) => handleInputChange('sets', e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1">Повторення</label>
            <input
              type="text"
              value={editedExercise.reps}
              onChange={(e) => handleInputChange('reps', e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1">Відпочинок</label>
            <input
              type="text"
              value={editedExercise.rest}
              onChange={(e) => handleInputChange('rest', e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-200 mb-1">Пропозиція для зображення</label>
          <input
            type="text"
            value={editedExercise.imageSuggestion || ''}
            onChange={(e) => handleInputChange('imageSuggestion', e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-200 mb-1">Пошуковий запит для відео</label>
          <input
            type="text"
            value={editedExercise.videoSearchQuery || ''}
            onChange={(e) => handleInputChange('videoSearchQuery', e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
          />
        </div>

        <div className="flex items-center space-x-4">
          <select
            value={selectedMuscleGroup}
            onChange={(e) => setSelectedMuscleGroup(e.target.value as MuscleGroup)}
            className="p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
          >
            {MUSCLE_GROUP_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleRegenerate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Перегенерувати вправу
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExerciseEditor; 