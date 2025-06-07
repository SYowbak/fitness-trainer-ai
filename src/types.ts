export interface Exercise {
  id: string;
  name: string;
  description: string;
  sets: number;
  reps: number;
  weight: number;
  muscleGroup: string;
  imageSuggestion?: string;
  isCompleted?: boolean;
}

export interface Workout {
  id: string;
  name: string;
  exercises: Exercise[];
  createdAt: number;
  isCompleted?: boolean;
}

export interface UserData {
  workouts: Workout[];
  currentWorkout?: Workout;
  lastWorkoutDate?: number;
  streak: number;
  totalWorkouts: number;
  totalExercises: number;
  totalWeight: number;
  favoriteExercises: string[];
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

export interface WorkoutSession {
  workoutId: string;
  startTime: number;
  endTime?: number;
  exercises: {
    exerciseId: string;
    sets: {
      reps: number;
      weight: number;
      isCompleted: boolean;
    }[];
  }[];
  isCompleted: boolean;
  success: boolean;
} 