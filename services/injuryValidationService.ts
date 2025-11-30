import { Exercise, WeightType, UserProfile, WellnessCheck } from '../types';
import { HealthProfileService } from './healthProfileService';
import { generateExerciseRecommendation } from '../utils/exerciseRecommendationGenerator';

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

// NOTE: Removed rigid, hard-coded safe alternatives — prefer AI-driven adaptations.

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

  // Перевіряємо кожне обмеження: робимо менш агресивну перевірку — тільки повні слова або чіткі фрази
  for (const constraint of allConstraints) {
    const dangerousExercises = INJURY_EXERCISE_MAP[constraint as keyof typeof INJURY_EXERCISE_MAP];
    if (!dangerousExercises) continue;

    for (const dangerous of dangerousExercises) {
      const dangerousLower = dangerous.toLowerCase();

      // Точне входження фрази або повні слова
      if (exerciseName === dangerousLower) {
        console.log(`🚨 [isExerciseDangerous] Exact match: "${exercise.name}" for constraint "${constraint}"`);
        return true;
      }

      // Word-level check: require at least one whole significant word match
      const exerciseWords = exerciseName.split(/\s+/).filter(w => w.length > 3);
      const dangerousWords = dangerousLower.split(/\s+/).filter(w => w.length > 3);

      const hasWholeWordMatch = exerciseWords.some(w => dangerousWords.includes(w));
      if (hasWholeWordMatch) {
        console.log(`🚨 [isExerciseDangerous] Word match: "${exercise.name}" matches "${dangerous}" for "${constraint}"`);
        return true;
      }
    }
  }

  return false;
};

/**
 * Знаходить безпечну альтернативу для небезпечної вправи на основі травми
 */
// NOTE: getSafeAlternative and createSafeExercise were removed so that AI chooses
// how to adapt or replace exercises. This module now only detects potential
// risks and annotates exercises so the higher-level AI service can decide.

/**
 * Створює безпечну вправу на основі альтернативи
 */
// createSafeExercise removed.

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
  
  // Нова поведінка: НЕ замінюємо вправи автоматично. Натомість маркуємо ті, що
  // потенційно небезпечні, додаємо рекомендацію-запит до ШІ і передаємо список
  // обмежень у полі `safetyConstraints` для подальшої обробки сервісом ШІ.
  return exercises.map(exercise => {
    if (isExerciseDangerous(exercise, healthConstraints, wellnessNotes)) {
      console.log(`🛡️ [validateWorkoutSafety] Marking exercise for AI adaptation: "${exercise.name}" due to:`, healthConstraints);

      return {
        ...exercise,
        // Запит до ШІ: оцінити і запропонувати заміну або адаптацію
        recommendation: {
          text: `⚠️ Можлива небезпека при наявних обмеженнях (${healthConstraints.join(', ')}). Запросіть ШІ для адаптації/заміни вправи.`,
          action: 'ask_ai_replace'
        },
        needsAIReplacement: true,
        safetyConstraints: healthConstraints,
        safetyReason: `Matched constraints: ${healthConstraints.join(', ')}${wellnessNotes ? ' | wellness: ' + wellnessNotes : ''}`,
        notes: exercise.notes ? exercise.notes + ' | ' + `Потенційно небезпечна: ${healthConstraints.join(', ')}` : `Потенційно небезпечна: ${healthConstraints.join(', ')}`
      };
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
      // Використовуємо універсальну систему генерації рекомендацій
      const recommendation = generateExerciseRecommendation(exercise);
      
      return {
        ...exercise,
        recommendation: {
          text: recommendation.text,
          action: recommendation.action
        }
      };
    }
    return exercise;
  });
};
