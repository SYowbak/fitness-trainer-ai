import { Gender, BodyType, FitnessGoal, MuscleGroup, ExperienceLevel } from './types';

export const APP_NAME = "Фітнес-Тренер AI";

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: Gender.FEMALE, label: 'Жінка' },
  { value: Gender.MALE, label: 'Чоловік' },
];

export const BODY_TYPE_OPTIONS: Array<{ value: BodyType; label: string }> = [
  { value: BodyType.ECTOMORPH, label: 'Ектоморф' },
  { value: BodyType.ENDOMORPH, label: 'Ендоморф' },
  { value: BodyType.MESOMORPH, label: 'Мезоморф' },
];

export const FITNESS_GOAL_OPTIONS: Array<{ value: FitnessGoal; label: string }> = [
  { value: FitnessGoal.LOSE_WEIGHT, label: 'Схуднути' },
  { value: FitnessGoal.GAIN_MUSCLE, label: 'Набрати м\'язову масу' },
  { value: FitnessGoal.STRENGTHEN_LIGAMENTS, label: 'Зміцнити зв\'язки та суглоби' },
  { value: FitnessGoal.GENERAL_FITNESS, label: 'Підтримати загальну фізичну форму' },
];

export const TRAINING_FREQUENCY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1 раз на тиждень' },
  { value: 2, label: '2 рази на тиждень' },
  { value: 3, label: '3 рази на тиждень' },
  { value: 4, label: '4 рази на тиждень' },
  { value: 5, label: '5 разів на тиждень' },
  { value: 5, label: '6 разів на тиждень' },
];

export const MUSCLE_GROUP_OPTIONS: Array<{ value: MuscleGroup | ''; label: string }> = [
  { value: '', label: 'Не обрано / Загальний розвиток' },
  { value: MuscleGroup.FULL_BODY, label: 'Все тіло' },
  { value: MuscleGroup.LEGS, label: 'Ноги' },
  { value: MuscleGroup.CHEST, label: 'Груди' },
  { value: MuscleGroup.BACK, label: 'Спина' },
  { value: MuscleGroup.SHOULDERS, label: 'Плечі' },
  { value: MuscleGroup.ARMS, label: 'Руки (Біцепс/Трицепс)' },
  { value: MuscleGroup.CORE, label: 'Прес (Кор)' },
];

export const EXPERIENCE_LEVEL_OPTIONS: Array<{ value: ExperienceLevel; label: string }> = [
  { value: ExperienceLevel.BEGINNER, label: 'Новачок' },
  { value: ExperienceLevel.INTERMEDIATE, label: 'Середній рівень' },
  { value: ExperienceLevel.ADVANCED, label: 'Просунутий' },
  { value: ExperienceLevel.PROFESSIONAL, label: 'Професіонал' },
];

export const DEFAULT_TRAINING_FREQUENCY = 3;
export const DEFAULT_WEIGHT_INCREMENT = 5; // kg for example
export const DEFAULT_WEIGHT_DECREMENT = 5; // kg for example

export const GEMINI_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';

