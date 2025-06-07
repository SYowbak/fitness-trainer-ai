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
  age: number;               // Вік у роках
  experienceLevel: ExperienceLevel; // Рівень досвіду
}

export interface Exercise {
  name: string;
  description: string;
  sets: string | number;
  reps: string;
  rest: string;
  videoSearchQuery: string | null;
  targetWeight?: number | null;
  targetReps?: number | null;
  recommendation?: {
    text: string;
    action: string;
  } | null;
  isCompletedDuringSession: boolean; 
  sessionLoggedSets: LoggedSetWithAchieved[];
  sessionSuccess: boolean | null;
  notes?: string | null;
}

export interface DailyWorkoutPlan {
  day: number;
  exercises: Exercise[];
  notes?: string;
  warmup?: string;
  cooldown?: string;
}

export interface LoggedSet {
  weight?: number;    // Вага
  reps?: number;      // Повторення
  completed?: boolean; // Чи завершено
}

export interface LoggedSetWithAchieved {
  repsAchieved?: number;
  weightUsed?: number;
  completed?: boolean;
}

export interface LoggedExercise {
  exerciseName: string; // Назва виконаної вправи
  originalSets?: number | string; // Оригінальна кількість підходів з плану
  originalReps?: number | string; // Оригінальна кількість повторень з плану
  targetWeightAtLogging?: number | null; // Цільова вага з плану на момент логування
  
  loggedSets: LoggedSetWithAchieved[]; // Масив виконаних підходів
  
  completedSuccessfully?: boolean; // Чи була вправа успішно виконана
  notes?: string | null; // Додаткові нотатки до логу
}

export interface WorkoutLog {
  id?: string;           // ID логу (автоматично)
  userId: string;        // ID користувача
  date: Date | { seconds: number; nanoseconds: number }; // Замінюємо admin.firestore.Timestamp на простіший тип
  duration: number;     // Тривалість в секундах
  dayCompleted?: number; // День плану, який був завершений
  workoutDuration?: string; // Тривалість тренування у форматі HH:MM:SS
  loggedExercises: LoggedExercise[]; // Виконані вправи
}