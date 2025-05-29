import { UserProfile, DailyWorkoutPlan, WorkoutLog } from '../types';
import { UI_TEXT } from '../constants';

const USER_PROFILE_KEY = 'fitnessAiAppUserProfile_v1';
const WORKOUT_PLAN_KEY = 'fitnessAiAppWorkoutPlan_v1';
const WORKOUT_LOGS_KEY = 'fitnessAiAppWorkoutLogs_v1';

const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = '__testLocalStorageFitnessAI__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn(UI_TEXT.localStorageNotSupported + ' ' + (e as Error).message);
    return false;
  }
};

export const saveUserProfile = (profile: UserProfile): void => {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("Error saving user profile to localStorage:", e);
  }
};

export const loadUserProfile = (): UserProfile | null => {
  if (!isLocalStorageAvailable()) return null;
  try {
    const data = localStorage.getItem(USER_PROFILE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error loading user profile from localStorage:", e);
    return null;
  }
};

export const saveWorkoutPlan = (plan: DailyWorkoutPlan[] | null): void => {
  if (!isLocalStorageAvailable()) return;
  try {
    if (plan === null) {
      localStorage.removeItem(WORKOUT_PLAN_KEY);
    } else {
      localStorage.setItem(WORKOUT_PLAN_KEY, JSON.stringify(plan));
    }
  } catch (e) {
    console.error("Error saving workout plan to localStorage:", e);
  }
};

export const loadWorkoutPlan = (): DailyWorkoutPlan[] | null => {
  if (!isLocalStorageAvailable()) return null;
  try {
    const data = localStorage.getItem(WORKOUT_PLAN_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error loading workout plan from localStorage:", e);
    return null;
  }
};

export const saveWorkoutLogs = (logs: WorkoutLog[]): void => {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(WORKOUT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Error saving workout logs to localStorage:", e);
  }
};

export const loadWorkoutLogs = (): WorkoutLog[] => {
  if (!isLocalStorageAvailable()) return [];
  try {
    const data = localStorage.getItem(WORKOUT_LOGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error loading workout logs from localStorage:", e);
    return [];
  }
};
