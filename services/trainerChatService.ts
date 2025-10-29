import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserProfile, DailyWorkoutPlan } from '../types';
import { UI_TEXT, GEMINI_MODELS } from '../constants';
import { withQuotaManagement, shouldEnableAIFeature, getSmartModel } from '../utils/apiQuotaManager';
import { generateNewExercise, regenerateExercise } from './workoutEditService';
import { v4 as uuidv4 } from 'uuid';

const ai = new GoogleGenerativeAI((import.meta as any).env.VITE_API_KEY || '');

interface TrainerAction {
  type: 'chat' | 'modify_workout' | 'replace_exercise' | 'add_exercise' | 'remove_exercise' | 'modify_exercise_params' | 'confirm_action';
  data?: any;
}

interface TrainerResponse {
  message: string;
  action?: TrainerAction;
  modifiedPlan?: DailyWorkoutPlan;
}

// Допоміжна функція для генерації звичайних (не модифікаційних) відповідей чату
const generateRegularChatResponse = async (
  userProfile: UserProfile,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  todaysWorkout?: DailyWorkoutPlan | null
): Promise<TrainerResponse> => {
  const recentHistory = conversationHistory.slice(-4); // Останні 4 повідомлення для контексту
  
  const chatPrompt = `Ти - розумний персональний фітнес-тренер з можливістю змінювати тренування. Відповідай коротко, зрозуміло та по суті.

Профіль: Вік ${userProfile.age}, ціль: ${userProfile.goal}

${todaysWorkout ? `План на сьогодні: ${todaysWorkout.exercises.map(e => `${e.name} (${e.sets} підходи, ${e.reps} повторень, відпочинок ${e.rest})`).join(', ')}` : ''}

${recentHistory.length > 0 ? `Останні повідомлення:\n${recentHistory.map(msg => `${msg.role === 'user' ? 'Користувач' : 'Тренер'}: ${msg.content}`).join('\n')}\n` : ''}

Повідомлення: ${userMessage}

МОЖЛИВОСТІ РОЗУМНОГО ТРЕНЕРА:
🔧 МОДИФІКАЦІЯ ТРЕНУВАНЬ:
- Заміна вправ: "заміни присідання на жим ногами"
- Зміна підходів: "зроби 4 підходи замість 3 для жиму"
- Зміна повторень: "збільш повторення до 15 для віджимань"
- Зміна відпочинку: "зменш відпочинок до 45 секунд"
- Встановлення цільової ваги: "встанови цільову вагу 60кг для присідань"
- Додавання вправ: "додай вправу на трицепс"
- Видалення вправ: "прибери планку"

📊 АНАЛІЗ ТА ПОРАДИ:
- Аналіз прогресу: "як мій прогрес?", "що покращити?"
- Техніка виконання: "як правильно робити жим лежачи?"
- Рекомендації по вазі: "яку вагу взяти для присідань?"
- Поради по відновленню: "як краще відпочивати між тренуваннями?"

💡 МОТИВАЦІЯ ТА ПІДТРИМКА:
- Мотиваційні поради
- Пояснення користі вправ
- Допомога з дисципліною

ВАЖЛИВО: Перед будь-якими змінами тренування ЗАВЖДИ уточнюй у користувача що ти зрозумів і чекай підтвердження!

Відповідай українською, дружньо та професійно. Будь розумним помічником, а не просто чат-ботом!`;

  return withQuotaManagement(async () => {
    const selectedModel = getSmartModel(GEMINI_MODELS.CHAT);
    console.log(`Чат використовує модель: ${selectedModel}`);
    
    const model = ai!.getGenerativeModel({ model: selectedModel });
    const response = await model.generateContent(chatPrompt);
    const result = await response.response;
    
    return {
      message: result.text()
    };
  }, { message: 'Пробачте, сталася помилка з AI. Спробуйте пізніше.' }, { 
    priority: 'high',
    bypassQuotaInDev: true,
  skipOnQuotaExceeded: false  // Встановлено false для чату — хочемо, щоб працювало
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
   - Відпочинок: ${e.rest}
   - Опис: ${e.description.substring(0, 100)}...`).join('\n')}`;
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
- Проаналізуй поточний план тренувань
- Дай конкретні рекомендації для покращення
- Вкажи на сильні та слабкі сторони
- Запропонуй конкретні кроки для прогресу`;
  }

  if (context?.wantsTechnique) {
    contextPrompt += `\n\n🏋️ ФОКУС НА ТЕХНІЦІ:
- Дай детальні інструкції з техніки виконання
- Вкажи на типові помилки та як їх уникнути
- Поясни правильне дихання та положення тіла
- Дай поради для безпечного виконання`;
  }

  if (context?.wantsMotivation) {
    contextPrompt += `\n\n💪 ФОКУС НА МОТИВАЦІЇ:
- Дай мотиваційну підтримку
- Поясни користь від тренувань
- Допоможи подолати лінь або втому
- Нагадай про досягнення та цілі`;
  }

  contextPrompt += `\n\nВідповідай українською, будь корисним та підтримуючим. Давай конкретні, практичні поради!`;

  return withQuotaManagement(async () => {
    const selectedModel = getSmartModel(GEMINI_MODELS.CHAT);
    console.log(`Розширений чат використовує модель: ${selectedModel}`);
    
    const model = ai!.getGenerativeModel({ model: selectedModel });
    const response = await model.generateContent(contextPrompt);
    const result = await response.response;
    
    return {
      message: result.text()
    };
  }, { message: 'Пробачте, сталася помилка з AI. Спробуйте пізніше.' }, { 
    priority: 'medium',
    bypassQuotaInDev: true,
    skipOnQuotaExceeded: false
  });
};

// Допоміжна функція для обробки змін у плані тренувань
const handleWorkoutModification = async (
  userProfile: UserProfile,
  userMessage: string,
  todaysWorkout: DailyWorkoutPlan,
  currentWorkoutPlan: DailyWorkoutPlan[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<TrainerResponse> => {
  const modificationPrompt = `Користувач хоче змінити тренування. Проаналізуй повідомлення:

"Повідомлення: ${userMessage}"

Поточні вправи на сьогодні:
${todaysWorkout.exercises.map((ex, i) => `${i + 1}. ${ex.name}
   - Підходи: ${ex.sets}
   - Повторення: ${ex.reps}
   - Відпочинок: ${ex.rest}
   - Цільова вага: ${ex.targetWeight || 'не вказано'}
   - Рекомендації: ${ex.recommendation?.text || 'немає'}`).join('\n')}

Визнач конкретну дію:
1. replace_exercise: заміна конкретної вправи
2. add_exercise: додавання нової вправи  
3. remove_exercise: видалення вправи
4. modify_exercise_params: зміна параметрів вправи (підходи, повторення, вага, відпочинок)
5. confirm_action: підтвердження дії (якщо користувач підтверджує зміни)
6. chat: просто розмова

ВАЖЛИВО: Для будь-яких змін тренування ЗАВЖДИ спочатку запитуй підтвердження у користувача!

Для modify_exercise_params додай поля: "exercise_name", "sets", "reps", "rest", "target_weight", "recommendations", "confirmation_needed": true

ПРИКЛАДИ JSON ВІДПОВІДЕЙ:
- Зміна підходів: {"action": "modify_exercise_params", "exercise_name": "Жим лежачи", "sets": "4", "confirmation_needed": true}
- Зміна ваги: {"action": "modify_exercise_params", "exercise_name": "Присідання", "target_weight": "70кг", "confirmation_needed": true}
- Зміна відпочинку: {"action": "modify_exercise_params", "exercise_name": "Віджимання", "rest": "45 секунд", "confirmation_needed": true}
- Заміна вправи: {"action": "replace_exercise", "exercise_name": "Присідання", "reason": "Біль в колінах", "confirmation_needed": true}

КРИТИЧНО ВАЖЛИВО: 
1. ЗАВЖДИ повертай ТІЛЬКИ валідний JSON без додаткового тексту!
2. НЕ додавай пояснення до або після JSON!
3. Якщо вправу не знайдено, використовуй найближчу за назвою!

Відповідь JSON: {"action": "modify_exercise_params", "exercise_name": "Назва вправи", "sets": "3", "reps": "10-12", "rest": "60 секунд", "target_weight": "50", "recommendations": "Нові поради", "reason": "Причина", "confirmation_needed": true}`;

  try {
    const analysisResult = await withQuotaManagement(async () => {
      const selectedModel = getSmartModel(GEMINI_MODELS.ANALYSIS);
      const model = ai!.getGenerativeModel({ model: selectedModel });
      const response = await model.generateContent(modificationPrompt);
      return response.response.text();
    }, null, { 
      priority: 'high',
      bypassQuotaInDev: true,
  skipOnQuotaExceeded: false  // Встановлено false для модифікацій — хочемо, щоб працювало
    });

  // Парсимо JSON-відповідь
    if (!analysisResult) {
      return {
        message: `Не вдалося обробити ваш запит. Спробуйте написати: "заміни вправу [назва] на іншу" або "додай вправу".`
      };
    }
    
    let cleanResponse = analysisResult.replace(/```json|```/g, '').trim();
    
  // Спробувати витягти JSON з текстової відповіді
    const jsonMatch = cleanResponse.match(/\{[^}]*\}/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[0];
    }
    
  let parsedAction: any;
    
    console.log('🤖 [handleWorkoutModification] AI відповідь:', {
      rawResponse: analysisResult.substring(0, 200) + '...',
      cleanResponse: cleanResponse.substring(0, 200) + '...',
      isValidJSON: cleanResponse.startsWith('{') && cleanResponse.endsWith('}')
    });
    
    try {
      parsedAction = JSON.parse(cleanResponse);
      console.log('✅ [handleWorkoutModification] Розпарсили JSON:', {
        action: parsedAction.action,
        exerciseName: parsedAction.exercise_name,
        confirmationNeeded: parsedAction.confirmation_needed
      });
    } catch (parseError) {
      console.error('❌ [handleWorkoutModification] JSON parse error:', parseError, 'Response:', cleanResponse);
      
  // Запасний варіант: спробувати визначити намір з тексту
      if (analysisResult.toLowerCase().includes('заміни') || analysisResult.toLowerCase().includes('замін')) {
        return {
          message: `Я розумію що ви хочете щось замінити, але не можу точно визначити деталі. Спробуйте написати: "заміни [назва вправи] на іншу"`
        };
      }
      
      return {
        message: `Не вдалося розпарсити відповідь AI. Спробуйте переформулювати запит більш конкретно.`
      };
    }

    // Валідація обов'язкових полів
    if (!parsedAction.action) {
      return {
        message: `Не вдалося визначити тип дії. Спробуйте написати більш конкретно що ви хочете змінити.`
      };
    }

    // Handle different actions
    switch (parsedAction.action) {
      case 'replace_exercise': {
        const exerciseIndex = todaysWorkout.exercises.findIndex(ex => 
          ex.name.toLowerCase().includes(parsedAction.exercise_name.toLowerCase()) ||
          parsedAction.exercise_name.toLowerCase().includes(ex.name.toLowerCase())
        );

        if (exerciseIndex === -1) {
          return {
            message: `Не знайшов вправу "${parsedAction.exercise_name}". Повторіть запит, вказавши точну назву.`
          };
        }

        // Generate a replacement exercise
        try {
          const newExercise = await regenerateExercise(
            userProfile, 
            currentWorkoutPlan, 
            todaysWorkout.day, 
            exerciseIndex
          );

          const modifiedWorkout: DailyWorkoutPlan = {
            ...todaysWorkout,
            exercises: todaysWorkout.exercises.map((ex, i) => 
              i === exerciseIndex ? newExercise : ex
            )
          };

          // Зберігаємо зміни для підтвердження
          pendingModification = {
            actionType: 'replace_exercise',
            data: { originalIndex: exerciseIndex, newExercise },
            modifiedWorkout
          };

          return {
            message: `🤔 Я правильно зрозумів? Ви хочете замінити "${todaysWorkout.exercises[exerciseIndex].name}" на "${newExercise.name}" (День ${modifiedWorkout.day})?\n\n📝 Напишіть "так" або "підтверджую" для застосування змін, або "ні" для скасування.`,
            action: {
              type: 'confirm_action',
              data: { originalIndex: exerciseIndex, newExercise }
            }
          };
        } catch (error) {
          return {
            message: `Не вдалося згенерувати заміну. Спробуйте пізніше.`
          };
        }
      }

      case 'add_exercise': {
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

          // Зберігаємо зміни для підтвердження
          pendingModification = {
            actionType: 'add_exercise',
            data: { newExercise },
            modifiedWorkout
          };

          return {
            message: `🤔 Я правильно зрозумів? Ви хочете додати нову вправу: "${newExercise.name}" до Дня ${modifiedWorkout.day}?\n\n📝 Напишіть "так" або "підтверджую" для застосування змін, або "ні" для скасування.`,
            action: {
              type: 'confirm_action',
              data: { newExercise }
            }
          };
        } catch (error) {
          return {
            message: `Не вдалося додати нову вправу. Спробуйте пізніше.`
          };
        }
      }

      case 'remove_exercise': {
        const exerciseIndex = todaysWorkout.exercises.findIndex(ex => 
          ex.name.toLowerCase().includes(parsedAction.exercise_name.toLowerCase()) ||
          parsedAction.exercise_name.toLowerCase().includes(ex.name.toLowerCase())
        );

        if (exerciseIndex === -1) {
          return {
            message: `Не знайшов вправу "${parsedAction.exercise_name}".`
          };
        }

        if (todaysWorkout.exercises.length <= 1) {
          return {
            message: `Не можу видалити останню вправу. Мінімум 1 вправа на день.`
          };
        }

        const modifiedWorkout: DailyWorkoutPlan = {
          ...todaysWorkout,
          exercises: todaysWorkout.exercises.filter((_, i) => i !== exerciseIndex)
        };

        // Зберігаємо зміни для підтвердження
        pendingModification = {
          actionType: 'remove_exercise',
          data: { removedIndex: exerciseIndex },
          modifiedWorkout
        };

        return {
          message: `🤔 Я правильно зрозумів? Ви хочете видалити вправу "${todaysWorkout.exercises[exerciseIndex].name}" з Дня ${modifiedWorkout.day}?\n\n📝 Напишіть "так" або "підтверджую" для застосування змін, або "ні" для скасування.`,
          action: {
            type: 'confirm_action',
            data: { removedIndex: exerciseIndex }
          }
        };
      }

      case 'modify_exercise_params': {
        const exerciseIndex = todaysWorkout.exercises.findIndex(ex => 
          ex.name.toLowerCase().includes(parsedAction.exercise_name.toLowerCase()) ||
          parsedAction.exercise_name.toLowerCase().includes(ex.name.toLowerCase())
        );

        if (exerciseIndex === -1) {
          return {
            message: `Не знайшов вправу "${parsedAction.exercise_name}". Повторіть запит, вказавши точну назву.`
          };
        }

        const originalExercise = todaysWorkout.exercises[exerciseIndex];
        const updatedExercise = {
          ...originalExercise,
          // Оновлюємо тільки ті поля, які були змінені
          sets: parsedAction.sets || originalExercise.sets,
          reps: parsedAction.reps || originalExercise.reps,
          rest: parsedAction.rest || originalExercise.rest,
          targetWeight: parsedAction.target_weight ? Number(parsedAction.target_weight.replace(/[^\d.]/g, '')) : originalExercise.targetWeight,
          recommendation: parsedAction.recommendations ? {
            text: parsedAction.recommendations,
            action: "updated"
          } : originalExercise.recommendation,
          // Зберігаємо всі інші поля без змін
          id: originalExercise.id,
          name: originalExercise.name,
          description: originalExercise.description,
          weightType: originalExercise.weightType,
          videoSearchQuery: originalExercise.videoSearchQuery,
          targetReps: originalExercise.targetReps,
          isCompletedDuringSession: originalExercise.isCompletedDuringSession,
          sessionLoggedSets: originalExercise.sessionLoggedSets,
          sessionSuccess: originalExercise.sessionSuccess,
          isSkipped: originalExercise.isSkipped,
          notes: originalExercise.notes
        };

        const modifiedWorkout: DailyWorkoutPlan = {
          ...todaysWorkout,
          exercises: todaysWorkout.exercises.map((ex, i) => 
            i === exerciseIndex ? updatedExercise : ex
          )
        };

        // Створюємо детальне повідомлення про зміни
        const changes = [];
        if (parsedAction.sets && parsedAction.sets !== originalExercise.sets) {
          changes.push(`підходи: ${originalExercise.sets} → ${parsedAction.sets}`);
        }
        if (parsedAction.reps && parsedAction.reps !== originalExercise.reps) {
          changes.push(`повторення: ${originalExercise.reps} → ${parsedAction.reps}`);
        }
        if (parsedAction.rest && parsedAction.rest !== originalExercise.rest) {
          changes.push(`відпочинок: ${originalExercise.rest} → ${parsedAction.rest}`);
        }
        if (parsedAction.target_weight) {
          const newWeight = Number(parsedAction.target_weight.replace(/[^\d.]/g, ''));
          if (newWeight !== originalExercise.targetWeight) {
            changes.push(`цільова вага: ${originalExercise.targetWeight || 'не вказано'} → ${newWeight}кг`);
          }
        }
        if (parsedAction.recommendations) {
          const currentRecommendation = originalExercise.recommendation?.text || 'немає';
          if (parsedAction.recommendations !== currentRecommendation) {
            changes.push(`рекомендації: оновлено`);
          }
        }

        const changesText = changes.length > 0 ? `${changes.join(', ')}` : 'параметри';

        // Якщо потрібне підтвердження, зберігаємо зміни для подальшого застосування
        if (parsedAction.confirmation_needed !== false) {
          // Зберігаємо зміни в глобальній змінній
          console.log('💾 [modify_exercise_params] Зберігаємо зміни для підтвердження:', {
            exerciseIndex,
            originalName: originalExercise.name,
            updatedName: updatedExercise.name,
            changes: changes,
            workoutDay: modifiedWorkout.day,
            exercisesCount: modifiedWorkout.exercises.length
          });

          pendingModification = {
            actionType: 'modify_exercise_params',
            data: { 
              exerciseIndex, 
              originalExercise, 
              updatedExercise,
              changes: changes
            },
            modifiedWorkout
          };

          return {
            message: `🤔 Я правильно зрозумів? Ви хочете змінити для "${originalExercise.name}" (День ${modifiedWorkout.day}): ${changesText}?\n\n📝 Напишіть "так" або "підтверджую" для застосування змін, або "ні" для скасування.`,
            action: {
              type: 'confirm_action',
              data: { 
                pendingAction: 'modify_exercise_params',
                exerciseIndex, 
                originalExercise, 
                updatedExercise,
                changes: changes,
                modifiedWorkout
              }
            }
          };
        }

        return {
          message: `✅ Оновив параметри для "${originalExercise.name}". Змінено: ${changesText}. ${parsedAction.message || parsedAction.reason || ''}`,
          action: {
            type: 'modify_exercise_params',
            data: { 
              exerciseIndex, 
              originalExercise, 
              updatedExercise,
              changes: changes
            }
          },
          modifiedPlan: modifiedWorkout
        };
      }

      case 'confirm_action': {
        return {
          message: `Будь ласка, підтвердіть дію написавши "так" або "підтверджую", або скасуйте написавши "ні" або "скасувати".`
        };
      }

      default:
        return await generateRegularChatResponse(
          userProfile,
          userMessage,
          conversationHistory,
          todaysWorkout
        );
    }
  } catch (error) {
    console.error('Error in workout modification:', error);
    return {
      message: `Не вдалося обробити ваш запит. Спробуйте написати: "заміни вправу [назва] на іншу" або "додай вправу".`
    };
  }
};

// Глобальна змінна для збереження очікуваних змін
let pendingModification: any = null;

// Допоміжна функція для обчислення схожості рядків (0-1, де 1 — ідентичні)
const calculateStringSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // Обчислюємо відстань Левенштейна
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Алгоритм відстані Левенштейна
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Допоміжна функція для пошуку вправи в плані тренувань
const findExerciseInPlan = (userMessage: string, workoutPlan: DailyWorkoutPlan[]): DailyWorkoutPlan | null => {
  const message = userMessage.toLowerCase();
  
  console.log('🔍 [findExerciseInPlan] Шукаємо вправу для:', message);
  
  // Очищаємо повідомлення від слів-дій (щоб лишити тільки назву вправи)
  const cleanMessage = message.replace(/замін|заміни|додай|прибер|зроби|для|на/g, '').trim();
  
  // Знайти день, що містить вправу, яка відповідає повідомленню користувача
  let bestMatch: { day: DailyWorkoutPlan; similarity: number; exercise: string } | null = null;
  
  for (const day of workoutPlan) {
    for (const exercise of day.exercises) {
      const exerciseName = exercise.name.toLowerCase();
      
  // Обчислити схожість між очищеним повідомленням і назвою вправи
      const fullSimilarity = calculateStringSimilarity(cleanMessage, exerciseName);
      
  // Також перевірити схожість окремих слів
      const exerciseWords = exerciseName.split(' ');
      const messageWords = cleanMessage.split(' ').filter(word => word.length > 2);
      
      let maxWordSimilarity = 0;
      for (const messageWord of messageWords) {
        for (const exerciseWord of exerciseWords) {
          const wordSimilarity = calculateStringSimilarity(messageWord, exerciseWord);
          maxWordSimilarity = Math.max(maxWordSimilarity, wordSimilarity);
        }
      }
      
  // Комбінований бал: 70% — повна схожість + 30% — найкраща відповідність слова
      const combinedSimilarity = fullSimilarity * 0.7 + maxWordSimilarity * 0.3;
      
      if (combinedSimilarity > 0.3) { // Minimum threshold
        console.log('🎯 [findExerciseInPlan] Кандидат:', {
          day: day.day,
          exercise: exercise.name,
          fullSimilarity: Math.round(fullSimilarity * 100),
          maxWordSimilarity: Math.round(maxWordSimilarity * 100),
          combinedSimilarity: Math.round(combinedSimilarity * 100)
        });
        
        if (!bestMatch || combinedSimilarity > bestMatch.similarity) {
          bestMatch = { day, similarity: combinedSimilarity, exercise: exercise.name };
        }
      }
    }
  }
  
  if (bestMatch) {
    console.log('✅ [findExerciseInPlan] Найкращий збіг:', {
      day: bestMatch.day.day,
      exercise: bestMatch.exercise,
      similarity: Math.round(bestMatch.similarity * 100) + '%'
    });
    return bestMatch.day;
  }
  
  console.log('❌ [findExerciseInPlan] Не знайшли вправу в жодному дні');
  return null;
};

// Допоміжна функція для обробки підтверджень/скасувань від користувача
const handleConfirmation = (
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): TrainerResponse | null => {
  // Шукаємо останнє повідомлення тренера з підтвердженням
  const lastAssistantMessage = conversationHistory
    .slice()
    .reverse()
    .find(msg => msg.role === 'assistant' && msg.content.includes('📝 Напишіть "так"'));

  if (!lastAssistantMessage || !pendingModification) return null;

  const confirmationKeywords = ['так', 'підтверджую', 'згоден', 'згодна', 'добре', 'окей', 'ok', 'да', 'yes'];
  const cancelKeywords = ['ні', 'скасувати', 'відміна', 'не треба', 'no', 'cancel'];

  const isConfirmation = confirmationKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );
  
  const isCancellation = cancelKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  if (isConfirmation && pendingModification) {
    // Застосовуємо збережені зміни
    console.log('🔧 [handleConfirmation] Застосовуємо збережені зміни:', {
      actionType: pendingModification.actionType,
      hasModifiedWorkout: !!pendingModification.modifiedWorkout,
      workoutDay: pendingModification.modifiedWorkout?.day,
      exercisesCount: pendingModification.modifiedWorkout?.exercises?.length
    });

    const result = {
      message: `✅ Зрозуміло! Застосовую зміни...`,
      action: {
        type: pendingModification.actionType,
        data: pendingModification.data
      },
      modifiedPlan: pendingModification.modifiedWorkout
    };
    
    // Очищуємо збережені зміни
    pendingModification = null;
    return result;
  } else if (isCancellation) {
    // Скасовуємо збережені зміни
    pendingModification = null;
    return {
      message: `❌ Зрозуміло, скасовую зміни. Що ще можу для вас зробити?`
    };
  }

  return null;
};

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
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  // Check if chat feature is enabled based on quota
  if (!shouldEnableAIFeature('chat')) {
    throw new Error(UI_TEXT.aiOverloaded);
  }

  // Check if this is a confirmation/cancellation response
  const confirmationResponse = handleConfirmation(userMessage, conversationHistory);
  if (confirmationResponse) {
    return confirmationResponse;
  }

  // Get current day's workout if available
  let todaysWorkout = currentWorkoutPlan && activeDay ? 
    currentWorkoutPlan.find(day => day.day === activeDay) : null;

  // If no active day but user wants modification, try to find the exercise in any day
  if (!todaysWorkout && currentWorkoutPlan && currentWorkoutPlan.length > 0) {
    // Try to find which day contains the exercise mentioned in the message
    const foundDay = findExerciseInPlan(userMessage, currentWorkoutPlan);
    if (foundDay) {
      todaysWorkout = foundDay;
      console.log('🔍 [generateTrainerResponse] Знайшли вправу в дні:', {
        selectedDay: foundDay.day,
        exercisesCount: foundDay.exercises.length
      });
    } else {
      // Use first available day as fallback
      todaysWorkout = currentWorkoutPlan[0];
      console.log('🔄 [generateTrainerResponse] Не знайшли конкретну вправу, використовуємо перший день:', {
        selectedDay: currentWorkoutPlan[0].day,
        exercisesCount: currentWorkoutPlan[0].exercises.length
      });
    }
  }

  // Detect different types of requests
  const modificationKeywords = [
    'замін', 'змін', 'інш', 'болить', 'біль', 'травм', 'не можу', 'важко', 
    'складно', 'додай', 'прибер', 'вилуч', 'убер', 'напряжк', 'лікт',
    'підход', 'повторен', 'відпочин', 'вага', 'кг', 'секунд', 'хвилин',
    'збільш', 'зменш', 'більше', 'менше', 'легше', 'важче', 'швидше', 'повільніше',
    'рекоменд', 'порад', 'цільов', 'встанов', 'зроби'
  ];
  
  console.log('🔍 [generateTrainerResponse] Перевіряємо запит на модифікацію:', {
    userMessage: userMessage.toLowerCase(),
    foundKeywords: modificationKeywords.filter(keyword => 
      userMessage.toLowerCase().includes(keyword)
    ),
    wantsModification: modificationKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    ),
    hasTodaysWorkout: !!todaysWorkout
  });

  const analysisKeywords = [
    'прогрес', 'покращ', 'аналіз', 'статистик', 'результат', 'досягнен',
    'як справ', 'що нового', 'як іду', 'чи добре', 'оцін'
  ];

  const techniqueKeywords = [
    'техніка', 'як правильно', 'як робити', 'поясни', 'покаж', 'навчи',
    'правильн', 'помилк', 'дихання', 'положення'
  ];

  const motivationKeywords = [
    'мотивац', 'лінь', 'не хочеться', 'важко почати', 'втомився', 'здався',
    'навіщо', 'користь', 'результат', 'коли буде', 'підтримк'
  ];
  
  const wantsModification = modificationKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  const wantsAnalysis = analysisKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  const wantsTechnique = techniqueKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  const wantsMotivation = motivationKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  // Handle different types of requests with priority
  if (wantsModification && todaysWorkout) {
    console.log('✅ [generateTrainerResponse] Викликаємо handleWorkoutModification');
    return await handleWorkoutModification(
      userProfile, 
      userMessage, 
      todaysWorkout, 
      currentWorkoutPlan!,
      conversationHistory
    );
  } else if (wantsModification && !todaysWorkout) {
    console.log('⚠️ [generateTrainerResponse] Хочуть модифікацію, але немає активного дня');
  } else {
    console.log('ℹ️ [generateTrainerResponse] Не розпізнано як модифікацію, йдемо до звичайного чату');
  }

  // Enhanced chat with context awareness
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

  // Regular chat response
  return await generateRegularChatResponse(
    userProfile,
    userMessage,
    conversationHistory,
    todaysWorkout
  );
};