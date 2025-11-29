import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserProfile, DailyWorkoutPlan, WorkoutLog, Exercise, WellnessCheck, AdaptiveWorkoutPlan, WellnessRecommendation } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  getUkrainianGoal, 
  getUkrainianBodyType, 
  getUkrainianGender, 
  getUkrainianMuscleGroup, 
  getUkrainianExperienceLevel,
  UI_TEXT, 
  GEMINI_MODELS
} from '../constants';
import { withQuotaManagement, shouldEnableAIFeature, quotaManager, getSmartModel } from '../utils/apiQuotaManager';
import { addBaseRecommendations, validateWorkoutSafety } from './injuryValidationService';
import { HealthProfileService } from './healthProfileService';
import { generateNewAdaptiveWorkout } from './newAdaptiveWorkout';

// Функції для перекладу варіацій на українську
const getUkrainianVariationType = (variationType: string): string => {
  switch (variationType) {
    case 'progression': return UI_TEXT.progression;
    case 'regression': return UI_TEXT.regression;
    case 'alternative': return UI_TEXT.alternative;
    default: return UI_TEXT.alternative;
  }
};

const getUkrainianDifficulty = (difficulty: string): string => {
  switch (difficulty) {
    case 'beginner': return UI_TEXT.beginner;
    case 'intermediate': return UI_TEXT.intermediate;
    case 'advanced': return UI_TEXT.advanced;
    default: return UI_TEXT.intermediate;
  }
};

export const getApiKey = (): string | null => {
  return (import.meta as any).env.VITE_API_KEY || null;
};

let ai: GoogleGenerativeAI | null = null;
const apiKey = getApiKey();
if (apiKey) {
  try {
      ai = new GoogleGenerativeAI(apiKey);
  } catch (e) {
      console.error("Failed to initialize GoogleGenerativeAI instance:", e);
      ai = null; 
  }
}

