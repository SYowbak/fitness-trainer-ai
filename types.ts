export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum BodyType {
  ECTOMORPH = 'ectomorph',
  MESOMORPH = 'mesomorph',
  ENDOMORPH = 'endomorph'
}

export enum FitnessGoal {
  WEIGHT_LOSS = 'weight_loss',
  MUSCLE_GAIN = 'muscle_gain',
  STRENGTH = 'strength',
  ENDURANCE = 'endurance',
  GENERAL_FITNESS = 'general_fitness'
}

export enum MuscleGroup {
  QUADS = 'quads',
  HAMSTRINGS = 'hamstrings',
  CALVES = 'calves',
  GLUTES = 'glutes',
  LATS = 'lats',
  TRAPS = 'traps',
  RHOMBOIDS = 'rhomboids',
  LOWER_BACK = 'lower_back',
  UPPER_CHEST = 'upper_chest',
  MIDDLE_CHEST = 'middle_chest',
  LOWER_CHEST = 'lower_chest',
  FRONT_DELTS = 'front_delts',
  SIDE_DELTS = 'side_delts',
  REAR_DELTS = 'rear_delts',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  FOREARMS = 'forearms',
  ABS = 'abs',
  OBLIQUES = 'obliques',
  LOWER_ABS = 'lower_abs'
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export interface UserProfile {
  uid?: string;              // ID користувача (автоматично)
  email?: string;            // Email користувача
  displayName?: string;      // Ім'я користувача
  name: string;              // Ім'я або нікнейм
  gender: Gender;            // Стать
  bodyType: BodyType;        // Тип тіла
  goal: FitnessGoal;         // Мета тренувань
  trainingFrequency: number; // Частота тренувань на тиждень
  targetMuscleGroups: MuscleGroup[]; // Цільові групи м'язів
  height: number;            // Зріст у см
  weight: number;            // Вага у кг
  experienceLevel: ExperienceLevel; // Рівень досвіду
}

export interface Exercise {
  name: string;
  sets: number | string; // Дозволяємо рядок для "3-4"
  reps: number | string; // Дозволяємо рядок для "8-12"
  weight?: number;
  muscleGroup?: MuscleGroup;
  notes?: string;
  description?: string;
  rest?: string;
  imageSuggestion?: string | null;
  videoSearchQuery?: string | null;
  targetWeight?: number | null;
  targetReps?: number | string | null;
  isCompletedDuringSession?: boolean; 
  sessionLoggedSets?: LoggedSetWithAchieved[];
  sessionSuccess?: boolean;
}

export interface DailyWorkoutPlan {
  day: number;
  exercises: Exercise[];
  notes?: string; 
}

export interface LoggedSet {
  weight: number;    // Вага
  reps: number;      // Повторення
  completed: boolean; // Чи завершено
}

export interface LoggedSetWithAchieved {
  repsAchieved?: number;
  weightUsed?: number;
  completed?: boolean;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSetWithAchieved[];
}

export interface WorkoutLog {
  id?: string;           // ID логу (автоматично)
  userId: string;        // ID користувача
  date: Date;           // Дата тренування
  duration: number;     // Тривалість в секундах
  exercises: LoggedExercise[]; // Вправи
}