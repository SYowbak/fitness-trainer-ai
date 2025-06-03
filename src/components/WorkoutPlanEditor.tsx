import React, { useState } from 'react';
import { DailyWorkoutPlan, Exercise } from '../types/workout';
import { generateSingleExercise } from '../../services/geminiService';

interface WorkoutPlanEditorProps {
  plan: DailyWorkoutPlan[];
  onSave: (updatedPlan: DailyWorkoutPlan[]) => void;
  onCancel: () => void;
}

export const WorkoutPlanEditor: React.FC<WorkoutPlanEditorProps> = ({ plan, onSave, onCancel }) => {
  const [editedPlan, setEditedPlan] = useState<DailyWorkoutPlan[]>(plan);
  const [isGeneratingExercise, setIsGeneratingExercise] = useState(false);

  const handleDeleteExercise = (dayIndex: number, exerciseIndex: number) => {
    const newPlan = [...editedPlan];
    newPlan[dayIndex].exercises.splice(exerciseIndex, 1);
    setEditedPlan(newPlan);
  };

  const handleAddExercise = async (dayIndex: number, exerciseName?: string) => {
    setIsGeneratingExercise(true);
    try {
      let newExercise: Exercise;
      
      if (exerciseName) {
        // Генеруємо вправу на основі назви
        const generatedExercise = await generateSingleExercise(exerciseName);
        newExercise = {
          ...generatedExercise,
          sets: String(generatedExercise.sets),
          reps: String(generatedExercise.reps),
          rest: String(generatedExercise.rest),
          weight: generatedExercise.weight ? String(generatedExercise.weight) : undefined,
          videoSearchQuery: generatedExercise.videoSearchQuery || undefined,
          imageSuggestion: generatedExercise.imageSuggestion || undefined,
          targetWeight: generatedExercise.targetWeight ? String(generatedExercise.targetWeight) : undefined,
          targetReps: generatedExercise.targetReps ? String(generatedExercise.targetReps) : undefined
        };
      } else {
        // Генеруємо випадкову вправу
        const generatedExercise = await generateSingleExercise();
        newExercise = {
          ...generatedExercise,
          sets: String(generatedExercise.sets),
          reps: String(generatedExercise.reps),
          rest: String(generatedExercise.rest),
          weight: generatedExercise.weight ? String(generatedExercise.weight) : undefined,
          videoSearchQuery: generatedExercise.videoSearchQuery || undefined,
          imageSuggestion: generatedExercise.imageSuggestion || undefined,
          targetWeight: generatedExercise.targetWeight ? String(generatedExercise.targetWeight) : undefined,
          targetReps: generatedExercise.targetReps ? String(generatedExercise.targetReps) : undefined
        };
      }

      const newPlan = [...editedPlan];
      newPlan[dayIndex].exercises.push(newExercise);
      setEditedPlan(newPlan);
    } catch (error) {
      console.error('Помилка при генерації вправи:', error);
    } finally {
      setIsGeneratingExercise(false);
    }
  };

  const handleRegenerateExercise = async (dayIndex: number, exerciseIndex: number) => {
    setIsGeneratingExercise(true);
    try {
      const exercise = editedPlan[dayIndex].exercises[exerciseIndex];
      const generatedExercise = await generateSingleExercise(exercise.name);
      const newExercise: Exercise = {
        ...generatedExercise,
        sets: String(generatedExercise.sets),
        reps: String(generatedExercise.reps),
        rest: String(generatedExercise.rest),
        weight: generatedExercise.weight ? String(generatedExercise.weight) : undefined,
        videoSearchQuery: generatedExercise.videoSearchQuery || undefined,
        imageSuggestion: generatedExercise.imageSuggestion || undefined,
        targetWeight: generatedExercise.targetWeight ? String(generatedExercise.targetWeight) : undefined,
        targetReps: generatedExercise.targetReps ? String(generatedExercise.targetReps) : undefined
      };
      
      const newPlan = [...editedPlan];
      newPlan[dayIndex].exercises[exerciseIndex] = newExercise;
      setEditedPlan(newPlan);
    } catch (error) {
      console.error('Помилка при перегенерації вправи:', error);
    } finally {
      setIsGeneratingExercise(false);
    }
  };

  const handleUpdateExercise = (dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
    const newPlan = [...editedPlan];
    newPlan[dayIndex].exercises[exerciseIndex] = {
      ...newPlan[dayIndex].exercises[exerciseIndex],
      [field]: value
    };
    setEditedPlan(newPlan);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Редагування плану тренувань</h2>
        <div className="space-x-2">
          <button
            onClick={() => onSave(editedPlan)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            Зберегти зміни
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            Скасувати
          </button>
        </div>
      </div>

      {editedPlan.map((day, dayIndex) => (
        <div key={dayIndex} className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-xl font-semibold mb-4">День {day.day}</h3>
          
          <div className="space-y-4">
            {day.exercises.map((exercise, exerciseIndex) => (
              <div key={exerciseIndex} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <input
                    type="text"
                    value={exercise.name}
                    onChange={(e) => handleUpdateExercise(dayIndex, exerciseIndex, 'name', e.target.value)}
                    className="bg-gray-600 text-white px-3 py-2 rounded-lg w-full mr-2"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleRegenerateExercise(dayIndex, exerciseIndex)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg"
                      disabled={isGeneratingExercise}
                    >
                      Перегенерувати
                    </button>
                    <button
                      onClick={() => handleDeleteExercise(dayIndex, exerciseIndex)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
                    >
                      Видалити
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Підходи</label>
                    <input
                      type="text"
                      value={exercise.sets}
                      onChange={(e) => handleUpdateExercise(dayIndex, exerciseIndex, 'sets', e.target.value)}
                      className="bg-gray-600 text-white px-3 py-2 rounded-lg w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Повторення</label>
                    <input
                      type="text"
                      value={exercise.reps}
                      onChange={(e) => handleUpdateExercise(dayIndex, exerciseIndex, 'reps', e.target.value)}
                      className="bg-gray-600 text-white px-3 py-2 rounded-lg w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Відпочинок</label>
                    <input
                      type="text"
                      value={exercise.rest}
                      onChange={(e) => handleUpdateExercise(dayIndex, exerciseIndex, 'rest', e.target.value)}
                      className="bg-gray-600 text-white px-3 py-2 rounded-lg w-full"
                    />
                  </div>
                </div>

                <div className="mb-2">
                  <label className="block text-sm font-medium mb-1">Опис</label>
                  <textarea
                    value={exercise.description}
                    onChange={(e) => handleUpdateExercise(dayIndex, exerciseIndex, 'description', e.target.value)}
                    className="bg-gray-600 text-white px-3 py-2 rounded-lg w-full h-32"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Пошуковий запит для YouTube</label>
                  <input
                    type="text"
                    value={exercise.videoSearchQuery}
                    onChange={(e) => handleUpdateExercise(dayIndex, exerciseIndex, 'videoSearchQuery', e.target.value)}
                    className="bg-gray-600 text-white px-3 py-2 rounded-lg w-full"
                  />
                </div>
              </div>
            ))}

            <div className="flex space-x-2">
              <button
                onClick={() => handleAddExercise(dayIndex)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                disabled={isGeneratingExercise}
              >
                Додати випадкову вправу
              </button>
              <button
                onClick={() => {
                  const exerciseName = prompt('Введіть назву вправи:');
                  if (exerciseName) {
                    handleAddExercise(dayIndex, exerciseName);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                disabled={isGeneratingExercise}
              >
                Додати вправу за назвою
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 