import { Gender, BodyType, FitnessGoal, MuscleGroup, UserLevel } from './types';

export const APP_NAME = "Фітнес-тренер AI";

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: Gender.FEMALE, label: 'Жінка' },
  { value: Gender.MALE, label: 'Чоловік' },
];

export const BODY_TYPE_OPTIONS: Array<{ value: BodyType; label: string; description: string }> = [
  { 
    value: BodyType.ECTOMORPH, 
    label: 'Ектоморф',
    description: 'Худорлява статура, важко набирати вагу та м\'язову масу. Швидкий метаболізм.'
  },
  { 
    value: BodyType.ENDOMORPH, 
    label: 'Ендоморф',
    description: 'Схильність до накопичення жиру, легко набирають вагу. Повільний метаболізм.'
  },
  { 
    value: BodyType.MESOMORPH, 
    label: 'Мезоморф',
    description: 'Атлетична статура, легко набирають м\'язову масу. Хороший метаболізм.'
  },
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

export const MUSCLE_GROUP_OPTIONS: Array<{ value: MuscleGroup; label: string; description: string }> = [
  { value: MuscleGroup.FULL_BODY, label: 'Все тіло', description: 'Загальний розвиток всіх груп м\'язів' },
  { value: MuscleGroup.CHEST, label: 'Груди', description: 'Великі грудні м\'язи, малі грудні м\'язи' },
  { value: MuscleGroup.BACK, label: 'Спина', description: 'Широчайші м\'язи спини, ромбовидні м\'язи' },
  { value: MuscleGroup.LEGS, label: 'Ноги', description: 'Квадрицепси, біцепс стегна, ікри' },
  { value: MuscleGroup.SHOULDERS, label: 'Плечі', description: 'Дельтоподібні м\'язи (передні, середні, задні)' },
  { value: MuscleGroup.BICEPS, label: 'Біцепс', description: 'Двоголовий м\'яз плеча' },
  { value: MuscleGroup.TRICEPS, label: 'Трицепс', description: 'Триголовий м\'яз плеча' },
  { value: MuscleGroup.FOREARMS, label: 'Передпліччя', description: 'М\'язи передпліччя' },
  { value: MuscleGroup.CORE, label: 'Кор', description: 'М\'язи живота та нижньої частини спини' },
  { value: MuscleGroup.GLUTES, label: 'Сідниці', description: 'Великі, середні та малі сідничні м\'язи' },
  { value: MuscleGroup.CALVES, label: 'Ікри', description: 'Литкові м\'язи' },
  { value: MuscleGroup.HAMSTRINGS, label: 'Біцепс стегна', description: 'Задня поверхня стегна' },
  { value: MuscleGroup.QUADS, label: 'Квадрицепси', description: 'Передня поверхня стегна' },
  { value: MuscleGroup.LATS, label: 'Широчайші м\'язи', description: 'Бічні м\'язи спини' },
  { value: MuscleGroup.TRAPS, label: 'Трапеції', description: 'Верхня частина спини та шиї' },
  { value: MuscleGroup.ABS, label: 'Прес', description: 'Прямий м\'яз живота' },
  { value: MuscleGroup.OBLIQUES, label: 'Косі м\'язи живота', description: 'Бічні м\'язи живота' },
  { value: MuscleGroup.LOWER_BACK, label: 'Поперекові м\'язи', description: 'Нижня частина спини' },
];

export const USER_LEVEL_OPTIONS: Array<{ value: UserLevel; label: string; description: string }> = [
  { 
    value: UserLevel.BEGINNER, 
    label: 'Новачок',
    description: 'Менше 6 місяців досвіду тренувань. Потрібні базові вправи та увага до техніки.'
  },
  { 
    value: UserLevel.INTERMEDIATE, 
    label: 'Досвідчений',
    description: 'Від 6 місяців до 2 років досвіду. Можна виконувати складніші вправи та варіації.'
  },
  { 
    value: UserLevel.ADVANCED, 
    label: 'Професіонал',
    description: 'Більше 2 років досвіду. Можна виконувати складні вправи та використовувати прогресивні методики.'
  },
];

export const DEFAULT_TRAINING_FREQUENCY = 3;
export const DEFAULT_WEIGHT_INCREMENT = 5; // kg for example
export const DEFAULT_WEIGHT_DECREMENT = 5; // kg for example
export const DEFAULT_USER_LEVEL = UserLevel.BEGINNER;

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
  targetMuscleGroupLabel: "Оберіть групи м'язів для акценту (можна вибрати декілька):",
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
  levelLabel: "Рівень підготовки:"
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
    if (!muscleGroup) return 'Не обрано / Загальний розвиток';
    const option = MUSCLE_GROUP_OPTIONS.find(opt => opt.value === muscleGroup);
    return option ? option.label : "не вказано";
}

export function getUkrainianBodyTypeDescription(bodyType: BodyType): string {
    const option = BODY_TYPE_OPTIONS.find(opt => opt.value === bodyType);
    return option ? option.description : "не вказано";
}

export function getUkrainianMuscleGroupDescription(muscleGroup?: MuscleGroup | ''): string {
    if (!muscleGroup) return '';
    const option = MUSCLE_GROUP_OPTIONS.find(opt => opt.value === muscleGroup);
    return option ? option.description : "";
}

export function getUkrainianUserLevel(level: UserLevel): string {
    const option = USER_LEVEL_OPTIONS.find(opt => opt.value === level);
    return option ? option.label : "не вказано";
}

export function getUkrainianUserLevelDescription(level: UserLevel): string {
    const option = USER_LEVEL_OPTIONS.find(opt => opt.value === level);
    return option ? option.description : "";
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}