import React, { useState } from 'react';
import { DailyWorkoutPlan } from '../types/workout';
import { WorkoutPlanEditor } from './WorkoutPlanEditor';

interface WorkoutPlanProps {
  plan: DailyWorkoutPlan[];
  onPlanUpdate?: (updatedPlan: DailyWorkoutPlan[]) => void;
}

export const WorkoutPlan: React.FC<WorkoutPlanProps> = ({ plan, onPlanUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<DailyWorkoutPlan[]>(plan);

  const handleSave = (updatedPlan: DailyWorkoutPlan[]) => {
    setCurrentPlan(updatedPlan);
    setIsEditing(false);
    if (onPlanUpdate) {
      onPlanUpdate(updatedPlan);
    }
  };

  if (isEditing) {
    return (
      <WorkoutPlanEditor
        plan={currentPlan}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">План тренувань</h2>
        <button
          onClick={() => setIsEditing(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Редагувати план
        </button>
      </div>

      {currentPlan.map((day, dayIndex) => (
        <div key={dayIndex} className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-xl font-semibold mb-4">День {day.day}</h3>
          
          <div className="mb-4">
            <h4 className="font-medium mb-2">Розминка:</h4>
            <p className="text-gray-300">{day.warmup}</p>
          </div>

          <div className="space-y-4">
            {day.exercises.map((exercise, exerciseIndex) => (
              <div key={exerciseIndex} className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-lg font-medium mb-2">{exercise.name}</h4>
                
                <div className="grid grid-cols-3 gap-4 mb-2">
                  <div>
                    <span className="text-gray-400">Підходи:</span>
                    <span className="ml-2">{exercise.sets}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Повторення:</span>
                    <span className="ml-2">{exercise.reps}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Відпочинок:</span>
                    <span className="ml-2">{exercise.rest}</span>
                  </div>
                </div>

                <details className="mb-2">
                  <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                    Показати опис техніки
                  </summary>
                  <div className="mt-2 text-gray-300">
                    {exercise.description}
                  </div>
                </details>

                {exercise.videoSearchQuery && (
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoSearchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center"
                  >
                    <i className="fab fa-youtube mr-2"></i>
                    Дивитися відео на YouTube
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h4 className="font-medium mb-2">Заминка:</h4>
            <p className="text-gray-300">{day.cooldown}</p>
          </div>

          {day.notes && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Нотатки:</h4>
              <p className="text-gray-300">{day.notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}; 