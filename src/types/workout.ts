export interface Exercise {
  name: string;
  description?: string;
  sets: string;
  reps: string;
  rest?: string;
  weight?: string;
  muscleGroup?: string;
  notes?: string;
  videoSearchQuery?: string;
  imageSuggestion?: string;
  targetWeight?: string;
  targetReps?: string;
}

export interface DailyWorkoutPlan {
  day: number;
  warmup: string;
  exercises: Exercise[];
  cooldown: string;
  notes?: string;
} 