const constructPlanPrompt = (profile: UserProfile): string => {
  const { gender, bodyType, goal, trainingFrequency, name, targetMuscleGroups, height, weight, age, experienceLevel, healthProfile, customGoalDescription } = profile;
  
  const userNamePart = name ? `для користувача на ім'я ${name}` : '';
  const genderText = getUkrainianGender(gender);
  const bodyTypeText = getUkrainianBodyType(bodyType);
  const goalText = goal === 'other' && customGoalDescription
    ? customGoalDescription
    : getUkrainianGoal(goal);
  const experienceLevelText = getUkrainianExperienceLevel(experienceLevel);
  const targetMuscleGroupsText = targetMuscleGroups.length > 0 
    ? `з особливим акцентом на ${targetMuscleGroups.map(group => getUkrainianMuscleGroup(group)).join(', ')}`
    : "із загальним розвитком всіх груп м'язів";

  // Обробляємо проблеми здоров'я
  const activeConditions = healthProfile?.conditions?.filter(c => c.isActive) || [];
  const currentLimitations = healthProfile?.currentLimitations || [];
  
  console.log('🏥 [constructPlanPrompt] Аналіз проблем здоров\'я:', {
    totalConditions: healthProfile?.conditions?.length || 0,
    activeConditions: activeConditions.length,
    inactiveConditions: (healthProfile?.conditions?.length || 0) - activeConditions.length,
    currentLimitations: currentLimitations.length,
    activeConditionsDetails: activeConditions.map(c => ({
      condition: c.condition,
      severity: c.severity,
      type: c.type,
      affectedAreas: c.affectedAreas
    })),
    currentLimitationsDetails: currentLimitations
  });
  
  let healthConstraintsText = '';
  if (activeConditions.length > 0 || currentLimitations.length > 0) {
    console.log('🚨 [constructPlanPrompt] ДОДАЄМО ПРОБЛЕМИ ЗДОРОВ\'Я ДО ПРОМПТУ!');
    healthConstraintsText = '\n\n**🚨 КРИТИЧНО ВАЖЛИВО - ПРОБЛЕМИ ЗДОРОВ\'Я:**\n';
    
    if (activeConditions.length > 0) {
      healthConstraintsText += `**Активні проблеми здоров'я (${activeConditions.length}):**\n`;
      activeConditions.forEach(condition => {
        const severityText = condition.severity === 'severe' ? '🔴 СЕРЙОЗНА' : 
                           condition.severity === 'moderate' ? '🟡 ПОМІРНА' : '🟢 ЛЕГКА';
        const typeText = condition.type === 'chronic' ? 'хронічна' : 
                        condition.type === 'temporary' ? 'тимчасова' : 'відновлення';
        
        healthConstraintsText += `- ${severityText} ${typeText} проблема: "${condition.condition}"\n`;
        if (condition.affectedAreas.length > 0) {
          healthConstraintsText += `  Уражені області: ${condition.affectedAreas.join(', ')}\n`;
        }
        if (condition.notes) {
          healthConstraintsText += `  Примітки: ${condition.notes}\n`;
        }
      });
    }
    
    if (currentLimitations.length > 0) {
      healthConstraintsText += `**Поточні обмеження:** ${currentLimitations.join(', ')}\n`;
    }
    
    healthConstraintsText += `
**ОБОВ'ЯЗКОВІ ВИМОГИ ДЛЯ БЕЗПЕКИ:**
1. **УНИКАЙ** вправ, що можуть погіршити зазначені проблеми
2. **АДАПТУЙ** навантаження з урахуванням обмежень
3. **ВКЛЮЧИ** реабілітаційні/профілактичні вправи де можливо
4. **ЗМЕНШИ** інтенсивність для уражених областей
5. **ДОДАЙ** додаткову розминку для проблемних зон
6. У полі "notes" для кожного дня **ОБОВ'ЯЗКОВО** вкажи як враховано проблеми здоров'я`;
    
    console.log('📝 [constructPlanPrompt] Створено текст обмежень здоров\'я:', {
      textLength: healthConstraintsText.length,
      preview: healthConstraintsText.substring(0, 200) + '...'
    });
  } else {
    console.log('✅ [constructPlanPrompt] Немає активних проблем здоров\'я - генеруємо звичайний план');
  }

  return `Ти — висококваліфікований персональний фітнес-тренер, який створює індивідуальні програми тренувань. Твоя мета — розробити максимально ефективний, безпечний та логічний план тренувань у тренажерному залі ${userNamePart}.

**Дій як справжній персональний тренер:**
*   **Індивідуалізація:** План має бути глибоко персоналізованим, враховуючи всі надані дані.
*   **Безпека та техніка:** Завжди наголошуй на важливості правильної техніки та безпеки.
*   **Реалістичність:** Не ускладнюй тренування без потреби, особливо якщо ціль — загальна фізична форма або користувач може бути новачком.
*   **Мотивація:** Твої описи мають бути чіткими та мотивуючими.
*   **Культурна чутливість:** Уникай використання назв вправ, які мають негативні конотації або асоціації з країнами-агресорами, особливо "російські" вправи. Використовуй нейтральні або українські назви.

**Вхідні дані користувача:**
*   Стать: ${genderText}
*   Вік: ${age} років
*   Тип статури: ${bodyTypeText}
*   Головна фітнес-ціль: ${goalText}
*   Бажана частота тренувань: ${trainingFrequency} рази на тиждень
*   Рівень підготовки: ${experienceLevelText}
*   Зріст: ${height} см
*   Вага: ${weight} кг
*   Бажаний акцент: ${targetMuscleGroupsText}${healthConstraintsText}

**Вимоги до плану:**
1.  **Структура:** Розбий план тоно на ${trainingFrequency} тренувальних дні(в), ні більше ні менше. Кожен день повинен мати чітку мету і, якщо вказано, фокусуватися на цільовій групи м'язів, забезпечуючи при цьому достатній час для відновлення цієї групи.
2.  **Розминка та Заминка:** Для кожного тренувального дня надай конкретні рекомендації щодо розминки (5-10 хвилин, наприклад, легке кардіо, динамічна розтяжка основних робочих груп) та заминки (5-10 хвилин, наприклад, статична розтяжка пропрацьованих м'язів).
3.  **Вправи:**
    *   **Підбір:** Ретельно підбери вправи, що відповідають статі, типу статури, цілі та бажаному акценту користувача. Включаю ключові моменти руху, правильне дихання та типові помилки. Опис має бути приблизно однакової довжини для всіх вправ.
    *   **Назва:** Вкажи точну українську назву кожної вправи.
    *   **Опис Техніки:** Надай достатньо детальний, але без зайвої води (приблизно 5-7 речень) покроковий опис правильної техніки виконання кожної вправи. Включаю ключові моменти руху, правильне дихання та типові помилки. Опис має бути приблизно однакової довжини для всіх вправ.
    *   **Кількість підходів:** Вкажи кількість робочих підходів (наприклад, "3-4" або число 4 , вказуєш скільки насправді потрібно зробити підходів залежно від цілі користувача).
    *   **Кількість повторень:** Вкажи діапазон повторень, оптимальний для цілі (наприклад, "8-12" для гіпертрофії, "12-15" для витривалості).
    *   **Відпочинок:** Вкажи рекомендований час відпочинку між підходами в секундах (наприклад, "60-90 секунд").
    *   **weightType:** Для кожної вправи ОБОВ'ЯЗКОВО визнач тип ваги. Це критично важливо. Використовуй один із чотирьох варіантів:
        *   'total' - для вправ, де вказується загальна вага снаряду (наприклад, штанга, тренажер).
        *   'single' - для вправ, де вказується вага одного снаряду (наприклад, гантель, гиря).
        *   'bodyweight' - для вправ, що виконуються з власною вагою тіла (наприклад, віджимання, підтягування, планка).
        *   'none' - для вправ, де вага не застосовується (наприклад, розтяжка, кардіо на власному темпі).
    *   **targetWeight:** Рекомендована цільова вага для вправи (в кілограмах). Визнач на основі:
        *   Рівня підготовки користувача (${experienceLevelText})
        *   Статі (${genderText}) та ваги тіла (${weight} кг)
        *   Типу вправи (базова/ізольована)
        *   Для новачків: консервативні ваги для відпрацювання техніки
        *   Для досвідчених: помірно-важкі ваги для прогресу
        *   Для вправ з weightType 'bodyweight' або 'none' - завжди null
        *   Приклади: присідання для чоловіка 70кг середнього рівня - 60-70кг, жим гантелей - 12-15кг кожна
    *   **videoSearchQuery:** Надай точний пошуковий запит для YouTube, який допоможе користувачеві знайти якісне відео з демонстрацією техніки вправи українською або російською мовою (наприклад, "як правильно робити станову тягу техніка" або "присідання зі штангою техніка виконання"). Якщо якісного запиту сформулювати не вдається, залиш null.
4.  **Прогресія навантаження:** У полі "notes" для кожного дня коротко опиши, як користувачу прогресувати (наприклад, "Намагайся щотижня збільшувати робочу вагу на 1-2.5 кг у базових вправах, зберігаючи ідеальну техніку, або додавати 1-2 повторення.").
5.  **Послідовність:** Вправи в кожному тренуванні мають бути розташовані в логічній послідовності (наприклад, великі м'язові групи перед малими, складніші вправи на початку).
6.  **Примітки (загальні для дня):** Додай будь-які інші корисні поради, нагадування або специфічні рекомендації для конкретного тренувального дня у полі "notes".

**Формат відповіді:**
Надай відповідь ВИКЛЮЧНО у форматі JSON-масиву об'єктів. Кожен об'єкт у масиві представляє один тренувальний день.
Не додавай жодних пояснень, коментарів або тексту поза JSON структурою. JSON має бути ідеально валідним.

**Структура JSON для кожного дня:**
{
  "day": <число>,
  "warmup": "<текст опису розминки з прикладами>",
  "exercises": [
    {
      "name": "<назва вправи>",
      "description": "<дуже детальний покроковий опис техніки>",
      "sets": "<кількість підходів, у форматі '3-4' або 4 , вказуєш скільки насправді потрібно зробити підходів>",
      "reps": "<діапазон повторень, '8-12'>",
      "rest": "<час відпочинку, '60-90 секунд'>",
      "weightType": "<'total' | 'single' | 'bodyweight' | 'none'>",
      "targetWeight": <число в кг або null>,
      "videoSearchQuery": "<пошуковий запит для YouTube або null>"
    }
    // ... інші вправи
  ],
  "cooldown": "<текст опису заминки з прикладами>",
  "notes": "<необов'язкові нотатки/поради щодо прогресії та дня. Може бути порожнім рядком або відсутнім.>"
}

**Приклад структури (заповни реальним, детальним планом):**
[
  {
    "day": 1,
    "warmup": "5-7 хвилин легкого кардіо (велотренажер або бігова доріжка). Динамічна розтяжка: обертання суглобами, махи руками та ногами, нахили корпусу.",
    "exercises": [
      {
        "name": "Присідання зі штангою на плечах",
        "description": "Поставте ноги на ширині плечей, носки трохи розведені. Штанга лежить на верхній частині трапецієподібних м'язів, не на шиї. Спина пряма протягом усього руху, погляд спрямований вперед. На вдиху повільно опускайтеся, згинаючи коліна та відводячи таз назад, ніби сідаєте на стілець. Опускайтесь до паралелі стегон з підлогою або глибше, якщо дозволяє гнучкість та техніка. На видиху потужно виштовхніться п'ятами від підлоги, повертаючись у вихідне положення. Коліна не повинні виходити за лінію носків та не зводьте їх всередину. Помилки: нахил корпусу вперед, підйом на носки, зведення колін.",
        "sets": "4",
        "reps": "8-12",
        "rest": "90-120 секунд",
        "weightType": "total",
        "targetWeight": 60,
        "videoSearchQuery": "присідання зі штангою н плечах техніка виконання"
      }
      // ... інші вправи
    ],
    "cooldown": "Статична розтяжка м'язів ніг (квадрицепси, біцепси стегна, сідничні, литкові) по 20-30 секунд на кожну розтяжку.",
    "notes": "Сьогодні акцент на ногах. Фокусуйтесь на ідеальній техніці. Якщо ви новачок, почніть з порожнім грифом або легкою вагою для відпрацювання руху. Намагайтесь щотижня додавати 1-2.5кг до робочої ваги, якщо виконуєте всі повторення з правильною технікою."
  }
  // ... інші дні
]
Переконайся, що JSON валідний, всі текстові поля заповнені українською мовою, а описи технік максимально детальні та корисні.`;
};

