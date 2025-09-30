import { Exercise, WeightType, UserProfile, WellnessCheck } from '../types';
import { HealthProfileService } from './healthProfileService';

// Мапа небезпечних вправ для різних травм (з частковим співпадінням назв)
const INJURY_EXERCISE_MAP = {
  'спина': [
    'присідання зі штангою',
    'станова тяга',
    'жим стоячи',
    'нахили зі штангою',
    'тяга штанги в нахилі',
    'гіперекстензія',
    'румунська станова',
    'становая тяга',
    'приседания со штангой',
    'жим штанги стоячи',
    'тяга в наклоне'
  ],
  'хребет': [
    'присідання зі штангою',
    'станова тяга',
    'жим стоячи',
    'нахили зі штангою',
    'тяга штанги в нахилі',
    'румунська станова',
    'становая тяга',
    'приседания со штангой'
  ],
  'поперек': [
    'присідання зі штангою',
    'станова тяга',
    'нахили зі штангою',
    'тяга штанги в нахилі',
    'румунська станова',
    'становая тяга',
    'наклоны со штангой'
  ],
  'коліно': [
    'присідання',
    'випади',
    'болгарські присідання',
    'жим ногами',
    'приседания',
    'выпады',
    'болгарские приседания',
    'жим ног'
  ],
  'коліна': [
    'присідання',
    'випади',
    'болгарські присідання',
    'жим ногами',
    'приседания',
    'выпады',
    'болгарские приседания',
    'жим ног'
  ],
  'плече': [
    'жим над головою',
    'підтягування',
    'жим стоячи',
    'армійський жим',
    'жим штанги стоячи',
    'подтягивания',
    'армейский жим'
  ],
  'плечі': [
    'жим над головою',
    'підтягування',
    'жим стоячи',
    'армійський жим',
    'жим штанги стоячи',
    'подтягивания',
    'армейский жим'
  ]
};

// Безпечні альтернативи для небезпечних вправ (з ключовими словами для пошуку)
const SAFE_ALTERNATIVES = {
  // Альтернативи для проблем зі спиною
  'спина_присідання': {
    name: 'Жим ногами в тренажері',
    description: '🛡️ Замінено через проблеми зі спиною. Безпечна альтернатива присідань без навантаження на хребет.',
    weightType: 'total' as WeightType,
    sets: '3',
    reps: '12-15',
    rest: '90 секунд',
    videoSearchQuery: 'жим ногами техніка виконання',
    safetyNote: 'Замінено через проблеми зі спиною'
  },
  'спина_станова': {
    name: 'Тяга горизонтального блоку до пояса',
    description: '🛡️ Замінено через проблеми зі спиною. Безпечна альтернатива станової тяги з підтримкою спини.',
    weightType: 'total' as WeightType,
    sets: '3',
    reps: '10-12',
    rest: '60 секунд',
    videoSearchQuery: 'тяга горизонтального блоку техніка',
    safetyNote: 'Замінено через проблеми зі спиною'
  },
  'спина_жим': {
    name: 'Жим гантелей сидячи (з опорою)',
    description: '🛡️ Замінено через проблеми зі спиною. Безпечний жим з повною підтримкою спини.',
    weightType: 'single' as WeightType,
    sets: '3',
    reps: '8-10',
    rest: '60 секунд',
    videoSearchQuery: 'жим гантелей сидячи техніка',
    safetyNote: 'Замінено через проблеми зі спиною'
  },
  'спина_гіперекстензія': {
    name: 'Планка на передпліччях',
    description: '🛡️ Замінено через проблеми зі спиною. Безпечне зміцнення кору без гіперрозгинання.',
    weightType: 'bodyweight' as WeightType,
    sets: '3',
    reps: '30-60 секунд',
    rest: '45 секунд',
    videoSearchQuery: 'планка техніка виконання',
    safetyNote: 'Замінено через проблеми зі спиною'
  },
  // Загальні безпечні альтернативи
  'default_спина': {
    name: 'Безпечна альтернатива для спини',
    description: '🛡️ Замінено через проблеми зі спиною. Адаптована вправа з мінімальним навантаженням на хребет.',
    weightType: 'bodyweight' as WeightType,
    sets: '3',
    reps: '10-15',
    rest: '60 секунд',
    videoSearchQuery: 'безпечні вправи для спини',
    safetyNote: 'Замінено через проблеми зі спиною'
  }
};

/**
 * Перевіряє, чи є вправа небезпечною для користувача з травмами
 */
