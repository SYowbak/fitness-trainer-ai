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
  GENERAL_FITNESS = 'general_fitness',
  OTHER = 'other'
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

// Типи для системи здоров'я та травм
export interface HealthCondition {
  id: string;
  type: 'chronic' | 'temporary' | 'recovering';
  condition: string; // "травма спини", "артрит колін", тощо
  severity: 'mild' | 'moderate' | 'severe';
  affectedAreas: string[]; // ["спина", "поперек", "хребет"]
  startDate: Date;
  expectedRecoveryDate?: Date;
  notes?: string;
  isActive: boolean;
}

export interface HealthProfile {
  conditions: HealthCondition[];
  currentLimitations: string[]; // поточні обмеження для AI
  recoveryProgress: {
    [conditionId: string]: {
      progressPercentage: number; // 0-100%
      lastUpdated: Date;
      milestones: string[];
    }
  };
  systemMemory: {
    rememberedFacts: string[]; // що система запам'ятала про користувача
    adaptationHistory: {
      date: Date;
      reason: string;
      adaptations: string[];
    }[];
  };
  planAdaptationStatus?: {
    lastAdaptedDate: Date;
    adaptedConditions: string[]; // які проблеми були враховані в поточному плані
    needsReAdaptation: boolean; // чи потрібна повторна адаптація
  };
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
  healthConstraints?: string[]; // ЗАСТАРІЛЕ: Стислі обмеження/травми (для зворотньої сумісності)
  healthProfile?: HealthProfile; // НОВА система здоров'я
  customGoalDescription?: string; // Додаткова текстова ціль, якщо обрано "інше"
}

export type WeightType = 'total' | 'single' | 'bodyweight' | 'none';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  sets: string | number;
  reps: string;
  rest: string;
  videoSearchQuery: string | null;
  weightType: WeightType; // <--- Додано це поле
  targetWeight?: number | null;
  targetReps?: number | null;
  recommendation?: {
    text: string;
    action: string;
  } | null;
  isCompletedDuringSession: boolean;
  sessionLoggedSets: LoggedSetWithAchieved[];
  sessionSuccess: boolean | null;
  isSkipped?: boolean; // Додаємо поле isSkipped
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
  repsAchieved: number | null;
  weightUsed: number | null;
  completed?: boolean;
}

export interface LoggedSetWithAchieved {
  repsAchieved: number | null;
  weightUsed: number | null;
  completed?: boolean;
  weightContext?: 'total' | 'per_dumbbell' | 'bodyweight';
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
  
  // Нові поля для збереження wellness check та адаптацій
  wellnessCheck?: WellnessCheck | null; // Дані про самопочуття
  adaptiveWorkoutPlan?: AdaptiveWorkoutPlan | null; // Адаптивний план тренування
  wellnessRecommendations?: WellnessRecommendation[] | null; // Рекомендації по самопочуттю
  wasAdaptiveWorkout?: boolean; // Чи було тренування адаптивним
  // Додаємо поле для загальної рекомендації/аналізу
  recommendation?: {
    text: string;
    action: string;
  } | null;
  
  // Поля для фонового аналізу
  analysisStatus?: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysisStartedAt?: Date;
  analysisCompletedAt?: Date;
  nextWorkoutRecommendations?: ExerciseRecommendation[]; // Рекомендації для наступного тренування
  isOffline?: boolean; // Чи був лог створений офлайн
}

export interface ExerciseRecommendation {
  exerciseName: string;
  recommendation: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  suggestedSets?: number;
  reason: string;
  action: 'increase_weight' | 'decrease_weight' | 'increase_reps' | 'decrease_reps' | 'change_exercise' | 'maintain' | 'variation';
}

export interface WorkoutAnalysisResult {
  updatedPlan: DailyWorkoutPlan;
  recommendation: {
    text: string;
    action: string;
  };
  dailyRecommendations: ExerciseRecommendation[];
}

export interface ExerciseVariation {
  name: string;
  description: string;
  sets: string;
  reps: string;
  rest: string;
  videoSearchQuery?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  variationType: 'progression' | 'regression' | 'alternative';
  reason: string;
}

export enum EnergyLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum SleepQuality {
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  EXCELLENT = 'excellent'
}

export enum StressLevel {
  HIGH = 'high',
  MODERATE = 'moderate',
  LOW = 'low'
}

export interface WellnessCheck {
  energyLevel: EnergyLevel;
  sleepQuality: SleepQuality;
  stressLevel: StressLevel;
  motivation: number; // 1-10
  fatigue: number; // 1-10
  notes?: string;
  timestamp: Date;
}

export interface AdaptiveWorkoutPlan extends DailyWorkoutPlan {
  originalPlan: DailyWorkoutPlan;
  adaptations?: {
    exerciseName: string;
    originalSets: string;
    originalReps: string;
    adaptedSets: string;
    adaptedReps: string;
    adaptationReason: string;
    energyLevel: EnergyLevel;
  }[];
  overallAdaptation?: {
    intensity: 'reduced' | 'maintained' | 'increased';
    duration: 'shorter' | 'normal' | 'longer';
    focus: 'recovery' | 'maintenance' | 'performance';
    reason: string;
  };
}

export interface WellnessRecommendation {
  type: 'energy' | 'recovery' | 'motivation' | 'stress';
  title: string;
  description: string;
  actions: string[];
  priority: 'high' | 'medium' | 'low';
}