export const generateWorkoutPlan = async (profile: UserProfile, modelName: string = GEMINI_MODELS.WORKOUT_GENERATION): Promise<DailyWorkoutPlan[]> => {
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  console.log('🏋️-♀️ Starting workout plan generation:', {
    modelName,
    userProfile: {
      name: profile.name,
      goal: profile.goal,
      trainingFrequency: profile.trainingFrequency,
      healthConditions: profile.healthProfile?.conditions?.filter(c => c.isActive)?.length || 0,
      currentLimitations: profile.healthProfile?.currentLimitations?.length || 0
    }
  });

  const prompt = constructPlanPrompt(profile);
  
  // Логуємо фінальний промпт для перевірки
  console.log('📋 [generateWorkoutPlan] Фінальний промпт для AI:', {
    promptLength: prompt.length,
    containsHealthConstraints: prompt.includes('🚨 КРИТИЧНО ВАЖЛИВО'),
    healthSectionPreview: prompt.includes('🚨 КРИТИЧНО ВАЖЛИВО') 
      ? prompt.split('🚨 КРИТИЧНО ВАЖЛИВО')[1]?.substring(0, 300) + '...'
      : 'Немає секції здоров\'я'
  });
  
  return withQuotaManagement(async () => {
    // Розумний вибір моделі
    const selectedModel = getSmartModel(modelName);
    console.log(`🤖 Генерація плану використовує модель: ${selectedModel}`);
    
    const model = ai!.getGenerativeModel({ 
      model: selectedModel,
      generationConfig: {
        maxOutputTokens: 32000, // Достатньо для 6 днів з детальними описами та рекомендаціями
        temperature: 0.7, // Креативність для різноманітних рекомендацій
        topK: 40,
        topP: 0.95
      }
    });
    
    console.log('🚀 Making API call to generate workout plan...');
    const response = await model.generateContent(prompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    // Перевіряємо чи відповідь не була обрізана
    if (result.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ Відповідь AI була обрізана через ліміт токенів! Спробуйте зменшити кількість днів тренування.');
    }
    
    const estimatedTokens = Math.ceil(jsonStr.length / 4); // Приблизно 1 токен = 4 символи
    console.log('✅ Received response from API, parsing...', {
      responseLength: jsonStr.length,
      estimatedTokens,
      percentOfLimit: Math.ceil(estimatedTokens / 32000 * 100) + '%',
      containsHealthNotes: jsonStr.toLowerCase().includes('здоров') || jsonStr.toLowerCase().includes('обмеж') || jsonStr.toLowerCase().includes('травм'),
      firstChars: jsonStr.substring(0, 100)
    });
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    try {
      const parsedPlan: any[] = JSON.parse(jsonStr); 
      
      // Перевіряємо базову структуру
      if (!Array.isArray(parsedPlan)) {
        throw new Error("AI повернув не масив днів тренувань");
      }

      // Перевіряємо кожен день
      const basePlan = parsedPlan.map((day, index): DailyWorkoutPlan => {
        if (typeof day.day !== 'number' || !Array.isArray(day.exercises)) {
          throw new Error(`Неправильна структура для дня ${index + 1}`);
        }

        return {
          day: day.day,
          notes: day.notes || '',
          exercises: day.exercises.map((ex: any, exIndex: number) => {
            // Перевіряємо обов'язкові поля вправи
            if (!ex.name || !ex.description || !ex.sets || !ex.reps || !ex.rest) {
              throw new Error(`Відсутні обов'язкові поля у вправі ${exIndex + 1} дня ${day.day}`);
            }

            return {
              id: uuidv4(),
              name: ex.name || "Невідома вправа",
              description: ex.description || "Опис відсутній.",
              sets: ex.sets || "3",
              reps: ex.reps || "10-12",
              rest: ex.rest || "60 секунд",
              weightType: ex.weightType || 'total',
              videoSearchQuery: ex.videoSearchQuery || null,
              targetWeight: ex.targetWeight || null,
              targetReps: ex.targetReps || null,
              recommendation: ex.recommendation || { text: '', action: '' },
              isCompletedDuringSession: false,
              sessionLoggedSets: [],
              sessionSuccess: false,
              notes: ex.notes || null
            };
          })
        };
      });

      // Аналізуємо чи план враховує проблеми здоров'я
      const healthAnalysis = {
        totalDays: basePlan.length,
        totalExercises: basePlan.reduce((sum, day) => sum + day.exercises.length, 0),
        daysWithHealthNotes: basePlan.filter(day => 
          day.notes && (
            day.notes.toLowerCase().includes('здоров') ||
            day.notes.toLowerCase().includes('обмеж') ||
            day.notes.toLowerCase().includes('травм') ||
            day.notes.toLowerCase().includes('уникай') ||
            day.notes.toLowerCase().includes('адапт')
          )
        ).length,
        exercisesWithHealthConsiderations: basePlan.reduce((count, day) => {
          return count + day.exercises.filter(ex => 
            ex.description && (
              ex.description.toLowerCase().includes('обережно') ||
              ex.description.toLowerCase().includes('уникай') ||
              ex.description.toLowerCase().includes('адапт') ||
              ex.description.toLowerCase().includes('травм')
            )
          ).length;
        }, 0),
        sampleHealthNotes: basePlan
          .filter(day => day.notes && day.notes.toLowerCase().includes('здоров'))
          .slice(0, 2)
          .map(day => ({ day: day.day, notes: day.notes?.substring(0, 100) + '...' }))
      };
      
      console.log('🎯 Successfully generated workout plan:', healthAnalysis);
      
      if ((profile.healthProfile?.conditions?.filter(c => c.isActive)?.length || 0) > 0) {
        if (healthAnalysis.daysWithHealthNotes > 0) {
          console.log('✅ [УСПІХ] План ВРАХОВУЄ проблеми здоров\'я!');
        } else {
          console.log('⚠️ [УВАГА] План може НЕ враховувати проблеми здоров\'я!');
        }
      }

      // Додаємо базові рекомендації та перевіряємо безпеку
      return basePlan.map(day => ({
        ...day,
        exercises: addBaseRecommendations(validateWorkoutSafety(day.exercises, profile))
      }));
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      console.error("Received string (after processing):", jsonStr);
      console.error("Original AI response text:", result.text());
      throw new Error("Не вдалося розібрати план тренувань від AI. Можливо, формат відповіді змінився, або сталася помилка на стороні AI.");
    }
  }, undefined, { priority: 'high' });
};

// ЗАСТАРІЛА ФУНКЦІЯ - використовуйте generateNewAdaptiveWorkout
export const generateAdaptiveWorkout = async (
  userProfile: UserProfile,
  originalPlan: DailyWorkoutPlan,
  wellnessCheck: WellnessCheck,
  workoutHistory: WorkoutLog[]
): Promise<AdaptiveWorkoutPlan> => {
  console.log('⚠️ [DEPRECATED] Using old generateAdaptiveWorkout - redirecting to new function');
  return generateNewAdaptiveWorkout(userProfile, originalPlan, wellnessCheck, workoutHistory);
};

export const generateWellnessRecommendations = async (
  userProfile: UserProfile,
  wellnessCheck: WellnessCheck,
  workoutHistory: WorkoutLog[]
): Promise<WellnessRecommendation[]> => {
  console.log('📊 [WELLNESS] Starting wellness recommendations generation:', {
    userProfile: {
      name: userProfile.name,
      goal: userProfile.goal,
      experienceLevel: userProfile.experienceLevel
    },
    wellnessCheck: {
      energyLevel: wellnessCheck.energyLevel,
      sleepQuality: wellnessCheck.sleepQuality,
      stressLevel: wellnessCheck.stressLevel,
      motivation: wellnessCheck.motivation,
      fatigue: wellnessCheck.fatigue
    },
    historyCount: workoutHistory.length
  });

  if (!ai) {
    console.error('❌ [WELLNESS] AI not initialized');
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  console.log('🤖 [WELLNESS] AI initialized successfully');

  try {
    const model = ai.getGenerativeModel({ 
      model: GEMINI_MODELS.LIGHT_TASKS,
      generationConfig: {
        temperature: 0.3,
        topK: 20,
        topP: 0.8,
        maxOutputTokens: 2000
      }
    });

    const prompt = `Ти - досвідчений фітнес-тренер та консультант з здоров'я. Надай персональні рекомендації для покращення самопочуття.

ПРОФІЛЬ КОРИСТУВАЧА:
- Ім'я: ${userProfile.name}
- Мета: ${userProfile.goal}
- Досвід: ${userProfile.experienceLevel}

ПОТОЧНЕ САМОПОЧУТТЯ:
- Енергія: ${wellnessCheck.energyLevel}
- Сон: ${wellnessCheck.sleepQuality}
- Стрес: ${wellnessCheck.stressLevel}
- Мотивація: ${wellnessCheck.motivation}/10
- Втома: ${wellnessCheck.fatigue}/10
${wellnessCheck.notes ? `- Нотатки: "${wellnessCheck.notes}"` : ''}

Надай 2-4 конкретні рекомендації у JSON форматі:
[
  {
    "type": "energy|recovery|motivation|stress",
    "title": "Короткий заголовок",
    "description": "Детальний опис рекомендації",
    "actions": ["Конкретна дія 1", "Конкретна дія 2"],
    "priority": "high|medium|low"
  }
]`;

    console.log('📝 [WELLNESS] Sending prompt to AI:', {
      promptLength: prompt.length,
      userProfileKeys: Object.keys(userProfile),
      wellnessKeys: Object.keys(wellnessCheck)
    });

    const response = await model.generateContent(prompt);
    const result = await response.response;
    let jsonStr = result.text().trim();

    console.log('✅ [WELLNESS] Received response from AI:', {
      responseLength: jsonStr.length,
      firstChars: jsonStr.substring(0, 100)
    });

    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    // Перевіряємо, чи є це валідний JSON масив
    if (!jsonStr.startsWith('[') || !jsonStr.endsWith(']')) {
      console.log(' ⚠️ [WELLNESS] JSON не має правильного формату масиву, спробуємо виправити');
      
      // Спробуємо знайти JSON масив у відповіді
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      } else {
        throw new Error('Невалідний формат JSON від AI');
      }
    }

    try {
      const recommendations: WellnessRecommendation[] = JSON.parse(jsonStr);
      
      if (!Array.isArray(recommendations)) {
        throw new Error('AI повернув не масив рекомендацій');
      }

      console.log('✅ [WELLNESS] Successfully parsed recommendations:', recommendations.length);
      return recommendations;

    } catch (parseError) {
      console.error('❌ [WELLNESS] JSON parsing failed:', parseError);
      console.error('Raw JSON string:', jsonStr);
      throw new Error('Невалідний формат JSON від AI');
    }

  } catch (error: any) {
    console.error(' ❌ [WELLNESS] Error generating wellness recommendations:', error);
    
    // Обробляємо специфічні помилки API
    if (
      (error.message && error.message.toLowerCase().includes("quota")) ||
      (error.message && error.message.toLowerCase().includes("rate limit")) ||
      (error.message && error.message.toLowerCase().includes("429")) ||
      (error.message && (
        error.message.toLowerCase().includes("overload") ||
        error.message.toLowerCase().includes("unavailable") ||
        error.message.toLowerCase().includes("service unavailable")
      ))
    ) {
      throw new Error(UI_TEXT.aiOverloaded);
    }
    
    // Для інших помилок також повертаємо порожній масив замість викидання помилки
    console.warn('🔄 [WELLNESS] Returning empty recommendations due to service error:', error.message);
    return [];
  }
};

export const generateWorkoutAnalysis = async ({
  userProfile,
  dayPlan,
  lastWorkoutLog,
  previousWorkoutLogs = [],
  customPrompt
}: {
  userProfile: UserProfile;
  dayPlan: DailyWorkoutPlan;
  lastWorkoutLog: WorkoutLog | null;
  previousWorkoutLogs?: WorkoutLog[];
  customPrompt?: string;
}): Promise<{
  updatedPlan: DailyWorkoutPlan;
  recommendation: {
    text: string;
    action: string;
  };
  dailyRecommendations: {
    exerciseName: string;
    recommendation: string;
    suggestedWeight?: number;
    suggestedReps?: number;
    suggestedSets?: number;
    reason: string;
    action?: string;
  }[];
}> => {
  console.log('📊 [ANALYSIS] Starting workout analysis');
  
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  // Якщо є кастомний промпт - використовуємо AI аналіз
  if (customPrompt && lastWorkoutLog) {
    try {
      console.log('🧠 [ANALYSIS] Використовуємо AI для розумного аналізу');
      
      const model = ai.getGenerativeModel({ model: getSmartModel(GEMINI_MODELS.ANALYSIS) });
      const result = await withQuotaManagement(async () => {
        const response = await model.generateContent(customPrompt);
        return response.response.text();
      });

      // Парсимо відповідь AI
      const parsedResult = parseAIAnalysisResponse(result, dayPlan, lastWorkoutLog);
      return parsedResult;
      
    } catch (error) {
      console.error('❌ [ANALYSIS] Помилка AI аналізу, використовуємо fallback:', error);
      // Fallback до простого аналізу
    }
  }

  // Простий аналіз без AI для надійності
  const dailyRecommendations = dayPlan.exercises.map(exercise => ({
    exerciseName: exercise.name,
    recommendation: "Продовжуйте тренуватися з поточними параметрами",
    reason: "Базова рекомендація",
    action: "maintain" as const
  }));

  return {
    updatedPlan: dayPlan,
    recommendation: {
      text: "Тренування проаналізовано. Продовжуйте в тому ж дусі!",
      action: "maintain"
    },
    dailyRecommendations
  };
};

/**
 * Парсить відповідь AI та перетворює в структуровані рекомендації
 */
function parseAIAnalysisResponse(
  aiResponse: string, 
  dayPlan: DailyWorkoutPlan, 
  workoutLog: WorkoutLog
): {
  updatedPlan: DailyWorkoutPlan;
  recommendation: { text: string; action: string };
  dailyRecommendations: any[];
} {
  console.log('🔍 [ANALYSIS] Парсимо відповідь AI');
  
  try {
    // Спробуємо знайти JSON в відповіді
    let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          console.log('✅ [ANALYSIS] Успішно розпарсили JSON з', parsed.recommendations.length, 'рекомендаціями');
          return {
            updatedPlan: dayPlan,
            recommendation: parsed.overallRecommendation || {
              text: "Тренування проаналізовано з AI. Дотримуйтесь персональних рекомендацій.",
              action: "maintain"
            },
            dailyRecommendations: parsed.recommendations
          };
        }
      } catch (jsonError) {
        console.warn('⚠️ [ANALYSIS] JSON не валідний, спробуємо виправити:', jsonError);
        // Спробуємо виправити JSON
        const fixedJson = aiResponse
          .replace(/```json\s*/, '')
          .replace(/```\s*$/, '')
          .replace(/,(\s*[}\]])/g, '$1'); // Видаляємо зайві коми
        
        try {
          const parsed = JSON.parse(fixedJson);
          if (parsed.recommendations) {
            return {
              updatedPlan: dayPlan,
              recommendation: parsed.overallRecommendation || {
                text: "Тренування проаналізовано з AI",
                action: "maintain"
              },
              dailyRecommendations: parsed.recommendations
            };
          }
        } catch (secondError) {
          console.error('❌ [ANALYSIS] Не вдалося виправити JSON:', secondError);
        }
      }
    }

    // Якщо JSON не знайдено, парсимо текстову відповідь
    const recommendations = parseTextualAnalysis(aiResponse, dayPlan, workoutLog);
    
    return {
      updatedPlan: dayPlan,
      recommendation: {
        text: "Тренування проаналізовано з AI. Дотримуйтесь рекомендацій для кожної вправи.",
        action: "maintain"
      },
      dailyRecommendations: recommendations
    };
    
  } catch (error) {
    console.error('❌ [ANALYSIS] Помилка парсингу AI відповіді:', error);
    
    // Fallback рекомендації
    return {
      updatedPlan: dayPlan,
      recommendation: {
        text: "Аналіз завершено. Продовжуйте тренування згідно плану.",
        action: "maintain"
      },
      dailyRecommendations: dayPlan.exercises.map(ex => ({
        exerciseName: ex.name,
        recommendation: "Продовжуйте виконання згідно плану",
        reason: "Базова рекомендація",
        action: "maintain"
      }))
    };
  }
}

