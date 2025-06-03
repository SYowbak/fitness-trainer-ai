import React, { useState } from 'react';
import { DailyWorkoutPlan, Exercise, MuscleGroup } from '../types';
import { generateSingleExercise } from '../services/geminiService';
import ExerciseEditor from './ExerciseEditor';
import Spinner from './Spinner';

interface WorkoutPlanProps {
  plan: DailyWorkoutPlan;
  userProfile: any;
  onUpdatePlan: (updatedPlan: DailyWorkoutPlan) => void;
}

const WorkoutPlan: React.FC<WorkoutPlanProps> = ({ plan, userProfile, onUpdatePlan }) => {
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);

  const handleEditExercise = (index: number) => {
    setEditingExerciseIndex(index);
  };

  const handleSaveExercise = (updatedExercise: Exercise) => {
    const updatedExercises = [...plan.exercises];
    updatedExercises[editingExerciseIndex!] = updatedExercise;
    onUpdatePlan({ ...plan, exercises: updatedExercises });
    setEditingExerciseIndex(null);
  };

  const handleDeleteExercise = () => {
    const updatedExercises = plan.exercises.filter((_, index) => index !== editingExerciseIndex);
    onUpdatePlan({ ...plan, exercises: updatedExercises });
    setEditingExerciseIndex(null);
  };

  const handleRegenerateExercise = async (targetMuscleGroup: MuscleGroup) => {
    setIsLoading(true);
    try {
      const newExercise = await generateSingleExercise(userProfile, targetMuscleGroup);
      const updatedExercises = [...plan.exercises];
      updatedExercises[editingExerciseIndex!] = newExercise;
      onUpdatePlan({ ...plan, exercises: updatedExercises });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExercise = async (targetMuscleGroup: MuscleGroup) => {
    setIsLoading(true);
    try {
      const newExercise = await generateSingleExercise(userProfile, targetMuscleGroup);
      onUpdatePlan({
        ...plan,
        exercises: [...plan.exercises, newExercise]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveExercise = (fromIndex: number, toIndex: number) => {
    const updatedExercises = [...plan.exercises];
    const [movedExercise] = updatedExercises.splice(fromIndex, 1);
    updatedExercises.splice(toIndex, 0, movedExercise);
    onUpdatePlan({ ...plan, exercises: updatedExercises });
  };

  if (isLoading) {
    return <Spinner message="Генерація вправи..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-purple-300">День {plan.day}</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsEditingPlan(!isEditingPlan)}
            className={`px-4 py-2 rounded ${
              isEditingPlan 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {isEditingPlan ? 'Завершити редагування' : 'Редагувати план'}
          </button>
        </div>
      </div>

      {isEditingPlan && (
        <div className="flex space-x-2 mb-4">
          <select
            onChange={(e) => handleAddExercise(e.target.value as MuscleGroup)}
            className="p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
          >
            <option value="">Додати вправу для...</option>
            {Object.values(MuscleGroup).map(group => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-4">
        {plan.exercises.map((exercise, index) => (
          <div key={index} className="bg-gray-800/80 rounded-lg p-4">
            {editingExerciseIndex === index ? (
              <ExerciseEditor
                exercise={exercise}
                userProfile={userProfile}
                onSave={handleSaveExercise}
                onDelete={handleDeleteExercise}
                onRegenerate={handleRegenerateExercise}
                onCancel={() => setEditingExerciseIndex(null)}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-semibold text-purple-300">{exercise.name}</h3>
                  {isEditingPlan && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditExercise(index)}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-500"
                      >
                        Редагувати
                      </button>
                      {index > 0 && (
                        <button
                          onClick={() => handleMoveExercise(index, index - 1)}
                          className="px-3 py-1 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                        >
                          ↑
                        </button>
                      )}
                      {index < plan.exercises.length - 1 && (
                        <button
                          onClick={() => handleMoveExercise(index, index + 1)}
                          className="px-3 py-1 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const updatedExercises = plan.exercises.filter((_, i) => i !== index);
                          onUpdatePlan({ ...plan, exercises: updatedExercises });
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500"
                      >
                        Видалити
                      </button>
                    </div>
                  )}
                </div>

                <div className="prose prose-invert max-w-none">
                  <p className="text-gray-300 whitespace-pre-line">{exercise.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-purple-300">Підходи:</span> {exercise.sets}
                  </div>
                  <div>
                    <span className="text-purple-300">Повторення:</span> {exercise.reps}
                  </div>
                  <div>
                    <span className="text-purple-300">Відпочинок:</span> {exercise.rest}
                  </div>
                </div>

                {exercise.imageSuggestion && (
                  <div className="text-sm text-gray-400">
                    <span className="text-purple-300">Пропозиція для зображення:</span> {exercise.imageSuggestion}
                  </div>
                )}

                {exercise.videoSearchQuery && (
                  <div className="text-sm text-gray-400">
                    <span className="text-purple-300">Пошуковий запит для відео:</span> {exercise.videoSearchQuery}
                  </div>
                )}

                {!isEditingPlan && (
                  <button
                    onClick={() => handleEditExercise(index)}
                    className="mt-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-500"
                  >
                    Редагувати вправу
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkoutPlan; 