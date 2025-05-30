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

export enum MuscleGroup {
  // Ноги
  QUADS = 'quads', // Квадрицепси
  HAMSTRINGS = 'hamstrings', // Біцепс стегна
  CALVES = 'calves', // Литки
  GLUTES = 'glutes', // Сідничні м'язи
  
  // Спина
  LATS = 'lats', // Широчайші м'язи спини
  TRAPS = 'traps', // Трапецієподібні м'язи
  RHOMBOIDS = 'rhomboids', // Ромбовидні м'язи
  LOWER_BACK = 'lower_back', // Нижня частина спини
  
  // Груди
  UPPER_CHEST = 'upper_chest', // Верхня частина грудей
  MIDDLE_CHEST = 'middle_chest', // Середня частина грудей
  LOWER_CHEST = 'lower_chest', // Нижня частина грудей
  
  // Плечі
  FRONT_DELTS = 'front_delts', // Передні дельти
  SIDE_DELTS = 'side_delts', // Бічні дельти
  REAR_DELTS = 'rear_delts', // Задні дельти
  
  // Руки
  BICEPS = 'biceps', // Біцепс
  TRICEPS = 'triceps', // Трицепс
  FOREARMS = 'forearms', // Передпліччя
  
  // Кор
  ABS = 'abs', // Прямий м'яз живота
  OBLIQUES = 'obliques', // Косі м'язи живота
  LOWER_ABS = 'lower_abs', // Нижній прес
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  PROFESSIONAL = 'professional'
}

export interface UserProfile {
  name: string;
  gender: Gender;
  bodyType: BodyType;
  goal: FitnessGoal;
  trainingFrequency: number; // e.g., 3 times a week
  targetMuscleGroups: MuscleGroup[]; // Змінено з primaryTargetMuscleGroup на масив
  height: number; // зріст у сантиметрах
  weight: number; // вага у кілограмах
  experienceLevel: ExperienceLevel;
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