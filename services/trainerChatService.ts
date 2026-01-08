import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserProfile, DailyWorkoutPlan } from '../types';
import { UI_TEXT, GEMINI_MODELS } from '../constants';
import { withQuotaManagement, shouldEnableAIFeature, getSmartModel } from '../utils/apiQuotaManager';
import { generateNewExercise, regenerateExercise } from './workoutEditService';
import { v4 as uuidv4 } from 'uuid';

const ai = new GoogleGenerativeAI((import.meta as any).env.VITE_API_KEY || '');

/**
 * Очищує текст від markdown форматування
 */
const cleanMarkdownFormatting = (text: string | null | undefined): string => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/__/g, '').replace(/_/g, '')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/#+\s/g, '')
    .trim();
};

interface TrainerAction {
  type: 'chat' | 'modify_workout' | 'replace_exercise' | 'add_exercise' | 'remove_exercise' | 'modify_exercise_params' | 'confirm_action' | 'select_replacement';
  data?: any;
}

interface TrainerResponse {
  message: string;
  action?: TrainerAction;
  modifiedPlan?: DailyWorkoutPlan;
}

// Глобальна змінна для збереження очікуваних змін
let pendingModification: any = null;

// Генерація звичайних (не модифікаційних) відповідей чату
const generateRegularChatResponse = async (
  userProfile: UserProfile,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  todaysWorkout?: DailyWorkoutPlan | null
): Promise<TrainerResponse> => {
  const recentHistory = conversationHistory.slice(-4);
  
  const chatPrompt = `Ти - розумний персональний фітнес-тренер з можливістю змінювати тренування. Відповідай коротко, зрозуміло та по суті.

Профіль: Вік ${userProfile.age}, ціль: ${userProfile.goal}

${todaysWorkout ? `План на сьогодні: ${todaysWorkout.exercises.map((e: any) => `${e.name} (${e.sets} підходи, ${e.reps} повторень, відпочинок ${e.rest})`).join(', ')}` : ''}

${recentHistory.length > 0 ? `Останні повідомлення:\n${recentHistory.map((msg: any) => `${msg.role === 'user' ? 'Користувач' : 'Тренер'}: ${msg.content}`).join('\n')}\n` : ''}

Повідомлення: ${userMessage}

Відповідай українською, дружньо та професійно!`;

  return withQuotaManagement(async () => {
    const selectedModel = getSmartModel(GEMINI_MODELS.CHAT);
    const model = ai!.getGenerativeModel({ model: selectedModel });
    const response = await model.generateContent(chatPrompt);
    const result = await response.response;
    const rawText = result.text();
    const cleanedMessage = cleanMarkdownFormatting(rawText);
    
    if (!cleanedMessage) {
      return { message: 'Не вдалося отримати відповідь. Спробуйте пізніше.' };
    }
    
    return { message: cleanedMessage };
  }, { message: 'Пробачте, сталася помилка з AI. Спробуйте пізніше.' }, { 
    priority: 'high',
    bypassQuotaInDev: true,
    skipOnQuotaExceeded: false
  });
};