export const UI_TEXT = {
  appName: APP_NAME,
  tabProfile: "Профіль",
  tabWorkout: "Тренування",
  tabProgress: "Прогрес",
  saveProfile: "Зберегти профіль та згенерувати план",
  generateWorkout: "Згенерувати Новий План Тренувань",
  generatingWorkout: "Генерація плану...",
  nameLabel: "Ім'я (необов'язково):",
  genderLabel: "Стать:",
  bodyTypeLabel: "Тип статури:",
  goalLabel: "Фітнес ціль:",
  frequencyLabel: "Частота тренувань:",
  targetMuscleGroupLabel: "Акцент на групу м'язів (необов'язково):",
  workoutPlanTitle: "Ваш План Тренувань",
  noWorkoutPlan: "План тренувань ще не згенеровано. Заповніть профіль та натисніть 'Зберегти профіль та згенерувати план' або 'Згенерувати Новий План Тренувань', якщо профіль вже є.",
  day: "День",
  warmup: "Розминка:",
  exercises: "Вправи:",
  cooldown: "Заминка:",
  sets: "Підходи:",
  reps: "Повторення:",
  rest: "Відпочинок:",
  errorOccurred: "Сталася помилка:",
  tryAgain: "Спробувати ще раз",
  profileSaved: "Профіль збережено!",
  localStorageNotSupported: "LocalStorage не підтримується у вашому браузері. Прогрес не буде збережено.",
  apiKeyMissing: "API ключ для Gemini не налаштовано. Функціонал генерації плану недоступний. Будь ласка, переконайтеся, що змінна середовища API_KEY встановлена.",
  exerciseInstructions: "Інструкції з виконання:",
  welcomeMessage: `Ласкаво просимо до ${APP_NAME}!`,
  getStarted: "Для початку, будь ласка, заповніть ваш профіль.",
  progressTitle: "Відстеження Прогресу",
  progressSoon: "Розширена аналітика прогресу буде доступна згодом.",
  notes: "Примітки:",
  videoSuggestion: "Відео (YouTube пошук):",
  watchOnYouTube: "Дивитись на YouTube",
  noImageSuggestion: "Немає пропозицій для зображення.",
  startWorkout: "Почати Тренування",
  endWorkout: "Завершити Тренування",
  workoutDuration: "Тривалість:",
  startRest: "Відпочинок", // Will be followed by time e.g. "Відпочинок (60с)"
  markAsDone: "Виконано",
  logExercise: "Залогувати Вправу",
  setsAchieved: "Виконано підходів:",
  repsAchieved: "Повторень:",
  weightUsed: "Вага (кг):",
  allSetsRepsGoodForm: "Чи вдалося виконати всі підходи/повторення з правильною технікою?",
  yes: "Так",
  no: "Ні",
  exerciseLogged: "Вправу залоговано!",
  workoutLogged: "Тренування залоговано!",
  nextTarget: "Наступна ціль:",
  targetWeight: "Цільова вага:",
  loggingProgress: "Логування...",
  viewPlan: "Переглянути План",
  activeWorkoutDay: "Активне тренування - День",
  confirmEndWorkout: "Ви впевнені, що хочете завершити тренування? Незалоговані вправи не будуть збережені.",
  allExercisesCompleted: "Всі вправи виконано!",
  selectDayToView: "Виберіть день для перегляду:",
  exerciseLogPrompt: "Як пройшла вправа?",
  currentWorkout: "Поточне тренування",
  heightLabel: "Зріст (см):",
  weightLabel: "Вага (кг):",
  experienceLevelLabel: "Рівень підготовки:",
  targetMuscleGroupsLabel: "Акцент на групи м'язів:",
};

export function getUkrainianGoal(goal: FitnessGoal): string {
  const option = FITNESS_GOAL_OPTIONS.find(opt => opt.value === goal);
  return option ? option.label : "не вказано";
}
export function getUkrainianBodyType(bodyType: BodyType): string {
    const option = BODY_TYPE_OPTIONS.find(opt => opt.value === bodyType);
    return option ? option.label : "не вказано";
}
export function getUkrainianGender(gender: Gender): string {
    const option = GENDER_OPTIONS.find(opt => opt.value === gender);
    return option ? option.label : "не вказано";
}
export function getUkrainianMuscleGroup(muscleGroup?: MuscleGroup | ''): string {
    if (!muscleGroup) return MUSCLE_GROUP_OPTIONS[0].label; // 'Не обрано / Загальний розвиток'
    const option = MUSCLE_GROUP_OPTIONS.find(opt => opt.value === muscleGroup);
    return option ? option.label : "не вказано";
}
export function getUkrainianExperienceLevel(level: ExperienceLevel): string {
  const option = EXPERIENCE_LEVEL_OPTIONS.find(opt => opt.value === level);
  return option ? option.label : "не вказано";
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}