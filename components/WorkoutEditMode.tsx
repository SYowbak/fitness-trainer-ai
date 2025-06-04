import React, { useState } from 'react';
import { DailyWorkoutPlan, Exercise, UserProfile } from '../types';
import { generateNewExercise, regenerateExercise, completeExerciseDetails } from '../services/workoutEditService';
import Spinner from './Spinner';
import { UI_TEXT } from '../constants';

interface WorkoutEditModeProps {
  userProfile: UserProfile;
  workoutPlan: DailyWorkoutPlan[];
  onSavePlan: (plan: DailyWorkoutPlan[]) => void;
  onCancel: () => void;
}

const WorkoutEditMode: React.FC<WorkoutEditModeProps> = ({
  userProfile,
  workoutPlan,
  onSavePlan,
  onCancel,
}) => {
  const [editedPlan, setEditedPlan] = useState<DailyWorkoutPlan[]>(workoutPlan);
  const [selectedDay, setSelectedDay] = useState<number>(workoutPlan[0]?.day || 1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingExerciseIndex, setLoadingExerciseIndex] = useState<number | null>(null);
  const [changedExerciseNames, setChangedExerciseNames] = useState<Set<string>>(new Set());

  const handleDeleteExercise = (dayNumber: number, exerciseIndex: number) => {
    setEditedPlan(prevPlan => {
      const newPlan = [...prevPlan];
      const dayIndex = newPlan.findIndex(d => d.day === dayNumber);
      if (dayIndex !== -1) {
        newPlan[dayIndex] = {
          ...newPlan[dayIndex],
          exercises: newPlan[dayIndex].exercises.filter((_, index) => index !== exerciseIndex)
        };
      }
      return newPlan;
    });
  };

  const handleAddExercise = async (dayNumber: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const newExercise = await generateNewExercise(userProfile, editedPlan, dayNumber);
      setEditedPlan(prevPlan => {
        const newPlan = [...prevPlan];
        const dayIndex = newPlan.findIndex(d => d.day === dayNumber);
        if (dayIndex !== -1) {
          newPlan[dayIndex] = {
            ...newPlan[dayIndex],
            exercises: [...newPlan[dayIndex].exercises, newExercise]
          };
        }
        return newPlan;
      });
    } catch (e: any) {
      setError(e.message || 'Помилка при додаванні вправи');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateExercise = async (dayNumber: number, exerciseIndex: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const regeneratedExercise = await regenerateExercise(userProfile, editedPlan, dayNumber, exerciseIndex);
      setEditedPlan(prevPlan => {
        const newPlan = [...prevPlan];
        const dayIndex = newPlan.findIndex(d => d.day === dayNumber);
        if (dayIndex !== -1) {
          newPlan[dayIndex] = {
            ...newPlan[dayIndex],
            exercises: newPlan[dayIndex].exercises.map((ex, index) => 
              index === exerciseIndex ? regeneratedExercise : ex
            )
          };
        }
        return newPlan;
      });
    } catch (e: any) {
      setError(e.message || 'Помилка при перегенерації вправи');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateExercise = (dayNumber: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
    setEditedPlan(prevPlan => {
      const newPlan = [...prevPlan];
      const dayIndex = newPlan.findIndex(d => d.day === dayNumber);
      if (dayIndex !== -1) {
        newPlan[dayIndex] = {
          ...newPlan[dayIndex],
          exercises: newPlan[dayIndex].exercises.map((ex, index) => {
            if (index === exerciseIndex) {
              if (field === 'name') {
                setChangedExerciseNames(prev => new Set(prev).add(`${dayNumber}-${exerciseIndex}`));
              }
              return { ...ex, [field]: value };
            }
            return ex;
          })
        };
      }
      return newPlan;
    });
  };

  const handleCompleteDetails = async (dayNumber: number, exerciseIndex: number) => {
    setIsLoading(true);
    setLoadingExerciseIndex(exerciseIndex);
    setError(null);
    try {
      const dayIndex = editedPlan.findIndex(d => d.day === dayNumber);
      if (dayIndex === -1) throw new Error("День не знайдено");
      
      const exerciseToComplete = editedPlan[dayIndex].exercises[exerciseIndex];
      if (!exerciseToComplete) throw new Error("Вправу не знайдено");

      const completedExercise = await completeExerciseDetails(userProfile, editedPlan, dayNumber, exerciseToComplete);
      
      setEditedPlan(prevPlan => {
        const newPlan = [...prevPlan];
        const dayIdx = newPlan.findIndex(d => d.day === dayNumber);
        if (dayIdx !== -1) {
          newPlan[dayIdx] = {
            ...newPlan[dayIdx],
            exercises: newPlan[dayIdx].exercises.map((ex, idx) => 
              idx === exerciseIndex ? completedExercise : ex
            )
          };
        }
        return newPlan;
      });
    } catch (e: any) {
      setError(e.message || 'Помилка при доповненні деталей вправи');
    } finally {
      setIsLoading(false);
      setLoadingExerciseIndex(null);
    }
  };

  const currentDayPlan = editedPlan.find(p => p.day === selectedDay);

  return (
    <div className="p-4 bg-gray-800/80 rounded-lg shadow-xl backdrop-blur-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-purple-300">Редагування плану тренувань</h2>
        <div className="space-x-2">
          <button
            onClick={() => onSavePlan(editedPlan)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Зберегти зміни
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Скасувати
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-gray-300 mb-2">Виберіть день:</label>
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
        >
          {editedPlan.map(day => (
            <option key={day.day} value={day.day}>
              День {day.day}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner message="Генерація вправи..." />
      ) : (
        <div className="space-y-6">
          {currentDayPlan?.exercises.map((exercise, index) => (
            <div key={index} className="p-4 bg-gray-700/50 rounded-lg">
              <div className="flex justify-end items-center space-x-2 mb-2">
                {isLoading && loadingExerciseIndex === index ? (
                  <Spinner message="" />
                ) : (
                  <button
                    onClick={() => handleCompleteDetails(selectedDay, index)}
                    className={`px-3 py-1 rounded transition-colors text-sm ${
                      changedExerciseNames.has(`${selectedDay}-${index}`)
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-500 cursor-not-allowed text-gray-400'
                    }`}
                    title={UI_TEXT.completeExerciseDetails}
                    disabled={!changedExerciseNames.has(`${selectedDay}-${index}`)}
                  >
                    {UI_TEXT.completeExerciseDetails}
                  </button>
                )}
                <button
                  onClick={() => handleRegenerateExercise(selectedDay, index)}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Перегенерувати вправу"
                >
                  Перегенерувати
                </button>
                <button
                  onClick={() => handleDeleteExercise(selectedDay, index)}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  title="Видалити вправу"
                >
                  Видалити
                </button>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  value={exercise.name}
                  onChange={(e) => handleUpdateExercise(selectedDay, index, 'name', e.target.value)}
                  className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-gray-300 mb-1">Підходи:</label>
                  <input
                    type="text"
                    value={exercise.sets}
                    onChange={(e) => handleUpdateExercise(selectedDay, index, 'sets', e.target.value)}
                    className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Повторення:</label>
                  <input
                    type="text"
                    value={exercise.reps}
                    onChange={(e) => handleUpdateExercise(selectedDay, index, 'reps', e.target.value)}
                    className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Відпочинок:</label>
                  <input
                    type="text"
                    value={exercise.rest}
                    onChange={(e) => handleUpdateExercise(selectedDay, index, 'rest', e.target.value)}
                    className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Опис техніки:</label>
                <textarea
                  value={exercise.description}
                  onChange={(e) => handleUpdateExercise(selectedDay, index, 'description', e.target.value)}
                  className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 h-32"
                />
              </div>
            </div>
          ))}

          <button
            onClick={() => handleAddExercise(selectedDay)}
            className="w-full p-3 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center justify-center"
          >
            <i className="fas fa-plus mr-2"></i>
            Додати нову вправу
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkoutEditMode; 