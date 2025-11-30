import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserProfile, DailyWorkoutPlan, WellnessCheck, WorkoutLog, AdaptiveWorkoutPlan } from '../types';
import { UI_TEXT, GEMINI_MODELS } from '../constants';
import { withQuotaManagement, getSmartModel } from '../utils/apiQuotaManager';
import { HealthProfileService } from './healthProfileService';
import { generateAdaptiveWorkoutPrompt } from './adaptiveWorkoutPrompt';

// Функції допоміжні
const convertToTenScale = (value: string, type: 'energy' | 'sleep' | 'stress'): number => {
  switch (type) {
    case 'energy':
      switch (value) {
        case 'very_low': return 1;
        case 'low': return 3;
        case 'normal': return 6;
        case 'high': return 8;
        case 'very_high': return 10;
        default: return 5;
      }
    case 'sleep':
      switch (value) {
        case 'poor': return 2;
        case 'fair': return 5;
        case 'good': return 7;
        case 'excellent': return 9;
        default: return 5;
      }
    case 'stress':
      switch (value) {
        case 'high': return 9;
        case 'moderate': return 5;
        case 'low': return 2;
        default: return 5;
      }
  }
};

const analyzeWellnessState = (wellnessCheck: WellnessCheck) => {
  const energyNum = convertToTenScale(wellnessCheck.energyLevel, 'energy');
  const sleepNum = convertToTenScale(wellnessCheck.sleepQuality, 'sleep');
  const stressNum = convertToTenScale(wellnessCheck.stressLevel, 'stress');
  
  return {
    overallScore: (energyNum + sleepNum + (10 - stressNum) + wellnessCheck.motivation + (10 - wellnessCheck.fatigue)) / 5,
    needsRecovery: energyNum <= 4 || sleepNum <= 4 || stressNum >= 7 || wellnessCheck.fatigue >= 7,
    canProgress: energyNum >= 7 && sleepNum >= 7 && stressNum <= 4 && wellnessCheck.fatigue <= 4
  };
};

const buildSmartContext = (
  userProfile: UserProfile,
  workoutHistory: WorkoutLog[],
  wellnessCheck: WellnessCheck,
  originalPlan: DailyWorkoutPlan
): string => {
  let context = '\n\nКОНТЕКСТ КОРИСТУВАЧА:\n';
  
  if (workoutHistory.length > 0) {
    const recentWorkouts = workoutHistory.slice(-3);
    context += `- Останні тренування: ${recentWorkouts.length} сесій\n`;
  }
  
  if (userProfile.experienceLevel) {
    context += `- Досвід тренувань: ${userProfile.experienceLevel}\n`;
  }
  
  return context;
};

/**
 * Нова функція генерації адаптивного тренування з покращеною логікою
 */
