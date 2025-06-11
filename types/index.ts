export type UserProfile = {
  gender: string;
  age: number;
  height: number;
  weight: number;
  bodyType: string;
  experienceLevel: string;
  fitnessGoal: string;
  targetMuscleGroups: string[];
};

export type WorkoutLog = {
  id: string;
  date: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: number;
    weight: number;
    notes?: string;
  }>;
  duration: number;
  notes?: string;
}; 