export const isExerciseDangerous = (
  exercise: Exercise,
  healthConstraints: string[],
  wellnessNotes?: string
): boolean => {
  const exerciseName = exercise.name.toLowerCase();
  const allConstraints = [...healthConstraints];
  
  // Додаємо обмеження з нотаток самопочуття
  if (wellnessNotes) {
    const notes = wellnessNotes.toLowerCase();
    Object.keys(INJURY_EXERCISE_MAP).forEach(injury => {
      if (notes.includes(injury)) {
        allConstraints.push(injury);
      }
    });
  }

  // Перевіряємо кожне обмеження
  for (const constraint of allConstraints) {
    const dangerousExercises = INJURY_EXERCISE_MAP[constraint as keyof typeof INJURY_EXERCISE_MAP];
    if (dangerousExercises) {
      for (const dangerous of dangerousExercises) {
        const dangerousLower = dangerous.toLowerCase();
        // Перевіряємо часткове співпадіння в обох напрямках
        if (exerciseName.includes(dangerousLower) || dangerousLower.includes(exerciseName)) {
          console.log(`🚨 [isExerciseDangerous] Знайдено небезпечну вправу: "${exercise.name}" через обмеження "${constraint}" (співпадіння з "${dangerous}")`);
          return true;
        }
        
        // Додаткова перевірка ключових слів
        const exerciseWords = exerciseName.split(' ');
        const dangerousWords = dangerousLower.split(' ');
        
        let matchCount = 0;
        for (const word of exerciseWords) {
          if (word.length > 3 && dangerousWords.some(dw => dw.includes(word) || word.includes(dw))) {
            matchCount++;
          }
        }
        
        // Якщо співпадає більше половини значущих слів - вважаємо небезпечним
        if (matchCount >= Math.min(2, Math.ceil(exerciseWords.length / 2))) {
          console.log(`🚨 [isExerciseDangerous] Знайдено небезпечну вправу за ключовими словами: "${exercise.name}" через обмеження "${constraint}" (${matchCount} співпадінь з "${dangerous}")`);
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Знаходить безпечну альтернативу для небезпечної вправи на основі травми
 */
export const getSafeAlternative = (exercise: Exercise, constraints: string[] = []): Exercise | null => {
  const exerciseName = exercise.name.toLowerCase();
  
  console.log(`🔍 [getSafeAlternative] Шукаємо альтернативу для "${exercise.name}" з обмеженнями:`, constraints);
  
  // Спочатку шукаємо специфічні альтернативи для кожного обмеження
  for (const constraint of constraints) {
    // Перевіряємо ключові слова в назві вправи
    if (exerciseName.includes('присідання') || exerciseName.includes('приседания')) {
      const alternative = (SAFE_ALTERNATIVES as any)[`${constraint}_присідання`];
      if (alternative) {
        console.log(`✅ [getSafeAlternative] Знайдено специфічну альтернативу для присідань: ${alternative.name}`);
        return createSafeExercise(exercise, alternative, constraint);
      }
    }
    
    if (exerciseName.includes('станова') || exerciseName.includes('становая')) {
      const alternative = (SAFE_ALTERNATIVES as any)[`${constraint}_станова`];
      if (alternative) {
        console.log(`✅ [getSafeAlternative] Знайдено специфічну альтернативу для станової: ${alternative.name}`);
        return createSafeExercise(exercise, alternative, constraint);
      }
    }
    
    if (exerciseName.includes('жим') && (exerciseName.includes('стоячи') || exerciseName.includes('стоя'))) {
      const alternative = (SAFE_ALTERNATIVES as any)[`${constraint}_жим`];
      if (alternative) {
        console.log(`✅ [getSafeAlternative] Знайдено специфічну альтернативу для жиму стоячи: ${alternative.name}`);
        return createSafeExercise(exercise, alternative, constraint);
      }
    }
    
    if (exerciseName.includes('гіперекстензія') || exerciseName.includes('гиперэкстензия')) {
      const alternative = (SAFE_ALTERNATIVES as any)[`${constraint}_гіперекстензія`];
      if (alternative) {
        console.log(`✅ [getSafeAlternative] Знайдено специфічну альтернативу для гіперекстензії: ${alternative.name}`);
        return createSafeExercise(exercise, alternative, constraint);
      }
    }
    
    // Якщо специфічної альтернативи немає - використовуємо загальну
    const defaultAlternative = (SAFE_ALTERNATIVES as any)[`default_${constraint}`];
    if (defaultAlternative) {
      console.log(`⚠️ [getSafeAlternative] Використовуємо загальну альтернативу для ${constraint}: ${defaultAlternative.name}`);
      return createSafeExercise(exercise, defaultAlternative, constraint);
    }
  }
  
  console.log(`❌ [getSafeAlternative] Не знайдено альтернативи для "${exercise.name}"`);
  return null;
};

/**
 * Створює безпечну вправу на основі альтернативи
 */
const createSafeExercise = (originalExercise: Exercise, alternative: any, constraint: string): Exercise => {
  return {
    id: originalExercise.id,
    name: alternative.name,
    description: alternative.description,
    sets: alternative.sets,
    reps: alternative.reps,
    rest: alternative.rest,
    weightType: alternative.weightType,
    videoSearchQuery: alternative.videoSearchQuery,
    targetWeight: null,
    targetReps: null,
    recommendation: {
      text: `🛡️ ${alternative.safetyNote}: замінено "${originalExercise.name}" на "${alternative.name}" для безпеки.`,
      action: 'safety_replacement'
    },
    isCompletedDuringSession: false,
    sessionLoggedSets: [],
    sessionSuccess: false,
    notes: `🚨 ЗАМІНА ЧЕРЕЗ ТРАВМУ: "${originalExercise.name}" → "${alternative.name}" (${constraint})`
  };
};

/**
 * Валідує та адаптує план тренувань на клієнті для безпеки
 */
export const validateWorkoutSafety = (
  exercises: Exercise[],
  userProfile: UserProfile,
  wellnessCheck?: WellnessCheck
): Exercise[] => {
  // Використовуємо HealthProfileService для отримання всіх обмежень
  const healthConstraints = HealthProfileService.getAllCurrentLimitations(userProfile, wellnessCheck);
  const wellnessNotes = wellnessCheck?.notes;
  
  console.log('🛡️ [validateWorkoutSafety] Перевіряємо безпеку з обмеженнями:', {
    totalConstraints: healthConstraints.length,
    constraints: healthConstraints,
    activeConditions: userProfile.healthProfile?.conditions?.filter(c => c.isActive)?.length || 0
  });
  
  return exercises.map(exercise => {
    if (isExerciseDangerous(exercise, healthConstraints, wellnessNotes)) {
      const safeAlternative = getSafeAlternative(exercise, healthConstraints);
      if (safeAlternative) {
        console.log(`🛡️ [SAFETY] Replaced dangerous exercise "${exercise.name}" with "${safeAlternative.name}" due to constraints:`, healthConstraints);
        return safeAlternative;
      } else {
        // Якщо немає альтернативи, принаймні додаємо попередження
        console.log(`⚠️ [SAFETY] No alternative found for dangerous exercise "${exercise.name}", adding warning`);
        return {
          ...exercise,
          recommendation: {
            text: `🚨 УВАГА! Ця вправа може бути небезпечною при ваших проблемах здоров'я (${healthConstraints.join(', ')}). Виконуйте з обережністю або пропустіть.`,
            action: 'change_exercise'
          },
          notes: `⚠️ Потенційно небезпечна вправа через: ${healthConstraints.join(', ')}`
        };
      }
    }
    return exercise;
  });
};

/**
 * Додає базові рекомендації до вправ в основному плані
 */
export const addBaseRecommendations = (exercises: Exercise[]): Exercise[] => {
  return exercises.map(exercise => {
    if (!exercise.recommendation || !exercise.recommendation.text) {
      let recommendationText = '';
      
      // Генеруємо рекомендації на основі назви вправи та типу ваги
      const exerciseName = exercise.name.toLowerCase();
      
      if (exerciseName.includes('присідання')) {
        recommendationText = 'Фокусуйтесь на глибині присідань та правильній постановці ніг. Поступово збільшуйте вагу на 2.5-5кг щотижня.';
      } else if (exerciseName.includes('станова') || exerciseName.includes('тяга')) {
        recommendationText = 'Тримайте спину прямою, починайте рух з ніг. Збільшуйте вагу на 2.5кг кожні 1-2 тижні.';
      } else if (exerciseName.includes('жим')) {
        recommendationText = 'Контролюйте опускання, повна амплітуда руху. Прогресуйте на 1.25-2.5кг щотижня.';
      } else if (exerciseName.includes('підтягування') || exerciseName.includes('віджимання')) {
        recommendationText = 'Якщо легко - додайте вагу або збільште кількість повторень. Прогресуйте поступово.';
      } else if (exerciseName.includes('планка')) {
        recommendationText = 'Тримайте тіло прямо, дихайте рівномірно. Збільшуйте час утримання на 10-15 секунд щотижня.';
      } else if (exercise.weightType === 'bodyweight') {
        recommendationText = 'Контролюйте темп виконання, фокусуйтесь на якості. Збільшуйте повторення поступово.';
      } else if (exercise.weightType === 'single') {
        recommendationText = 'Працюйте з однаковою вагою в обох руках. Збільшуйте вагу на 1-2кг кожні 1-2 тижні.';
      } else if (exercise.weightType === 'total') {
        recommendationText = 'Дотримуйтесь правильної техніки. Збільшуйте вагу на 2.5-5кг щотижня при виконанні всіх повторень.';
      } else {
        recommendationText = 'Фокусуйтесь на якості виконання та повній амплітуді руху. Прогресуйте поступово.';
      }
      
      return {
        ...exercise,
        recommendation: {
          text: recommendationText,
          action: 'maintain'
        }
      };
    }
    return exercise;
  });
};
