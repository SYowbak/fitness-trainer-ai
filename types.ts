export enum Gender {
  FEMALE = 'female',
  MALE = 'male',
}

export enum BodyType {
  ECTOMORPH = 'ectomorph',
  ENDOMORPH = 'endomorph',
  MESOMORPH = 'mesomorph',
}

export enum FitnessGoal {
  LOSE_WEIGHT = 'lose_weight',
  GAIN_MUSCLE = 'gain_muscle',
  STRENGTHEN_LIGAMENTS = 'strengthen_ligaments',
  GENERAL_FITNESS = 'general_fitness',
}

export enum UserLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum MuscleGroup {
  FULL_BODY = 'full_body',
  CHEST = 'chest',
  BACK = 'back',
  LEGS = 'legs',
  SHOULDERS = 'shoulders',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  FOREARMS = 'forearms',
  CORE = 'core',
  GLUTES = 'glutes',
  CALVES = 'calves',
  HAMSTRINGS = 'hamstrings',
  QUADS = 'quads',
  LATS = 'lats',
  TRAPS = 'traps',
  ABS = 'abs',
  OBLIQUES = 'obliques',
  LOWER_BACK = 'lower_back',
}

export interface UserProfile {
  name?: string;
  gender: Gender;
  bodyType: BodyType;
  goal: FitnessGoal;
  trainingFrequency: number; // e.g., 3 times a week
  targetMuscleGroups: MuscleGroup[]; // Змінено з primaryTargetMuscleGroup на масив
  height?: number; // зріст у сантиметрах
  weight?: number; // вага у кілограмах
  level: UserLevel; // рівень користувача
}

export interface Exercise {
  name: string;
  description: string;
  sets: number | string; 
  reps: string; 
  rest: string; // e.g., "60 секунд"
  imageSuggestion?: string | null; // Suggestion for a GIF or image
  videoSearchQuery?: string | null; // Search query for YouTube for exercise demonstration
  targetWeight?: number | null; // Target weight for progressive overload
  targetReps?: string | null; // Target reps if different from base, for progressive overload
  
  // Fields used during an active workout session, not persisted in the base plan from Gemini
  isCompletedDuringSession?: boolean; 
  sessionLoggedSets?: LoggedSet[];
  sessionSuccess?: boolean;
}

export interface DailyWorkoutPlan {
  day: number;
  warmup?: string;
  exercises: Exercise[];
  cooldown?: string;
  notes?: string; 
}

export interface LoggedSet {
  repsAchieved: number;
  weightUsed: number;
}

export interface LoggedExercise {
  exerciseName: string;
  originalSets: number | string; // From the plan
  originalReps: string; // From the plan
  targetWeightAtLogging?: number | null; // Weight user was aiming for this session
  loggedSets: LoggedSet[];
  completedSuccessfully: boolean; // User's assessment of whether they met the goal for this exercise
}
export interface WorkoutLog {
  date: string; // ISO string
  dayCompleted: number; // Which day of the plan
  workoutDuration?: string; // e.g., "45:30" (mm:ss)
  loggedExercises: LoggedExercise[];
}