// Розширений чат з урахуванням контексту
const generateEnhancedChatResponse = async (
  userProfile: UserProfile,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  todaysWorkout?: DailyWorkoutPlan | null,
  currentWorkoutPlan?: DailyWorkoutPlan[] | null,
  context?: { wantsAnalysis?: boolean; wantsTechnique?: boolean; wantsMotivation?: boolean }
): Promise<TrainerResponse> => {
  const recentHistory = conversationHistory.slice(-4);
  
  let contextPrompt = `Ти - розумний персональний фітнес-тренер з глибокими знаннями. Відповідай професійно та корисно.

Профіль користувача: Вік ${userProfile.age}, ціль: ${userProfile.goal}`;

  if (todaysWorkout) {
    contextPrompt += `\n\nПоточний план тренувань:
${todaysWorkout.exercises.map((e, i) => `${i + 1}. ${e.name}
   - Підходи: ${e.sets}, Повторення: ${e.reps}
   - Відпочинок: ${e.rest}`).join('\n')}`;
  }

  if (currentWorkoutPlan) {
    contextPrompt += `\n\nЗагальний план: ${currentWorkoutPlan.length} тренувальних днів`;
  }

  if (recentHistory.length > 0) {
    contextPrompt += `\n\nОстанні повідомлення:\n${recentHistory.map(msg => 
      `${msg.role === 'user' ? 'Користувач' : 'Тренер'}: ${msg.content}`
    ).join('\n')}`;
  }

  contextPrompt += `\n\nПовідомлення користувача: ${userMessage}`;

  if (context?.wantsAnalysis) {
    contextPrompt += `\n\n🎯 ФОКУС НА АНАЛІЗІ:
- Проаналізуй поточний план
- Дай конкретні рекомендації`;
  }

  if (context?.wantsTechnique) {
    contextPrompt += `\n\n🏋️ ФОКУС НА ТЕХНІЦІ:
- Дай детальні інструкції
- Вкажи на типові помилки`;
  }

  if (context?.wantsMotivation) {
    contextPrompt += `\n\n💪 ФОКУС НА МОТИВАЦІЇ:
- Дай мотиваційну підтримку
- Поясни користь`;
  }

  contextPrompt += `\n\nВідповідай українською!`;

  return withQuotaManagement(async () => {
    const selectedModel = getSmartModel(GEMINI_MODELS.CHAT);
    const model = ai!.getGenerativeModel({ model: selectedModel });
    const response = await model.generateContent(contextPrompt);
    const result = await response.response;
    const rawText = result.text();
    const cleanedMessage = cleanMarkdownFormatting(rawText);
    
    if (!cleanedMessage) {
      return { message: 'Не вдалося отримати відповідь. Спробуйте пізніше.' };
    }
    
    return { message: cleanedMessage };
  }, { message: 'Пробачте, сталася помилка з AI. Спробуйте пізніше.' }, { 
    priority: 'medium',
    bypassQuotaInDev: true,
    skipOnQuotaExceeded: false
  });
};

