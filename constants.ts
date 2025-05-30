import { Gender, BodyType, FitnessGoal, MuscleGroup, ExperienceLevel } from './types';

export const APP_NAME = "Фітнес-Тренер AI";

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: Gender.FEMALE, label: 'Жінка' },
  { value: Gender.MALE, label: 'Чоловік' },
];

export const BODY_TYPE_OPTIONS: Array<{ value: BodyType; label: string; hint: string }> = [
  { 
    value: BodyType.ECTOMORPH, 
    label: 'Ектоморф', 
    hint: 'Худорлява статура, довгі кінцівки, швидкий метаболізм. Складно набирати вагу та м\'язову масу' 
  },
  { 
    value: BodyType.ENDOMORPH, 
    label: 'Ендоморф', 
    hint: 'Широка кістка, повільний метаболізм, схильність до набору жиру. Легко набирати вагу, складно худнути' 
  },
  { 
    value: BodyType.MESOMORPH, 
    label: 'Мезоморф', 
    hint: 'Атлетична статура, середній метаболізм. Легко набирати м\'язову масу та худнути' 
  },
];

export const FITNESS_GOAL_OPTIONS: Array<{ value: FitnessGoal; label: string }> = [
  { value: FitnessGoal.WEIGHT_LOSS, label: 'Схуднути' },
  { value: FitnessGoal.MUSCLE_GAIN, label: 'Набрати м\'язову масу' },
  { value: FitnessGoal.STRENGTH, label: 'Зміцнити силу' },
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

export const MUSCLE_GROUP_OPTIONS: Array<{ value: MuscleGroup | ''; label: string; hint: string }> = [
  { value: '', label: 'Не обрано / Загальний розвиток', hint: 'План тренувань буде збалансованим для всіх груп м\'язів' },
  
  // Ноги
  { value: MuscleGroup.QUADS, label: 'Квадрицепси', hint: 'Передня частина стегна, відповідає за розгинання ноги в коліні' },
  { value: MuscleGroup.HAMSTRINGS, label: 'Біцепс стегна', hint: 'Задня частина стегна, відповідає за згинання ноги в коліні' },
  { value: MuscleGroup.CALVES, label: 'Литки', hint: 'М\'язи задньої частини гомілки, відповідають за підйом на носки' },
  { value: MuscleGroup.GLUTES, label: 'Сідничні м\'язи', hint: 'Найбільші м\'язи тіла, відповідають за розгинання стегна' },
  
  // Спина
  { value: MuscleGroup.LATS, label: 'Широчайші м\'язи спини', hint: 'Найбільші м\'язи спини, відповідають за приведення рук до тулуба' },
  { value: MuscleGroup.TRAPS, label: 'Трапецієподібні м\'язи', hint: 'Верхня частина спини, відповідає за підняття лопаток' },
  { value: MuscleGroup.RHOMBOIDS, label: 'Ромбовидні м\'язи', hint: 'М\'язи між лопатками, відповідають за зведення лопаток' },
  { value: MuscleGroup.LOWER_BACK, label: 'Нижня частина спини', hint: 'М\'язи, що підтримують хребет, важливі для стабільності' },
  
  // Груди
  { value: MuscleGroup.UPPER_CHEST, label: 'Верхня частина грудей', hint: 'Верхні пучки грудних м\'язів, важливі для об\'єму грудей зверху' },
  { value: MuscleGroup.MIDDLE_CHEST, label: 'Середня частина грудей', hint: 'Центральні пучки грудних м\'язів, основна маса грудей' },
  { value: MuscleGroup.LOWER_CHEST, label: 'Нижня частина грудей', hint: 'Нижні пучки грудних м\'язів, формують нижній контур грудей' },
  
  // Плечі
  { value: MuscleGroup.FRONT_DELTS, label: 'Передні дельти', hint: 'Передні пучки дельтоподібних м\'язів, відповідають за підняття рук вперед' },
  { value: MuscleGroup.SIDE_DELTS, label: 'Бічні дельти', hint: 'Бічні пучки дельтоподібних м\'язів, відповідають за підняття рук вбік' },
  { value: MuscleGroup.REAR_DELTS, label: 'Задні дельти', hint: 'Задні пучки дельтоподібних м\'язів, відповідають за відведення рук назад' },
  
  // Руки
  { value: MuscleGroup.BICEPS, label: 'Біцепс', hint: 'Передня частина плеча, відповідає за згинання руки в лікті' },
  { value: MuscleGroup.TRICEPS, label: 'Трицепс', hint: 'Задня частина плеча, відповідає за розгинання руки в лікті' },
  { value: MuscleGroup.FOREARMS, label: 'Передпліччя', hint: 'М\'язи нижньої частини руки, відповідають за силу хвату' },
  
  // Кор
  { value: MuscleGroup.ABS, label: 'Прямий м\'яз живота', hint: 'Центральна частина пресу, відповідає за згинання тулуба' },
  { value: MuscleGroup.OBLIQUES, label: 'Косі м\'язи живота', hint: 'Бічні м\'язи живота, відповідають за повороти тулуба' },
  { value: MuscleGroup.LOWER_ABS, label: 'Нижній прес', hint: 'Нижня частина прямого м\'яза живота, важлива для стабільності' },
];

export const EXPERIENCE_LEVEL_OPTIONS: Array<{ value: ExperienceLevel; label: string; hint: string }> = [
  { 
    value: ExperienceLevel.BEGINNER, 
    label: 'Новачок', 
    hint: 'Менше 6 місяців досвіду тренувань. Потрібні базові вправи та техніка виконання' 
  },
  { 
    value: ExperienceLevel.INTERMEDIATE, 
    label: 'Середній рівень', 
    hint: 'Від 6 місяців до 2 років досвіду. Можна виконувати складніші вправи та працювати з прогресивним навантаженням' 
  },
  { 
    value: ExperienceLevel.ADVANCED, 
    label: 'Просунутий', 
    hint: 'Від 2 до 5 років досвіду. Впевнене виконання складних вправ, розуміння техніки та можливість самостійно складати програми' 
  },
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
  nameLabel: "Ім'я:",
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
  cancel: "Скасувати",
  save: "Зберегти"
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
    if (!muscleGroup) return MUSCLE_GROUP_OPTIONS[0].label;
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