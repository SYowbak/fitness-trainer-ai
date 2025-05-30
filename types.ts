export enum Gender {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
}

export enum BodyType {
  ECTOMORPH = 'ECTOMORPH',
  ENDOMORPH = 'ENDOMORPH',
  MESOMORPH = 'MESOMORPH',
}

export enum FitnessGoal {
  LOSE_WEIGHT = 'LOSE_WEIGHT',
  GAIN_MUSCLE = 'GAIN_MUSCLE',
  STRENGTHEN_LIGAMENTS = 'STRENGTHEN_LIGAMENTS',
  GENERAL_FITNESS = 'GENERAL_FITNESS',
}

export enum UserLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum MuscleGroup {
  FULL_BODY = 'FULL_BODY',
  CHEST = 'CHEST',
  BACK = 'BACK',
  LEGS = 'LEGS',
  SHOULDERS = 'SHOULDERS',
  BICEPS = 'BICEPS',
  TRICEPS = 'TRICEPS',
  FOREARMS = 'FOREARMS',
  CORE = 'CORE',
  GLUTES = 'GLUTES',
  CALVES = 'CALVES',
  HAMSTRINGS = 'HAMSTRINGS',
  QUADS = 'QUADS',
  LATS = 'LATS',
  TRAPS = 'TRAPS',
  DELTOIDS = 'DELTOIDS',
  ABS = 'ABS',
  OBLIQUES = 'OBLIQUES',
  LOWER_BACK = 'LOWER_BACK',
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