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
  return import.meta.env.VITE_API_KEY || null;
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
  const { gender, bodyType, goal, trainingFrequency, name, targetMuscleGroups, height, weight, age, experienceLevel } = profile;
  
  const userNamePart = name ? `для користувача на ім'я ${name}` : '';
  const genderText = getUkrainianGender(gender);
  const bodyTypeText = getUkrainianBodyType(bodyType);
  const goalText = getUkrainianGoal(goal);
  const experienceLevelText = getUkrainianExperienceLevel(experienceLevel);
  const targetMuscleGroupsText = targetMuscleGroups.length > 0 
    ? `з особливим акцентом на ${targetMuscleGroups.map(group => getUkrainianMuscleGroup(group)).join(', ')}`
    : "із загальним розвитком всіх груп м'язів";

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
*   Бажаний акцент: ${targetMuscleGroupsText}

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
        "description": "Поставте ноги на ширині плечей, носки трохи розведені. Штанга лежить на верхній частині трапецієподібних м'язів, не на шиї. Спина пряма протягом усього руху, погляд спрямований вперед. На вдиху повільно опускайтеся, згинаючи коліна та відводячи таз назад, ніби сідаєте на стілець. Опускайтесь до паралелі стегон з підлогою або глибше, якщо дозволяє гнучкість та техніка. На видиху потужно виштовхніться п'ятами від підлоги, повертаючись у вихідне положення. Коліна не повинні виходити за лінію носків та не зводьте їх всередину. Помилки: округлення спини, відрив п'ят, завалювання колін всередину.",
        "sets": "4",
        "reps": "8-12",
        "rest": "90-120 секунд",
        "weightType": "total",
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
      trainingFrequency: profile.trainingFrequency
    }
  });

  const prompt = constructPlanPrompt(profile);
  
  return withQuotaManagement(async () => {
    // Розумний вибір моделі
    const selectedModel = getSmartModel(modelName);
    console.log(`🤖 Генерація плану використовує модель: ${selectedModel}`);
    
    const model = ai!.getGenerativeModel({ model: selectedModel });
    
    console.log('🚀 Making API call to generate workout plan...');
    const response = await model.generateContent(prompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    console.log('✅ Received response from API, parsing...', {
      responseLength: jsonStr.length,
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
      return parsedPlan.map((day, index): DailyWorkoutPlan => {
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
              weightType: ex.weightType || 'total', // Додано обробку нового поля
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
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      console.error("Received string (after processing):", jsonStr);
      console.error("Original AI response text:", result.text());
      throw new Error("Не вдалося розібрати план тренувань від AI. Можливо, формат відповіді змінився, або сталася помилка на стороні AI.");
    }
  }, undefined, { priority: 'high' });;
};

export const generateWorkoutAnalysis = async ({
  userProfile,
  dayPlan,
  lastWorkoutLog,
  previousWorkoutLogs = []
}: {
  userProfile: UserProfile;
  dayPlan: DailyWorkoutPlan;
  lastWorkoutLog: WorkoutLog | null;
  previousWorkoutLogs?: WorkoutLog[];
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
  }[];
}> => {
  console.log('📊 [ANALYSIS] Starting workout analysis with:', {
    userProfile: {
      name: userProfile.name,
      goal: userProfile.goal,
      experienceLevel: userProfile.experienceLevel
    },
    dayPlan: {
      day: dayPlan.day,
      exerciseCount: dayPlan.exercises.length,
      exercises: dayPlan.exercises.map(ex => ex.name)
    },
    hasLastWorkout: !!lastWorkoutLog,
    previousWorkoutsCount: previousWorkoutLogs.length
  });
  if (!ai) {
    console.error('❌ [ANALYSIS] AI not initialized');
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  console.log('🤖 [ANALYSIS] AI initialized successfully');

  const modelName = GEMINI_MODELS.LIGHT_TASKS; // Змінюємо на швидшу модель для надійності

  // Аналізуємо історію тренувань для виявлення патернів
  const workoutHistory = lastWorkoutLog ? [lastWorkoutLog, ...previousWorkoutLogs] : previousWorkoutLogs;
  const recentWorkouts = workoutHistory.slice(0, 5); // Останні 5 тренувань
  
  console.log('📊 [ANALYSIS] Processing workout history:', {
    totalWorkouts: workoutHistory.length,
    recentWorkouts: recentWorkouts.length,
    exercisesInPlan: dayPlan.exercises.map(ex => ex.name)
  });
  
  // Аналізуємо прогрес по кожній вправі
  const exerciseProgress = new Map<string, {
    weights: number[];
    reps: number[];
    success: boolean[];
    frequency: number;
  }>();

  recentWorkouts.forEach(workout => {
    workout.loggedExercises.forEach(exercise => {
      const key = exercise.exerciseName;
      if (!exerciseProgress.has(key)) {
        exerciseProgress.set(key, { weights: [], reps: [], success: [], frequency: 0 });
      }
      const progress = exerciseProgress.get(key)!;
      progress.frequency++;
      
      exercise.loggedSets.forEach(set => {
        if (set.weightUsed) progress.weights.push(set.weightUsed);
        if (set.repsAchieved) progress.reps.push(set.repsAchieved);
        if (set.completed !== undefined) progress.success.push(set.completed);
      });
    });
  });

  console.log('🔍 [ANALYSIS] Exercise progress analysis:', {
    trackedExercises: exerciseProgress.size,
    exerciseNames: Array.from(exerciseProgress.keys())
  });

  const analysisPrompt = `Ти - елітний фітнес-аналітик з 15-річним досвідом роботи з професійними спортсменами та любителями. Твоя задача - надати детальний аналіз тренування та персоналізовані рекомендації для прогресу.
ВАЖЛИВО: Відповідь має бути ВИКЛЮЧНО у форматі JSON без жодних додаткових пояснень, коментарів або тексту поза JSON структурою.
Описи та рекомендації мають бути достатньо детальними, але без зайвої води (приблизно 5-7 речень) та приблизно однакової довжини.

Профіль користувача:
${JSON.stringify(userProfile, null, 2)}

План тренування на день:
${JSON.stringify(dayPlan, null, 2)}

Останні тренування (від найновішого до старішого):
${lastWorkoutLog ? JSON.stringify([lastWorkoutLog, ...previousWorkoutLogs], null, 2) : 'Немає попередніх логів'}

Аналіз прогресу по вправах:
${JSON.stringify(Object.fromEntries(exerciseProgress), null, 2)}

Проаналізуй дані та надай персоналізовані рекомендації, враховуючи:

1. Фізичні характеристики та цілі:
   - Стать, вік, зріст, вага
   - Тип статури (ектоморф, мезоморф, ендоморф)
   - Фітнес-ціль (схуднення, набір м'язової маси, сила, витривалість)
   - Рівень досвіду
   - Цільові групи м'язів

2. Історія тренувань:
   - Аналіз попередніх логів
   - Патерни прогресу/регресу
   - Тривалість тренувань
   - Частота тренувань
   - Відпочинок між підходами

3. Прогресія навантаження (адаптуй під профіль):
   - Для схуднення: більше повторень (12-15), менша вага, коротший відпочинок
   - Для набору маси: середня кількість повторень (8-12), середня вага, середній відпочинок
   - Для сили: менше повторень (4-6), більша вага, довший відпочинок
   - Для витривалості: більше повторень (15-20), легка вага, мінімальний відпочинок

4. Техніка та безпека:
   - Аналіз виконаних повторень
   - Перевірка прогресу ваги
   - Відстеження болю/дискомфорту
   - Рекомендації щодо техніки

5. Структура JSON відповіді:
   - "updatedPlan": Оновлений план на день з модифікованими параметрами вправ
   - "recommendation": Загальна рекомендація після аналізу
   - "dailyRecommendations": Масив рекомендацій для кожної вправи

   Приклад JSON:
   {
     "updatedPlan": {
       "day": 1,
       "exercises": [
         {
           "name": "Назва вправи",
           "description": "...",
           "sets": "4",
           "reps": "8-10",
           "rest": "60 секунд",
           "videoSearchQuery": "...",
           "weightType": "total",
           "targetWeight": 100,
           "targetReps": 10,
           "recommendation": {
             "text": "Відмінна робота! Спробуйте збільшити вагу наступного разу.",
             "action": "increase_weight"
           }
         }
       ],
       "notes": "..."
     },
     "recommendation": {
       "text": "Загальна рекомендація по тренуванню дня...",
       "action": "general_feedback"
     },
     "dailyRecommendations": [
       {
         "exerciseName": "Назва вправи",
         "recommendation": "Конкретна рекомендація для цієї вправи",
         "suggestedWeight": 85,
         "suggestedReps": 10,
         "suggestedSets": 4,
         "reason": "Пояснення причини рекомендації"
       }
     ]
   }

Додаткові вказівки:
1. Адаптуй всі рекомендації під конкретний профіль користувача
2. Враховуй тип статури при розрахунку прогресії
3. Надавай конкретні числові значення для targetWeight та targetReps
4. Включай рекомендації щодо техніки, якщо є проблеми
5. Враховуй загальну втому та час відновлення
6. Надавай мотивуючі коментарі при позитивному прогресі
7. Рекомендуй зміни в програмі, якщо вона не відповідає цілям користувача
8. Аналізуй патерни прогресу та регресу для кожної вправи
9. Враховуй частоту виконання вправ у попередніх тренуваннях
10. Надавай рекомендації щодо варіативності вправ для уникнення плато

Проаналізуй надані дані та згенеруй JSON відповідь з оновленим планом на день, загальною рекомендацією та детальними рекомендаціями для кожної вправи.`;

  console.log('📝 [ANALYSIS] Sending prompt to AI:', {
    promptLength: analysisPrompt.length,
    model: modelName,
    userProfileKeys: Object.keys(userProfile),
    exerciseProgressSize: exerciseProgress.size
  });

  return withQuotaManagement(async () => {
    const model = ai!.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 1500,
        responseMimeType: "application/json"
      }
    } as any);
    
    console.log('🚀 [ANALYSIS] Making API call...');
    const response = await model.generateContent(analysisPrompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    console.log('✅ [ANALYSIS] Received response:', {
      responseLength: jsonStr.length,
      firstChars: jsonStr.substring(0, 100)
    });
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
      console.log('🧹 [ANALYSIS] Cleaned markdown from response');
    }

    try {
      const parsedResult: any = JSON.parse(jsonStr);
      
      console.log('🔍 [ANALYSIS] Parsed JSON successfully:', {
        hasUpdatedPlan: !!parsedResult.updatedPlan,
        hasRecommendation: !!parsedResult.recommendation,
        hasDailyRecommendations: !!parsedResult.dailyRecommendations,
        dailyRecommendationsCount: parsedResult.dailyRecommendations?.length
      });
      
      if (!parsedResult || !parsedResult.updatedPlan || !parsedResult.recommendation) {
        console.error("❌ [ANALYSIS] Неправильна базова структура відповіді від AI аналізу:", parsedResult);
        throw new Error("Неправильна базова структура відповіді від AI аналізу");
      }

      const updatedPlan = parsedResult.updatedPlan;
      const generalRecommendation = parsedResult.recommendation;
      const dailyRecommendations = parsedResult.dailyRecommendations || [];

      if (typeof updatedPlan.day !== 'number' || !Array.isArray(updatedPlan.exercises)) {
        console.error("❌ [ANALYSIS] Неправильна структура updatedPlan у відповіді від AI аналізу:", updatedPlan);
        throw new Error("Неправильна структура updatedPlan у відповіді від AI аналізу");
      }

      const mappedUpdatedPlan: DailyWorkoutPlan = {
        day: updatedPlan.day,
        notes: updatedPlan.notes || '',
        exercises: updatedPlan.exercises.map((ex: any): Exercise => ({
          id: uuidv4(),
          name: ex.name || "Невідома вправа",
          description: ex.description || "Опис відсутній.",
          sets: ex.sets || "3",
          reps: ex.reps || "10-12",
          rest: ex.rest || "60 секунд",
          weightType: ex.weightType || 'total',
          videoSearchQuery: ex.videoSearchQuery || null,
          targetWeight: ex.targetWeight !== undefined && ex.targetWeight !== null ? ex.targetWeight : null,
          targetReps: ex.targetReps !== undefined && ex.targetReps !== null ? ex.targetReps : null,
          recommendation: ex.recommendation || { text: '', action: '' },
          isCompletedDuringSession: false,
          sessionLoggedSets: [],
          sessionSuccess: false,
          notes: ex.notes || null
        }))
      };

      console.log('✅ [ANALYSIS] Successfully created analysis result:', {
        updatedPlanExercises: mappedUpdatedPlan.exercises.length,
        dailyRecommendationsCount: dailyRecommendations.length,
        recommendationAction: generalRecommendation.action
      });

      return {
        updatedPlan: mappedUpdatedPlan,
        recommendation: generalRecommendation,
        dailyRecommendations: dailyRecommendations
      };
    } catch (e) {
      console.error("❌ [ANALYSIS] Error parsing JSON from AI analysis response:", e);
      console.error("🔍 [ANALYSIS] Received string (after processing):", jsonStr);
      console.error("🔍 [ANALYSIS] Original AI response text:", result.text());
      
      console.warn('⚠️ [ANALYSIS] Creating fallback analysis response due to parsing error');
      
      const fallbackAnalysis = {
        updatedPlan: {
          day: dayPlan.day,
          notes: dayPlan.notes || 'План залишено без змін через помилку аналізу',
          exercises: dayPlan.exercises.map(ex => ({
            ...ex,
            recommendation: {
              text: 'Вправа залишена без змін',
              action: 'maintain'
            }
          }))
        },
        recommendation: {
          text: 'Не вдалося провести повний аналіз тренування. Продовжуйте за попереднім планом.',
          action: 'maintain'
        },
        dailyRecommendations: dayPlan.exercises.map(ex => ({
          exerciseName: ex.name,
          recommendation: 'Продовжуйте за попереднім планом',
          reason: 'Аналіз недоступний'
        }))
      };
      
      return fallbackAnalysis;
    }
  }, {
    // Fallback response for quota/API errors
    updatedPlan: {
      day: dayPlan.day,
      notes: dayPlan.notes || 'План залишено без змін через помилку сервісу',
      exercises: dayPlan.exercises.map(ex => ({
        ...ex,
        recommendation: {
          text: 'Вправа залишена без змін',
          action: 'maintain'
        }
      }))
    },
    recommendation: {
      text: 'Сервіс аналізу тимчасово недоступний. Продовжуйте тренування за попереднім планом.',
      action: 'maintain'
    },
    dailyRecommendations: dayPlan.exercises.map(ex => ({
      exerciseName: ex.name,
      recommendation: 'Продовжуйте за попереднім планом',
      reason: 'Аналіз тимчасово недоступний'
    }))
  }, { priority: 'medium', skipOnQuotaExceeded: true });
};

export const generateExerciseVariations = async (
  userProfile: UserProfile,
  originalExercise: Exercise,
  workoutHistory: WorkoutLog[],
  targetMuscleGroup: string
): Promise<Exercise[]> => {
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  // Check if variations feature should be enabled
  if (!shouldEnableAIFeature('variations')) {
    console.warn('Exercise variations disabled due to quota limits');
    return []; // Return empty array as fallback
  }

  const modelName = GEMINI_MODELS.LIGHT_TASKS; // Швидка модель для варіацій вправ

  // Calculate exercise frequency from workout history
  const exerciseFrequency = shouldVaryExercise(originalExercise.name, workoutHistory) 
    ? workoutHistory.slice(0, 10).filter(workout => 
        workout.loggedExercises.some(ex => ex.exerciseName === originalExercise.name)
      ).length 
    : 0;

  const variationPrompt = `Ти - експерт з фітнесу, який створює варіації вправ для уникнення плато та підтримки прогресу. 

Профіль користувача:
${JSON.stringify(userProfile, null, 2)}

Оригінальна вправа:
${JSON.stringify(originalExercise, null, 2)}

Цільова група м'язів: ${targetMuscleGroup}
Частота виконання цієї вправи: ${exerciseFrequency} разів за останні тренування

Створи 3-4 варіації цієї вправи, які:
1. Проробують ту саму групу м'язів
2. Мають різний рівень складності
3. Враховують рівень досвіду користувача
4. Відповідають фітнес-цілі користувача
5. Забезпечують варіативність для уникнення звикання
6. Культурна чутливість: Уникай використання назв вправ, які мають негативні конотації або асоціації з країною-агресором, особливо "російські" вправи. Використовуй нейтральні або українські назви (не вказуй ніде про те чому ти змінив назву, просто зроби це).
7. **Стислість:** Описи та причини мають бути достатньо детальними, але без зайвої води (приблизно 5-7 речень) та приблизно однакової довжини.

ВАЖЛИВО: Відповідь має бути ВИКЛЮЧНО у форматі JSON-масиву без жодних пояснень.

Формат JSON:
[
  {
    "name": "Назва варіації вправи",
    "description": "Детальний опис техніки виконання",
    "sets": "3-4",
    "reps": "8-12",
    "rest": "60-90 секунд",
    "videoSearchQuery": "пошуковий запит для YouTube",
    "difficulty": "beginner|intermediate|advanced",
    "variationType": "progression|regression|alternative",
    "reason": "Пояснення чому ця варіація корисна"
  }
]`;

  return withQuotaManagement(async () => {
    const model = ai!.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(variationPrompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    const variations: any[] = JSON.parse(jsonStr);
    
    return variations.map((variation): Exercise => ({
      id: uuidv4(),
      name: variation.name || "Варіація вправи",
      description: variation.description || "Опис відсутній",
      sets: variation.sets || "3",
      reps: variation.reps || "10-12",
      rest: variation.rest || "60 секунд",
      weightType: variation.weightType || 'total',
      videoSearchQuery: variation.videoSearchQuery || null,
      targetWeight: null,
      targetReps: null,
      recommendation: {
        text: variation.reason || "Варіація для уникнення плато",
        action: "variation"
      },
      isCompletedDuringSession: false,
      sessionLoggedSets: [],
      sessionSuccess: false,
      notes: `Варіація: ${getUkrainianVariationType(variation.variationType)} | Складність: ${getUkrainianDifficulty(variation.difficulty)}`
    }));
  }, [], { priority: 'low', skipOnQuotaExceeded: true });
};

// Add quota status component
export const getQuotaStatusMessage = (): string => {
  return quotaManager.getStatusMessage();
};

export const canUseAIFeatures = (): boolean => {
  return quotaManager.canMakeRequest();
};

export const shouldVaryExercise = (
  exerciseName: string,
  workoutHistory: WorkoutLog[],
  variationThreshold: number = 3
): boolean => {
  const recentWorkouts = workoutHistory.slice(0, 10); // Останні 10 тренувань
  const frequency = recentWorkouts.filter(workout => 
    workout.loggedExercises.some(ex => ex.exerciseName === exerciseName)
  ).length;
  
  return frequency >= variationThreshold;
};

export const generateAdaptiveWorkout = async (
  userProfile: UserProfile,
  originalPlan: DailyWorkoutPlan,
  wellnessCheck: WellnessCheck,
  workoutHistory: WorkoutLog[]
): Promise<AdaptiveWorkoutPlan> => {
  console.log('🏥 [ADAPTIVE WORKOUT] Starting generation with:', {
    userProfile: {
      name: userProfile.name,
      goal: userProfile.goal,
      experienceLevel: userProfile.experienceLevel
    },
    originalPlan: {
      day: originalPlan.day,
      exerciseCount: originalPlan.exercises.length,
      exercises: originalPlan.exercises.map(ex => ex.name)
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
    console.error('❌ [ADAPTIVE WORKOUT] AI not initialized');
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  console.log('🤖 [ADAPTIVE WORKOUT] AI initialized successfully');

  const modelName = GEMINI_MODELS.WORKOUT_GENERATION; // Основна модель дль адаптивного тренування

  // Перевіряємо складність плану для вибору моделі
  const exerciseCount = originalPlan.exercises.length;
  const isComplexPlan = exerciseCount > 6;
  const selectedModel = isComplexPlan ? GEMINI_MODELS.WORKOUT_GENERATION : GEMINI_MODELS.LIGHT_TASKS;
  
  console.log(`🤖 [ADAPTIVE WORKOUT] Selected model: ${selectedModel} (${exerciseCount} exercises, complex: ${isComplexPlan})`);

  const adaptivePrompt = `Ти - досвідчений персональний тренер, який адаптує тренування під поточний стан та самопочуття клієнта. Твоя задача - створити адаптивний план тренування, враховуючи самопочуття та історію тренувань.

Якщо у профілі є "healthConstraints" (травми/обмеження), обов'язково уникай рухів/амплітуд, що можуть загострити стан. Врахуй це у підборі вправ, підходів/повторень, відпочинку та можливих замінах.

ВАЖЛИВО: Відповідь має бути ВИКЛЮЧНО у форматі JSON без жодних пояснень.

Профіль користувача (з можливими обмеженнями здоров'я):
${JSON.stringify(userProfile, null, 2)}

Оригінальний план тренування:
${JSON.stringify(originalPlan, null, 2)}

Поточне самопочуття:
${JSON.stringify(wellnessCheck, null, 2)}

Історія тренувань (останні 5):
${JSON.stringify(workoutHistory.slice(0, 5), null, 2)}

Створи адаптивний план тренування, враховуючи:
1. **Культурна чутливість:** Уникай використання назв вправ, які мають негативні конотації або асоціації з країнами-агресорами, особливо "російські" вправи. Використовуй нейтральні або українські назви.
2. **Стислість:** Описи вправ та рекомендації мають бути достатньо детальними, але без зайвої води (приблизно 5-7 речень) та приблизно однакової довжини.
3. Рівень енергії:
   - VERY_LOW: Зменшити інтенсивність на 50-70%, фокус на відновленні
   - LOW: Зменшити інтенсивність на 30-50%, фокус на підтримці
   - NORMAL: Зберегти оригінальний план
   - HIGH: Можна збільшити інтенсивність на 10-20%
   - VERY_HIGH: Можна збільшити інтенсивність на 20-30%

2. Якість сну:
   - POOR: Значно зменшити навантаження, додати більше відпочинку
   - FAIR: Помірно зменшити навантаження
   - GOOD: Мінімальні зміни
   - EXCELLENT: Можна збільшити навантаження

3. Рівень стресу:
   - HIGH: Фокус на розслабляючих вправах, зменшити інтенсивність
   - MODERATE: Помірні зміни
   - LOW: Нормальне тренування

4. Мотивація та втома:
   - Мотивація 1-3: Значно зменшити навантаження, додати мотиваційні елементи
   - Мотивація 4-6: Помірно зменшити навантаження
   - Мотивація 7-10: Нормальне або збільшене навантаження
   - Втома 8-10: Значно зменшити навантаження, фокус на відновленні

5. Типи адаптацій:
   - Зменшення кількості підходів
   - Зменшення кількості повторень
   - Збільшення відпочинку між підходами
   - Заміна на легші варіації вправ
   - Додавання розминкових вправ
   - Зміна фокусу тренування

Формат JSON відповіді:
{
  "day": 1,
  "exercises": [
    {
      "name": "Назва вправи",
      "description": "Опис техніки",
      "sets": "3",
      "reps": "8-10",
      "rest": "90 секунд",
      "videoSearchQuery": "...",
      "weightType": "total", // Додано для прикладу
      "targetWeight": null,
      "targetReps": null,
      "recommendation": {
        "text": "Адаптовано під низький рівень енергії",
        "action": "reduced_intensity"
      },
      "isCompletedDuringSession": false,
      "sessionLoggedSets": [],
      "sessionSuccess": false
    }
  ],
  "notes": "Адаптовано під ваше самопочуття",
  "originalPlan": { /* оригінальний план */ },
  "adaptations": [
    {
      "exerciseName": "Назва вправи",
      "originalSets": "4",
      "originalReps": "12-15",
      "adaptedSets": "3",
      "adaptedReps": "8-10",
      "adaptationReason": "Зменшено через низький рівень енергії",
      "energyLevel": "low"
    }
  ],
  "overallAdaptation": {
    "intensity": "reduced",
    "duration": "shorter",
    "focus": "recovery",
    "reason": "Адаптовано під низький рівень енергії та поганий сон"
  }
}`;

  console.log('📝 [ADAPTIVE WORKOUT] Sending prompt to AI:', {
    promptLength: adaptivePrompt.length,
    model: selectedModel,
    userProfileKeys: Object.keys(userProfile),
    wellnessKeys: Object.keys(wellnessCheck)
  });

  try {
    // Оптимізовані налаштування для швидшої обробки
    const model = ai.getGenerativeModel({
      model: selectedModel, // Динамічний вибір моделі
      generationConfig: {
        temperature: 0.3,
        topK: 30,
        topP: 0.8,
        maxOutputTokens: isComplexPlan ? 2500 : 2000, // Більше токенів для складних планів
        responseMimeType: "application/json"
      }
    } as any);
    
    console.log('🚀 [ADAPTIVE WORKOUT] Making API call...');
    const response = await model.generateContent(adaptivePrompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    console.log('✅ [ADAPTIVE WORKOUT] Received raw response:', {
      responseLength: jsonStr.length,
      firstChars: jsonStr.substring(0, 100),
      lastChars: jsonStr.length > 100 ? jsonStr.substring(jsonStr.length - 100) : 'N/A',
      containsJSON: jsonStr.includes('{') && jsonStr.includes('}'),
      containsMarkdown: jsonStr.includes('```'),
      lineCount: jsonStr.split('\n').length
    });
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
      console.log('🧹 [ADAPTIVE WORKOUT] Cleaned markdown from response, new length:', jsonStr.length);
    } else {
      console.log('ℹ️ [ADAPTIVE WORKOUT] No markdown detected, keeping original response');
    }

    try {
      console.log('🔍 [ADAPTIVE WORKOUT] About to parse JSON:', {
        jsonLength: jsonStr.length,
        startsWithBrace: jsonStr.startsWith('{'),
        endsWithBrace: jsonStr.endsWith('}'),
        first100Chars: jsonStr.substring(0, 100),
        last100Chars: jsonStr.length > 100 ? jsonStr.substring(jsonStr.length - 100) : 'N/A'
      });
      
      const parsedResult: any = JSON.parse(jsonStr);
      console.log('✅ [ADAPTIVE WORKOUT] JSON parsed successfully');
      console.log('🔍 [ADAPTIVE WORKOUT] Parsed structure:', {
        hasExercises: !!parsedResult.exercises,
        exerciseCount: parsedResult.exercises?.length,
        hasAdaptations: !!parsedResult.adaptations,
        hasOverallAdaptation: !!parsedResult.overallAdaptation,
        topLevelKeys: Object.keys(parsedResult || {})
      });
      
      // Перевіряємо структуру
      if (!parsedResult || !parsedResult.exercises || !Array.isArray(parsedResult.exercises)) {
        console.error('❌ [ADAPTIVE WORKOUT] Invalid structure detected:', {
          hasResult: !!parsedResult,
          hasExercises: !!parsedResult?.exercises,
          exercisesType: typeof parsedResult?.exercises,
          isArray: Array.isArray(parsedResult?.exercises),
          entireResult: parsedResult
        });
        throw new Error("Неправильна структура адаптивного плану");
      }
      
      // Перевіряємо чи всі вправи з оригінального плану були оброблені
      const originalExerciseCount = originalPlan.exercises.length;
      const adaptedExerciseCount = parsedResult.exercises.length;
      
      console.log(`🔍 [ADAPTIVE WORKOUT] Exercise count check: Original=${originalExerciseCount}, Adapted=${adaptedExerciseCount}`);
      
      // Якщо модель обробила менше вправ, дозаповнюємо з оригінального плану
      let finalExercises = parsedResult.exercises;
      if (adaptedExerciseCount < originalExerciseCount) {
        console.warn(`⚠️ Model processed only ${adaptedExerciseCount}/${originalExerciseCount} exercises. Adding missing ones.`);
        
        // Знаходимо оброблені вправи по назвах
        const adaptedNames = new Set(parsedResult.exercises.map((ex: any) => ex.name?.toLowerCase()));
        
        // Додаємо відсутні вправи з оригінального плану
        const missingExercises = originalPlan.exercises
          .filter(origEx => !adaptedNames.has(origEx.name.toLowerCase()))
          .map(origEx => ({
            ...origEx,
            recommendation: {
              text: "Залишено без змін через обмеження обробки",
              action: "maintained"
            }
          }));
        
        finalExercises = [...parsedResult.exercises, ...missingExercises];
        console.log(`✅ Added ${missingExercises.length} missing exercises`);
      }

      const adaptivePlan: AdaptiveWorkoutPlan = {
        day: parsedResult.day || originalPlan.day,
        exercises: finalExercises.map((ex: any): Exercise => ({
          id: uuidv4(),
          name: ex.name || "Невідома вправа",
          description: ex.description || "Опис відсутній",
          sets: ex.sets || "3",
          reps: ex.reps || "10-12",
          rest: ex.rest || "60 секунд",
          weightType: ex.weightType || 'total',
          videoSearchQuery: ex.videoSearchQuery || null,
          targetWeight: ex.targetWeight !== undefined ? ex.targetWeight : null,
          targetReps: ex.targetReps !== undefined ? ex.targetReps : null,
          recommendation: ex.recommendation || { text: '', action: '' },
          isCompletedDuringSession: false,
          sessionLoggedSets: [],
          sessionSuccess: false,
          notes: ex.notes || null
        })),
        notes: parsedResult.notes || originalPlan.notes || '',
        originalPlan: originalPlan,
        adaptations: Array.isArray(parsedResult.adaptations) ? parsedResult.adaptations : [],
        overallAdaptation: parsedResult.overallAdaptation || {
          intensity: 'maintained',
          duration: 'normal',
          focus: 'maintenance',
          reason: adaptedExerciseCount < originalExerciseCount 
            ? `План частково адаптовано (${adaptedExerciseCount}/${originalExerciseCount} вправ)`
            : 'План адаптовано'
        }
      };

      console.log('✅ [ADAPTIVE WORKOUT] Successfully created adaptive plan:', {
        finalExerciseCount: adaptivePlan.exercises.length,
        adaptationsCount: adaptivePlan.adaptations?.length || 0,
        overallAdaptation: adaptivePlan.overallAdaptation
      });

      return adaptivePlan;
    } catch (e) {
      console.error('❌ [ADAPTIVE WORKOUT] JSON parsing failed:', {
        error: e,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorType: typeof e,
        jsonStringLength: jsonStr.length,
        jsonStart: jsonStr.substring(0, 200),
        jsonEnd: jsonStr.length > 200 ? jsonStr.substring(jsonStr.length - 200) : 'N/A',
        fullJsonString: jsonStr.length < 1000 ? jsonStr : 'Too long to display'
      });
      console.error('🔍 [ADAPTIVE WORKOUT] Attempting to identify JSON issues...');
      
      // Пробуємо знайти проблему з JSON
      const issues = [];
      if (!jsonStr.trim()) issues.push('Empty response');
      if (!jsonStr.includes('{')) issues.push('No opening brace');
      if (!jsonStr.includes('}')) issues.push('No closing brace');
      if (jsonStr.includes('```')) issues.push('Contains markdown');
      if (jsonStr.includes('\n')) issues.push('Contains newlines');
      
      console.error('📝 [ADAPTIVE WORKOUT] Identified JSON issues:', issues);
      
      throw new Error("Не вдалося розібрати адаптивний план від AI");
    }
  } catch (error: any) {
    console.error('❌ [ADAPTIVE WORKOUT] Error generating adaptive workout:', error);
    if (
      (error.response && error.response.status === 503) ||
      (error.message && (
        error.message.toLowerCase().includes("overload") ||
        error.message.toLowerCase().includes("unavailable") ||
        error.message.toLowerCase().includes("service unavailable")
      ))
    ) {
      throw new Error(UI_TEXT.aiOverloaded);
    }
    throw new Error(`Помилка генерації адаптивного тренування: ${error.message || 'Невідома помилка'}`);
  }
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
      healthConstraints: userProfile.healthConstraints
    },
    wellnessCheck: {
      energyLevel: wellnessCheck.energyLevel,
      sleepQuality: wellnessCheck.sleepQuality,
      stressLevel: wellnessCheck.stressLevel,
      motivation: wellnessCheck.motivation,
      fatigue: wellnessCheck.fatigue,
      notes: wellnessCheck.notes?.substring(0, 50) + '...'
    },
    historyCount: workoutHistory.length
  });
  if (!ai) {
    console.error('❌ [WELLNESS] AI not initialized');
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  console.log('🤖 [WELLNESS] AI initialized successfully');

  const wellnessPrompt = `Ти — експерт з відновлення. Зроби короткі, практичні поради на основі даних користувача. Пиши максимально стисло і по суті. Обов'язково враховуй травми/обмеження, якщо вони є у профілі ("healthConstraints") та/або у нотатках сьогоднішнього самопочуття.

Поверни ВИКЛЮЧНО JSON-масив довжиною 1-3 елементи. Без жодного тексту поза JSON. Кожен елемент має бути дуже коротким:
{
  "type": "energy|recovery|motivation|stress",
  "title": "до 5 слів",
  "description": "1 коротке речення (до 18 слів)",
  "actions": ["до 3 дій, по 3-6 слів"],
  "priority": "high|medium|low"
}

Вхідні дані:
Профіль (з можливими обмеженнями здоров'я): ${JSON.stringify(userProfile, null, 0)}
Самопочуття: ${JSON.stringify(wellnessCheck, null, 0)}
Останні тренування (до 5): ${JSON.stringify(workoutHistory.slice(0, 5), null, 0)}

Вказівки:
- Формуй рекомендації тільки за потребою (напр. низька енергія, високий стрес).
- Уникай загальних порад. Конкретні дії, які можна зробити сьогодні.
- Уникай повторів та води.
- Кожен елемент має різний type.`;

  console.log('📝 [WELLNESS] Sending prompt to AI:', {
    promptLength: wellnessPrompt.length,
    userProfileKeys: Object.keys(userProfile),
    wellnessKeys: Object.keys(wellnessCheck)
  });

  try {
    const model = ai.getGenerativeModel({
      model: GEMINI_MODELS.LIGHT_TASKS,
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 256,
        responseMimeType: "application/json"
      }
    } as any);
    
    console.log('🚀 [WELLNESS] Making API call...');
    const response = await model.generateContent(wellnessPrompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    console.log('✅ [WELLNESS] Received response:', {
      responseLength: jsonStr.length,
      firstChars: jsonStr.substring(0, 100)
    });
    
    // Логування для діагностики
    console.log('🔍 [WELLNESS] Raw AI response:', jsonStr);
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
      console.log('🧹 [WELLNESS] Cleaned markdown from response');
    }
    
    // Додаткове очищення JSON
    jsonStr = jsonStr.replace(/\n\s*/g, ' ').trim();
    
    // Перевіряємо, чи JSON починається і закінчується правильно
    if (!jsonStr.startsWith('[') || !jsonStr.endsWith(']')) {
      console.warn('⚠️ [WELLNESS] JSON не має правильного формату масиву, спробуємо виправити');
      
      // Спробуємо знайти останню закриваючу дужку
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, lastBracket + 1);
      } else {
        // Якщо немає закриваючої дужки, додаємо її
        if (jsonStr.includes('[')) {
          jsonStr = jsonStr + ']';
        } else {
          throw new Error('Невалідний формат JSON від AI');
        }
      }
    }
    
    console.log('🔧 [WELLNESS] Cleaned JSON:', jsonStr);

    try {
      const recommendations: WellnessRecommendation[] = JSON.parse(jsonStr);
      
      console.log('🔍 [WELLNESS] Parsed recommendations:', {
        count: recommendations.length,
        types: recommendations.map(r => r.type)
      });
      
      // Валідуємо структуру кожної рекомендації
      const validRecommendations = recommendations.filter(rec => 
        rec && 
        typeof rec.type === 'string' && 
        typeof rec.title === 'string' && 
        typeof rec.description === 'string' &&
        Array.isArray(rec.actions) &&
        typeof rec.priority === 'string'
      );
      
      if (validRecommendations.length === 0) {
        console.warn('⚠️ [WELLNESS] Немає валідних рекомендацій, повертаємо порожній масив');
        return [];
      }
      
      console.log('✅ [WELLNESS] Successfully validated recommendations:', {
        validCount: validRecommendations.length,
        invalidCount: recommendations.length - validRecommendations.length
      });
      return validRecommendations;
    } catch (e) {
      console.error("❌ [WELLNESS] Error parsing recommendations:", e);
      console.error("🔍 [WELLNESS] Problematic JSON string:", jsonStr);
      
      // Якщо не вдалося парсити, повертаємо порожній масив замість помилки
      console.warn('🚫 [WELLNESS] Returning empty recommendations due to parsing error');
      return [];
    }
  } catch (error: any) {
    console.error("❌ [WELLNESS] Error generating wellness recommendations:", error);
    
    // Якщо це помилка парсингу JSON, повертаємо порожній масив замість викидання помилки
    if (error.message && error.message.includes('розібрати рекомендації')) {
      console.warn('🔄 [WELLNESS] Returning empty recommendations due to parsing issues');
      return [];
    }
    
    if (
      (error.response && error.response.status === 503) ||
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