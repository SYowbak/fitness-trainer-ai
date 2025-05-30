import { useState, useEffect } from 'react';
import { DailyWorkoutPlan, LoggedExercise } from '../types';

interface WorkoutState {
  currentDay: number;
  workoutPlan: DailyWorkoutPlan | null;
  loggedExercises: LoggedExercise[];
  startTime: number;
}

const STORAGE_KEY = 'workout_state';

export const useWorkoutState = () => {
  const [state, setState] = useState<WorkoutState>(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    return savedState ? JSON.parse(savedState) : {
      currentDay: 1,
      workoutPlan: null,
      loggedExercises: [],
      startTime: Date.now()
    };
  });

  // Зберігаємо стан при кожній зміні
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Очищаємо стан при завершенні тренування
  const clearWorkoutState = () => {
    localStorage.removeItem(STORAGE_KEY);
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