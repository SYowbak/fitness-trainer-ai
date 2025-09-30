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