/**
 * Парсить текстову відповідь AI та витягує рекомендації
 */
function parseTextualAnalysis(
  aiResponse: string, 
  dayPlan: DailyWorkoutPlan, 
  workoutLog: WorkoutLog
): any[] {
  const recommendations: any[] = [];
  const lines = aiResponse.split('\n');
  
  let currentExercise = '';
  let currentRecommendation = '';
  let currentAction = 'maintain';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Шукаємо назви вправ
    const exerciseMatch = dayPlan.exercises.find(ex => 
      trimmedLine.toLowerCase().includes(ex.name.toLowerCase())
    );
    
    if (exerciseMatch) {
      // Зберігаємо попередню рекомендацію
      if (currentExercise && currentRecommendation) {
        recommendations.push({
          exerciseName: currentExercise,
          recommendation: currentRecommendation,
          reason: "AI аналіз виконання",
          action: currentAction
        });
      }
      
      currentExercise = exerciseMatch.name;
      currentRecommendation = '';
      currentAction = 'maintain';
    }
    
    // Шукаємо рекомендації
    if (trimmedLine.includes('рекомендація') || trimmedLine.includes('поради')) {
      currentRecommendation = trimmedLine;
    }
    
    // Шукаємо дії
    if (trimmedLine.includes('збільш')) {
      currentAction = 'increase_weight';
    } else if (trimmedLine.includes('зменш')) {
      currentAction = 'decrease_weight';
    } else if (trimmedLine.includes('змін')) {
      currentAction = 'change_exercise';
    }
  }
  
  // Додаємо останню рекомендацію
  if (currentExercise && currentRecommendation) {
    recommendations.push({
      exerciseName: currentExercise,
      recommendation: currentRecommendation,
      reason: "AI аналіз виконання",
      action: currentAction
    });
  }
  
  // Додаємо рекомендації для вправ які не були згадані
  dayPlan.exercises.forEach(exercise => {
    if (!recommendations.some(rec => rec.exerciseName === exercise.name)) {
      const wasCompleted = workoutLog.loggedExercises?.some(
        logged => logged.exerciseName === exercise.name
      );
      
      recommendations.push({
        exerciseName: exercise.name,
        recommendation: wasCompleted 
          ? "Вправа виконана згідно плану. Продовжуйте в тому ж дусі."
          : "Вправу було пропущено. Рекомендуємо виконати в наступному тренуванні.",
        reason: wasCompleted ? "Успішне виконання" : "Вправа була пропущена",
        action: "maintain"
      });
    }
  });
  
  return recommendations;
}

export const generateExerciseVariations = async (
  exerciseName: string,
  userProfile: UserProfile,
  reason: string = "general"
): Promise<any[]> => {
  console.log('🔄 [VARIATIONS] Generating variations for:', exerciseName);
  
  // Повертаємо порожній масив для простоти
  return [];
};

export const shouldVaryExercise = (
  exerciseName: string,
  userProfile: UserProfile,
  workoutHistory: WorkoutLog[]
): boolean => {
  // Перевіряємо чи workoutHistory існує та не порожній
  if (!workoutHistory || !Array.isArray(workoutHistory)) {
    return false;
  }
  
  // Проста логіка - варіювати кожну 5-ту вправу
  return workoutHistory.length % 5 === 0;
};
