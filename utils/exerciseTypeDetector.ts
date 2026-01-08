import { WeightType } from '../types';

/**
 * Визначає правильний тип ваги на основі назви вправи
 * Це fallback для випадків, коли AI неправильно встановив weightType
 */
export const detectWeightType = (exerciseName: string): WeightType => {
  const name = exerciseName.toLowerCase();
  
  // Вправи з власною вагою тіла
  if (
    name.includes('планка') ||
    name.includes('віджиман') ||
    name.includes('підтягуван') ||
    name.includes('прес') ||
    name.includes('скручуван') ||
    name.includes('підйом ніг') ||
    name.includes('берпі') ||
    name.includes('стрибки') ||
    name.includes('випади без ваги') ||
    name.includes('присідання без ваги')
  ) {
    return 'bodyweight';
  }
  
  // Вправи з гантелями/гирями (одиночні снаряди)
  if (
    name.includes('гантел') ||
    name.includes('гир') ||
    name.includes('підйоми гантелей') ||
    name.includes('жим гантелей') ||
    name.includes('тяга гантелі') ||
    name.includes('махи гантелями') ||
    name.includes('розведення гантелей')
  ) {
    return 'single';
  }
  
  // Вправи без ваги (розтяжка, кардіо)
  if (
    name.includes('розтяжка') ||
    name.includes('кардіо') ||
    name.includes('біг') ||
    name.includes('ходьба') ||
    name.includes('велосипед') ||
    name.includes('еліптичний')
  ) {
    return 'none';
  }
  
  // За замовчуванням - загальна вага (штанга, тренажери)
  return 'total';
};

/**
 * Виявляє в описі вправи ознаки додаткової ваги та (опціонально) кількість кг
 */
export const detectExtraWeight = (exerciseName: string) => {
  const name = exerciseName.toLowerCase();

  const weightedPhrases = [
    'з додатков',
    'з обтяженням',
    'в жилет',
    'в жилеті',
    'жилет',
    'з вагою',
    'з додатковою вагою',
    'weighted',
    'weight vest',
    'with weight',
    'додаткова вага',
  ];

  const hasPhrase = weightedPhrases.some(p => name.includes(p));

  const kgRegex = /(?:\b|^)(\d+(?:[\.,]\d+)?)\s*(kg|кг)\b/iu;
  const kgMatch = name.match(kgRegex);

  const kg = kgMatch ? parseFloat(kgMatch[1].replace(',', '.')) : undefined;

  const signature = hasPhrase ? `weighted${kg ? `:${kg}kg` : ':unknown'}` : 'no-weight';

  return { hasExtra: hasPhrase || !!kgMatch, kg, signature };
};

/**
 * Виявляє, чи вправу потрібно логувати по часу (наприклад, планка)
 * Використовує явний whitelist часових вправ — всі інші логуються по повторенням
 * Повертає прапорець isTime та (опційно) кількість секунд або діапазон
 */
export const detectTimeInfo = (exerciseName: string) => {
  const name = exerciseName.toLowerCase();

  /**
   * Явний список вправ, які логуються ПО ЧАСУ (утримання, стоп-позиції)
   * Усе інше вважається вправою на повторення
   */
  const timeBasedExercises = [
    // Планка
    'планка',
    'plank',
    'front plank',
    'планка фронтальна',
    
    // Висіння та dead hang
    'dead hang',
    'hang',
    'висіння',
    'висяння на перекладині',
    'висяння',
    
    // Боков та обернені планки
    'бокова планка',
    'side plank',
    'обернена планка',
    'reverse plank',
    'backward plank',
    
    // L-sit, hollow body та статичні утримання
    'l-sit',
    'l sit',
    'hollow body hold',
    'hollow hold',
    'hollow',
    'арка утримання',
    'l-position hold',
    
    // Wall sit
    'wall sit',
    'приседання спиною до стіни',
    'вол сіт',
    'wall squat',
    
    // Інші статичні утримання
    'static hold',
    'static press hold',
    'утримання в верхній точці',
    'lock hold',
    'support hold',
    'утримання упором',
    
    // Йога, розтяжка на утримання (не просто рухомі розтяжки)
    'асана',
    'yoga pose',
    'йога позиція',
    'йога утримання',
    'йога статична',
    
    // Ізометричні вправи
    'ізометрична',
    'isometric',
  ];

  // Перевіряємо, чи назва вправи містить вказані ключові слова часової вправи
  const isTime = timeBasedExercises.some(keyword => name.includes(keyword));

  // Пошук числа секунд або діапазону у назві/описі (45-60 секунд, 60 сек, 1 хв)
  const rangeRegex = /(\d+)\s*[-–]\s*(\d+)\s*(секунд|сек|s|хв|min|minutes?)/iu;
  const singleRegex = /(\d+(?:[\.,]\d+)?)\s*(секунд|сек|s|хв|min|minutes?)/iu;

  const rangeMatch = name.match(rangeRegex);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    // Якщо вказано в хвилинах — конвертуємо
    const unit = rangeMatch[3].toLowerCase();
    const factor = unit.includes('хв') || unit.includes('min') || unit.includes('minute') ? 60 : 1;
    return { isTime: true, secondsRange: { min: min * factor, max: max * factor }, seconds: min * factor };
  }

  const singleMatch = name.match(singleRegex);
  if (singleMatch) {
    const value = parseFloat(singleMatch[1].replace(',', '.'));
    const unit = singleMatch[2].toLowerCase();
    const factor = unit.includes('хв') || unit.includes('min') || unit.includes('minute') ? 60 : 1;
    return { isTime: true, seconds: Math.round(value * factor) };
  }

  return { isTime, seconds: undefined };
};

// Кеш для уникнення повторних логів
const fixedExercises = new Set<string>();

/**
 * Виправляє weightType для вправи, якщо він неправильний
 */
export const fixExerciseWeightType = (exerciseName: string, currentWeightType: WeightType): WeightType => {
  const detectedType = detectWeightType(exerciseName);
  
  // Якщо поточний тип явно неправильний, виправляємо
  if (currentWeightType !== detectedType) {
    const cacheKey = `${exerciseName}:${currentWeightType}:${detectedType}`;
    
    // Логуємо тільки якщо ще не логували цю комбінацію
    if (!fixedExercises.has(cacheKey)) {
      console.log(`🔧 [FIX] Fixing weightType for "${exerciseName}": "${currentWeightType}" → "${detectedType}"`);
      fixedExercises.add(cacheKey);
    }
    
    return detectedType;
  }
  
  return currentWeightType;
};