export const generateNewAdaptiveWorkout = async (
  userProfile: UserProfile,
  originalPlan: DailyWorkoutPlan,
  wellnessCheck: WellnessCheck,
  workoutHistory: WorkoutLog[]
): Promise<AdaptiveWorkoutPlan> => {
  console.log('🏥 [NEW ADAPTIVE WORKOUT] Starting generation with enhanced logic');

  const apiKey = (import.meta as any).env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  const ai = new GoogleGenerativeAI(apiKey);
  
  // Перевіряємо складність плану для вибору моделі
  const exerciseCount = originalPlan.exercises.length;
  const isComplexPlan = exerciseCount > 6;
  
  const selectedModel = isComplexPlan ? GEMINI_MODELS.WORKOUT_GENERATION : GEMINI_MODELS.LIGHT_TASKS;
  const maxTokens = 60000;
  
  console.log(`🤖 [NEW ADAPTIVE] Selected model: ${selectedModel} (${exerciseCount} exercises)`);
  
  // Отримуємо детальний аналіз самопочуття
  const wellnessAnalysis = analyzeWellnessState(wellnessCheck);
  const energyNum = convertToTenScale(wellnessCheck.energyLevel, 'energy');
  const sleepNum = convertToTenScale(wellnessCheck.sleepQuality, 'sleep');
  const stressNum = convertToTenScale(wellnessCheck.stressLevel, 'stress');
  
  // Додаємо розумний контекст користувача
  const smartContext = buildSmartContext(userProfile, workoutHistory, wellnessCheck, originalPlan);

  // Використовуємо новий розумний промпт
  const adaptivePrompt = generateAdaptiveWorkoutPrompt(
    userProfile,
    originalPlan,
    wellnessCheck,
    workoutHistory,
    energyNum,
    sleepNum,
    stressNum,
    smartContext
  );

  console.log('📝 [NEW ADAPTIVE] Enhanced AI prompt prepared:', {
    promptLength: adaptivePrompt.length,
    model: selectedModel,
    wellnessScore: wellnessAnalysis.overallScore
  });

  try {
    const model = ai.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        temperature: 0.2,
        topK: 20,
        topP: 0.8,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json"
      }
    });

    console.log('🚀 [NEW ADAPTIVE] Making API call with enhanced config');
    const response = await model.generateContent(adaptivePrompt);
    const apiResult = await response.response;
    let jsonStr = apiResult.text().trim();

    console.log('✅ [NEW ADAPTIVE] Received raw response:', {
      responseLength: jsonStr.length,
      firstChars: jsonStr.substring(0, 100),
      lastChars: jsonStr.substring(jsonStr.length - 100),
      containsJSON: jsonStr.includes('{') && jsonStr.includes('}'),
      containsMarkdown: jsonStr.includes('```')
    });

    // Очищаємо markdown, якщо є
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
      console.log('🧹 [NEW ADAPTIVE] Cleaned markdown from response, new length:', jsonStr.length);
    }

    // Парсимо JSON
    let adaptedPlan: any;
    try {
      adaptedPlan = JSON.parse(jsonStr);
      console.log('✅ [NEW ADAPTIVE] JSON parsed successfully!');
    } catch (parseError) {
      console.error('❌ [NEW ADAPTIVE] JSON parsing failed:', parseError);
      console.error('Raw JSON string:', jsonStr);
      throw new Error('Не вдалося розібрати відповідь AI як JSON');
    }

    // Валідація структури
    if (!adaptedPlan.exercises || !Array.isArray(adaptedPlan.exercises)) {
      throw new Error('AI повернув неправильну структуру - відсутні вправи');
    }

    console.log('🔍 [NEW ADAPTIVE] Exercise count check: Original=' + originalPlan.exercises.length + ', Adapted=' + adaptedPlan.exercises.length);

    // Додаткова діагностика: як змінюються назви вправ при адаптації
    const originalNames = originalPlan.exercises.map(ex => ex.name);
    const adaptedNames = adaptedPlan.exercises.map((ex: any) => ex.name);
    console.log('🔍 [NEW ADAPTIVE] Exercise names BEFORE adaptation (оригінальний план):', originalNames);
    console.log('🔍 [NEW ADAPTIVE] Exercise names AFTER adaptation (за самопочуттям):', adaptedNames);

    // Обробляємо systemMemory, якщо є
    if (adaptedPlan.systemMemory && userProfile.healthProfile) {
      const updatedHealthProfile = userProfile.healthProfile;
      
      // Додаємо нові факти до пам'яті
      if (adaptedPlan.systemMemory.newFacts) {
        adaptedPlan.systemMemory.newFacts.forEach((fact: string) => {
          updatedHealthProfile.systemMemory.rememberedFacts.push(fact);
        });
      }

      // Додаємо запис про адаптацію
      if (adaptedPlan.systemMemory.adaptationRecord) {
        updatedHealthProfile.systemMemory.adaptationHistory.push(adaptedPlan.systemMemory.adaptationRecord);
      }

      console.log('🧠 [NEW ADAPTIVE] Updated system memory with new facts');
    }

    // Формуємо результат
    const finalResult: AdaptiveWorkoutPlan = {
      day: adaptedPlan.day || originalPlan.day,
      exercises: adaptedPlan.exercises.map((ex: any) => ({
        id: ex.id || `adaptive-${Date.now()}-${Math.random()}`,
        name: ex.name,
        description: ex.description,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        weightType: ex.weightType || 'total',
        videoSearchQuery: ex.videoSearchQuery || null,
        targetWeight: ex.targetWeight || null,
        targetReps: ex.targetReps || null,
        recommendation: ex.recommendation || { text: '', action: 'maintained' },
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: false,
        notes: ex.notes || null
      })),
      notes: adaptedPlan.notes || '',
      originalPlan: originalPlan,
      adaptations: adaptedPlan.adaptations || [],
      overallAdaptation: adaptedPlan.overallAdaptation || {
        intensity: 'maintained',
        duration: 'normal',
        focus: 'maintenance',
        reason: 'План адаптовано згідно з поточним самопочуттям'
      }
    };

    console.log('🎯 [NEW ADAPTIVE] Successfully generated adaptive workout plan');
    return finalResult;

  } catch (error) {
    console.error('❌ [NEW ADAPTIVE] Error during generation:', error);
    throw new Error(`Помилка генерації адаптивного плану: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
  }
};