// Обробка змін у плані тренувань - ДЕТЕРМІНІСТИЧНА (без AI JSON парсингу)
const handleWorkoutModification = async (
  userProfile: UserProfile,
  userMessage: string,
  todaysWorkout: DailyWorkoutPlan,
  currentWorkoutPlan: DailyWorkoutPlan[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<TrainerResponse> => {
  const message = userMessage.toLowerCase();
  
  console.log('🔧 [handleWorkoutModification] Обробляємо запит:', message);

  const replaceKeywords = ['замін', 'заміни'];
  const addKeywords = ['додай', 'добав', 'додати', 'добавити', 'добавляю'];
  const removeKeywords = ['прибер', 'вилуч', 'видал', 'видали', 'видаліть', 'вилучи', 'приберіть', 'прибери'];
  const modifyKeywords = ['зроби', 'збільш', 'зменш', 'встанов', 'змін'];

  const isReplace = replaceKeywords.some(k => message.includes(k));
  const isAdd = addKeywords.some(k => message.includes(k));
  const isRemove = removeKeywords.some(k => message.includes(k));
  const isModify = modifyKeywords.some(k => message.includes(k)) && !isReplace;

  try {
    // REPLACE EXERCISE
    if (isReplace) {
      console.log('➡️ Обробляємо ЗАМІНУ вправи');
      
      let exerciseIndex = -1;
      let foundExerciseName = '';
      
      for (let i = 0; i < todaysWorkout.exercises.length; i++) {
        const exerciseName = todaysWorkout.exercises[i].name.toLowerCase();
        const words = exerciseName.split(' ');
        
        for (const word of words) {
          if (word.length > 2 && message.includes(word)) {
            exerciseIndex = i;
            foundExerciseName = todaysWorkout.exercises[i].name;
            break;
          }
        }
        if (exerciseIndex !== -1) break;
      }

      if (exerciseIndex === -1) {
        return {
          message: `Не знайшов вправу з вашого опису. Спробуйте назвати точну назву вправи яку хочете замінити.`
        };
      }

      console.log(`✅ Знайшли вправу для заміни: "${foundExerciseName}"`);

      try {
        // Генеруємо варіанти послідовно з обробкою помилок
        const variants = [];
        const maxAttempts = 4; // Спробуємо генерувати до 4 варіантів
        
        for (let attempt = 0; attempt < maxAttempts && variants.length < 3; attempt++) {
          try {
            const newExercise = await regenerateExercise(
              userProfile,
              currentWorkoutPlan,
              todaysWorkout.day,
              exerciseIndex
            );
            variants.push(newExercise);
            console.log(`✅ Генерував варіант ${variants.length}:`, newExercise.name);
          } catch (e) {
            console.warn(`⚠️ Спроба ${attempt + 1}: помилка при генеруванні варіанта:`, e);
            // Чекаємо трохи перед наступною спробою
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (variants.length === 0) {
          return { 
            message: `Не вдалося згенерувати варіанти. Спробуйте пізніше або напишіть яку саме вправу бажаєте.` 
          };
        }

        console.log(`✅ Успішно генерував ${variants.length} варіантів`);

        // Зберігаємо варіанти для подальшого вибору
        pendingModification = {
          actionType: 'replace_exercise',
          data: { 
            originalIndex: exerciseIndex, 
            variants: variants,
            oldExerciseName: foundExerciseName
          },
          modifiedWorkout: null
        };

        // Форматуємо варіанти для відображення
        const variantsList = variants.map((ex, idx) => 
          `${idx + 1}. *${ex.name}*${ex.description ? ' — ' + ex.description.substring(0, 60) + '...' : ''}`
        ).join('\n');

        const confirmText = variants.length < 3 
          ? ` (генерував ${variants.length} із 3 варіантів)`
          : '';

        return {
          message: `Знайшов варіанти для заміни "${foundExerciseName}"${confirmText}:\n\n${variantsList}\n\nНапишіть цифру (1${variants.length > 1 ? `, 2${variants.length > 2 ? ', 3' : ''}` : ''}) для вибору, або "ні" щоб скасувати.`,
          action: { type: 'select_replacement', data: { variants } }
        };
      } catch (error: any) {
        console.error('❌ Помилка при заміні:', error);
        
        // Check for quota/rate limit errors
        if (error.message && error.message.includes('429')) {
          return { message: `На жаль, перевищено щоденний ліміт запитів до AI (20 за день). Спробуйте завтра.` };
        }
        
        if (error.message && (error.message.includes('rate') || error.message.includes('RATE_LIMITED'))) {
          return { message: `Занадто часто звертаємося до AI. Зачекайте кілька хвилин і спробуйте щe раз.` };
        }
        
        return { message: `Виникла помилка при генеруванні варіантів. Спробуйте пізніше або напишіть яку саме вправу бажаєте.` };
      }
    }

    // REMOVE EXERCISE
    if (isRemove) {
      console.log('➡️ Обробляємо ВИДАЛЕННЯ вправи');

      let exerciseIndex = -1;
      let foundExerciseName = '';
      let bestMatchScore = 0;

      for (let i = 0; i < todaysWorkout.exercises.length; i++) {
        const exerciseName = todaysWorkout.exercises[i].name.toLowerCase();
        const words = exerciseName.split(' ');
        let matchScore = 0;

        // Count how many words from exercise name are in the message
        for (const word of words) {
          if (word.length > 2 && message.includes(word)) {
            matchScore++;
          }
        }

        // Update if this is a better match than previous best
        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore;
          exerciseIndex = i;
          foundExerciseName = todaysWorkout.exercises[i].name;
        }
      }

      if (exerciseIndex === -1) {
        return { message: `Не знайшов яку вправу видалити. Спробуйте назвати точну назву.` };
      }

      if (todaysWorkout.exercises.length <= 1) {
        return { message: `Не можу видалити останню вправу. На день мінімум 1 вправа.` };
      }

      const modifiedWorkout: DailyWorkoutPlan = {
        ...todaysWorkout,
        exercises: todaysWorkout.exercises.filter((_, i) => i !== exerciseIndex)
      };

      pendingModification = {
        actionType: 'remove_exercise',
        data: { removedIndex: exerciseIndex },
        modifiedWorkout
      };

      return {
        message: `Розумію, хочете видалити "${foundExerciseName}". Напишіть "так" для підтвердження або "ні" для скасування.`,
        action: { type: 'confirm_action', data: { removedIndex: exerciseIndex } }
      };
    }

    // ADD EXERCISE
    if (isAdd) {
      console.log('➡️ Обробляємо ДОДАВАННЯ вправи');

      try {
        const newExercise = await generateNewExercise(
          userProfile,
          currentWorkoutPlan,
          todaysWorkout.day
        );

        const modifiedWorkout: DailyWorkoutPlan = {
          ...todaysWorkout,
          exercises: [...todaysWorkout.exercises, newExercise]
        };

        pendingModification = {
          actionType: 'add_exercise',
          data: { newExercise },
          modifiedWorkout
        };

        return {
          message: `Розумію, хочете додати нову вправу: "${newExercise.name}". Напишіть "так" для підтвердження або "ні" для скасування.`,
          action: { type: 'confirm_action', data: { newExercise } }
        };
      } catch (error: any) {
        console.error('❌ Error adding exercise:', error);
        
        // Check for specific error types
        if (error.message === 'QUOTA_EXCEEDED') {
          return { 
            message: `На жаль, перевищено щоденний ліміт запитів до AI (20 за день). Спробуйте завтра або розгляньте платний план Gemini.` 
          };
        }
        
        if (error.message === 'RATE_LIMITED') {
          return { 
            message: `Занадто часто звертаємося до AI. Зачекайте кілька хвилин і спробуйте ще раз.` 
          };
        }
        
        // Generic error
        if (error.message && error.message.includes('429')) {
          return { 
            message: `На жаль, перевищено щоденний ліміт запитів до AI. Спробуйте завтра.` 
          };
        }
        
        return { message: `Не вдалось додати вправу. Спробуйте пізніше або напишіть назву вправи вручну.` };
      }
    }

    // MODIFY PARAMETERS
    if (isModify) {
      console.log('➡️ Обробляємо ЗМІНУ параметрів вправи');

      let exerciseIndex = -1;
      let foundExerciseName = '';

      for (let i = 0; i < todaysWorkout.exercises.length; i++) {
        const exerciseName = todaysWorkout.exercises[i].name.toLowerCase();
        const words = exerciseName.split(' ');

        for (const word of words) {
          if (word.length > 2 && message.includes(word)) {
            exerciseIndex = i;
            foundExerciseName = todaysWorkout.exercises[i].name;
            break;
          }
        }
        if (exerciseIndex !== -1) break;
      }

      if (exerciseIndex === -1) {
        return { message: `Не знайшов вправу для зміни. Спробуйте назвати точну назву.` };
      }

      const originalExercise = todaysWorkout.exercises[exerciseIndex];
      const changes: string[] = [];

      const numbers = message.match(/\d+(?:[\.,]\d+)?/g) || [];
      const sets = numbers[0];
      const reps = numbers[1];
      const weight = numbers[2];

      const updatedExercise = { ...originalExercise };

      if (sets) {
        updatedExercise.sets = sets;
        changes.push(`підходи: ${originalExercise.sets} → ${sets}`);
      }
      if (reps) {
        updatedExercise.reps = reps;
        changes.push(`повторення: ${originalExercise.reps} → ${reps}`);
      }
      if (weight) {
        updatedExercise.targetWeight = Number(weight);
        changes.push(`цільова вага: ${originalExercise.targetWeight || 'не вказано'} → ${weight}кг`);
      }

      if (changes.length === 0) {
        return { message: `Не вдалося розпізнати параметри для зміни. Спробуйте написати: "зроби 4 підходи" або "встанови вагу 60".` };
      }

      const modifiedWorkout: DailyWorkoutPlan = {
        ...todaysWorkout,
        exercises: todaysWorkout.exercises.map((ex, i) =>
          i === exerciseIndex ? updatedExercise : ex
        )
      };

      pendingModification = {
        actionType: 'modify_exercise_params',
        data: { exerciseIndex, originalExercise, updatedExercise, changes },
        modifiedWorkout
      };

      const changesText = changes.join(', ');
      return {
        message: `Розумію, хочете змінити для "${foundExerciseName}": ${changesText}. Напишіть "так" для підтвердження або "ні" для скасування.`,
        action: { type: 'confirm_action', data: { exerciseIndex, updatedExercise, changes } }
      };
    }

    return {
      message: `На жаль, не вдалося розпізнати що ви хочете. Спробуйте: "заміни [вправа] на іншу", "додай вправу", "прибери [вправа]" чи "зроби X підходів"`
    };

  } catch (error) {
    console.error('❌ [handleWorkoutModification] Загальна помилка:', error);
    return {
      message: `Виникла помилка при обробці. Спробуйте пізніше.`
    };
  }
};

// Пошук вправи в плані
const findExerciseInPlan = (message: string, plan: DailyWorkoutPlan[]): DailyWorkoutPlan | null => {
  console.log('🔍 [findExerciseInPlan] Шукаємо вправу для:', message);

  const messageLower = message.toLowerCase();
  
  for (const day of plan) {
    for (const exercise of day.exercises) {
      const exerciseName = exercise.name.toLowerCase();
      
      if (messageLower.includes(exerciseName)) {
        console.log('📌 [findExerciseInPlan] Знайшли точну вправу:', exercise.name);
        return day;
      }

      const words = exerciseName.split(' ');
      let matchedWords = 0;
      
      for (const word of words) {
        if (word.length > 2 && messageLower.includes(word)) {
          matchedWords++;
        }
      }

      if (matchedWords > 0 && matchedWords / words.length >= 0.5) {
        console.log(`📌 [findExerciseInPlan] Знайшли вправу по частковому матчу: ${exercise.name}`);
        return day;
      }
    }
  }

  console.log('❌ [findExerciseInPlan] Вправу не знайшли');
  return null;
};

// Основна функція генерації відповіді тренера
export const generateTrainerResponse = async ({
  userProfile,
  userMessage,
  conversationHistory = [],
  currentWorkoutPlan = null,
  activeDay = null
}: {
  userProfile: UserProfile;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentWorkoutPlan?: DailyWorkoutPlan[] | null;
  activeDay?: number | null;
}): Promise<TrainerResponse> => {
  console.log('🤖 [generateTrainerResponse] Отримали повідомлення:', userMessage);

  // Валідація
  if (!userMessage || typeof userMessage !== 'string') {
    return { message: 'Будь ласка, напишіть повідомлення.' };
  }

  // Перевіра підтвердження або скасування
  const confirmKeywords = ['так', 'так!', 'та', 'окей', 'підтверджую'];
  const cancelKeywords = ['ні', 'ні!', 'скасувати', 'скасуй'];

  const isConfirming = confirmKeywords.some(k => userMessage.toLowerCase().includes(k));
  const isCanceling = cancelKeywords.some(k => userMessage.toLowerCase().includes(k));

  // Перевіра вибору варіанта (цифри 1, 2, 3)
  const variantChoice = userMessage.trim().match(/^[1-3]$/);
  const isSelectingVariant = !!variantChoice && pendingModification?.data?.variants;

  if (isSelectingVariant) {
    console.log('✅ [generateTrainerResponse] Користувач вибрав варіант:', variantChoice[0]);
    
    const selectedIndex = Number(variantChoice[0]) - 1;
    const selectedExercise = pendingModification.data.variants[selectedIndex];
    const originalIndex = pendingModification.data.originalIndex;
    const oldExercise = currentWorkoutPlan![0].exercises[originalIndex];

    const newExerciseWithLogged = {
      ...selectedExercise,
      sessionLoggedSets: oldExercise.sessionLoggedSets || [],
      isCompletedDuringSession: oldExercise.isCompletedDuringSession || false,
      sessionSuccess: oldExercise.sessionSuccess ?? true,
      isSkipped: oldExercise.isSkipped || false
    };

    const modifiedWorkout: DailyWorkoutPlan = {
      ...currentWorkoutPlan![0],
      exercises: currentWorkoutPlan![0].exercises.map((ex, i) =>
        i === originalIndex ? newExerciseWithLogged : ex
      )
    };

    pendingModification = {
      actionType: 'replace_exercise',
      data: { originalIndex, newExercise: newExerciseWithLogged },
      modifiedWorkout
    };

    return {
      message: `✅ Вибрав "${selectedExercise.name}". Напишіть "так" для підтвердження або "ні" для скасування.`,
      action: { type: 'confirm_action', data: { originalIndex, newExercise: newExerciseWithLogged } }
    };
  }

  if (isConfirming && pendingModification) {
    console.log('✅ [generateTrainerResponse] Користувач підтвердив зміни');
    
    const result: TrainerResponse = {
      message: `Зрозуміло! Застосовую зміни...`,
      modifiedPlan: pendingModification.modifiedWorkout
    };

    pendingModification = null;
    return result;
  }

  if (isCanceling && pendingModification) {
    console.log('❌ [generateTrainerResponse] Користувач скасував зміни');
    
    pendingModification = null;
    return {
      message: `Зрозуміло. Скасовую зміни.`
    };
  }

  if (!currentWorkoutPlan || currentWorkoutPlan.length === 0) {
    console.log('⚠️ [generateTrainerResponse] Немає плану тренувань');
    return await generateRegularChatResponse(userProfile, userMessage, conversationHistory);
  }

  let todaysWorkout: DailyWorkoutPlan | undefined = activeDay
    ? currentWorkoutPlan.find(day => day.day === activeDay)
    : currentWorkoutPlan[0];

  if (!todaysWorkout) {
    todaysWorkout = currentWorkoutPlan[0];
  }

  const foundDay = findExerciseInPlan(userMessage, currentWorkoutPlan);
  if (foundDay) {
    todaysWorkout = foundDay;
    console.log('🔍 [generateTrainerResponse] Знайшли вправу в дні:', foundDay.day);
  }

  // Виявлення типів запитань
  const modificationKeywords = [
    'замін', 'змін', 'болить', 'біль', 'додай', 'добав', 'добавити', 'прибер', 'вилуч', 'видал',
    'підход', 'повторен', 'вага', 'кг', 'зроби', 'збільш', 'зменш', 'встанов'
  ];

  const analysisKeywords = [
    'прогрес', 'покращ', 'аналіз', 'результат', 'як справ'
  ];

  const techniqueKeywords = [
    'техніка', 'як правильно', 'як робити', 'поясни', 'помилк'
  ];

  const motivationKeywords = [
    'мотивац', 'лінь', 'не хочеться', 'втомився', 'користь'
  ];

  const wantsModification = modificationKeywords.some(k => userMessage.toLowerCase().includes(k));
  const wantsAnalysis = analysisKeywords.some(k => userMessage.toLowerCase().includes(k));
  const wantsTechnique = techniqueKeywords.some(k => userMessage.toLowerCase().includes(k));
  const wantsMotivation = motivationKeywords.some(k => userMessage.toLowerCase().includes(k));

  if (wantsModification && todaysWorkout) {
    console.log('✅ [generateTrainerResponse] Викликаємо handleWorkoutModification');
    return await handleWorkoutModification(
      userProfile, 
      userMessage, 
      todaysWorkout, 
      currentWorkoutPlan,
      conversationHistory
    );
  }

  if (wantsAnalysis || wantsTechnique || wantsMotivation) {
    return await generateEnhancedChatResponse(
      userProfile,
      userMessage,
      conversationHistory,
      todaysWorkout,
      currentWorkoutPlan,
      { wantsAnalysis, wantsTechnique, wantsMotivation }
    );
  }

  return await generateRegularChatResponse(
    userProfile,
    userMessage,
    conversationHistory,
    todaysWorkout
  );
};

export const getPendingModification = () => pendingModification;
export const clearPendingModification = () => { pendingModification = null; };
