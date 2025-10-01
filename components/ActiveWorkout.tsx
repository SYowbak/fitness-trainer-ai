import React, { useEffect } from 'react';
import { useTimer } from '../hooks/useTimer';
import { useWorkoutState } from '../hooks/useWorkoutState';
import { formatTime } from '../utils/time';
import { UI_TEXT } from '../constants';

interface ActiveWorkoutProps {
  onComplete: () => void;
}

export const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({ onComplete }) => {
  const { time, isRunning, start, pause, resume, stop } = useTimer();
  const { state, clearWorkoutState } = useWorkoutState();

  // Відновлюємо таймер при завантаженні
  useEffect(() => {
    if (state.startTime) {
      start();
    }
  }, []);

  // Зберігаємо стан при закритті вкладки
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.loggedExercises.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.loggedExercises]);

  const handleComplete = () => {
    stop();
    clearWorkoutState();
    onComplete();
  };

  if (!state.workoutPlan) {
    return <div>План тренування не знайдено</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">
          {UI_TEXT.activeWorkoutDay} {state.currentDay}
        </h2>
        <div className="text-lg">
          {UI_TEXT.workoutDuration}: {formatTime(time)}
        </div>
      </div>

      {/* Тут буде відображення вправ та логування */}
      
      <div className="flex justify-end space-x-2">
        <button
          onClick={isRunning ? pause : resume}
          className="px-4 py-2 bg-fitness-gold-600 text-white rounded hover:bg-fitness-gold-700"
        >
          {isRunning ? 'Пауза' : 'Продовжити'}
        </button>
        <button
          onClick={handleComplete}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {UI_TEXT.endWorkout}
        </button>
      </div>
    </div>
  );
}; 