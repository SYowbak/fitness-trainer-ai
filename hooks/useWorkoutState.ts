import { useState } from 'react';
import { DailyWorkoutPlan, LoggedExercise } from '../types';

interface WorkoutState {
  currentDay: number;
  workoutPlan: DailyWorkoutPlan | null;
  loggedExercises: LoggedExercise[];
  startTime: number;
}

export const useWorkoutState = () => {
  const [state, setState] = useState<WorkoutState>({
    currentDay: 1,
    workoutPlan: null,
    loggedExercises: [],
    startTime: Date.now()
  });

  // Очищаємо стан при завершенні тренування
  const clearWorkoutState = () => {
    setState({
      currentDay: 1,
      workoutPlan: null,
      loggedExercises: [],
      startTime: Date.now()
    });
  };

  // Оновлюємо план тренування
  const setWorkoutPlan = (plan: DailyWorkoutPlan) => {
    setState(prev => ({
      ...prev,
      workoutPlan: plan,
      startTime: Date.now()
    }));
  };

  // Додаємо залоговану вправу
  const addLoggedExercise = (exercise: LoggedExercise) => {
    setState(prev => ({
      ...prev,
      loggedExercises: [...prev.loggedExercises, exercise]
    }));
  };

  // Оновлюємо поточний день
  const setCurrentDay = (day: number) => {
    setState(prev => ({
      ...prev,
      currentDay: day
    }));
  };

  return {
    state,
    setWorkoutPlan,
    addLoggedExercise,
    setCurrentDay,
    clearWorkoutState
  };
}; 