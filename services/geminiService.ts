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

// REMOVED: createFallbackAdaptivePlan function
// The user specifically requested ONLY AI-generated plans
// No fallback to constructor-built plans allowed

/*
const createFallbackAdaptivePlan = (
  originalPlan: DailyWorkoutPlan,
  wellnessCheck: WellnessCheck
): AdaptiveWorkoutPlan => {
  console.log('🧠 [FALLBACK] Creating intelligent adaptive plan based on wellness:', {
    energyLevel: wellnessCheck.energyLevel,
    sleepQuality: wellnessCheck.sleepQuality,
    stressLevel: wellnessCheck.stressLevel,
    motivation: wellnessCheck.motivation,
    fatigue: wellnessCheck.fatigue
  });

  // Використовуємо нову інтелігентну систему аналізу самопочуття
  const wellnessAnalysis = analyzeWellnessState(wellnessCheck);
  console.log('📊 [FALLBACK] Wellness analysis result:', wellnessAnalysis);
  
  // Генеруємо персоналізовані адаптації для кожної вправи
  const adaptedExercises = originalPlan.exercises.map((exercise, index): Exercise => {
    const exerciseAdaptation = createExerciseAdaptation(exercise, wellnessAnalysis, index);
    
    return {
      ...exercise,
      id: uuidv4(),
      sets: exerciseAdaptation.sets,
      reps: exerciseAdaptation.reps,
      rest: exerciseAdaptation.rest,
      description: enhanceExerciseDescription(exercise.description, exerciseAdaptation),
      recommendation: {
        text: exerciseAdaptation.recommendation,
        action: exerciseAdaptation.action
      },
      isCompletedDuringSession: false,
      sessionLoggedSets: [],
      sessionSuccess: false,
      notes: exerciseAdaptation.notes
    };
  });
  
  // Створюємо детальний лог адаптацій
  const adaptations = originalPlan.exercises.map((exercise, index) => {
    const originalSets = String(exercise.sets);
    const adaptedSets = String(adaptedExercises[index].sets);
    const adaptation = getAdaptationForExercise(exercise, wellnessAnalysis);
    
    return {
      exerciseName: exercise.name,
      originalSets,
      originalReps: exercise.reps,
      adaptedSets,
      adaptedReps: adaptedExercises[index].reps,
      adaptationReason: adaptation.reason,
      energyLevel: wellnessCheck.energyLevel
    };
  });
  
  const overallAdaptation = createOverallAdaptation(wellnessAnalysis);
  
  return {
    day: originalPlan.day,
    exercises: adaptedExercises,
    notes: generatePersonalizedNotes(wellnessAnalysis),
    originalPlan: originalPlan,
    adaptations,
    overallAdaptation
  };
};
*/

// Comprehensive wellness state analysis
const analyzeWellnessState = (wellnessCheck: WellnessCheck) => {
  // Конвертуємо всі параметри в єдину 10-бальну шкалу для консистентності
  const energyScore = convertToTenScale(wellnessCheck.energyLevel, 'energy');
  const sleepScore = convertToTenScale(wellnessCheck.sleepQuality, 'sleep');
  const stressScore = convertToTenScale(wellnessCheck.stressLevel, 'stress');
  const motivationScore = wellnessCheck.motivation; // Вже 1-10
  const fatigueScore = 11 - wellnessCheck.fatigue; // Інвертуємо втому (10 = немає втоми)
  
  // Розрахунок композитного індексу самопочуття (0-100)
  // Енергія та сон найважливіші для фізичних вправ
  const overallScore = Math.round(
    (energyScore * 0.25 + sleepScore * 0.25 + stressScore * 0.2 + motivationScore * 0.15 + fatigueScore * 0.15) * 10
  );
  
  // Більш нюансована система адаптації як у справжнього тренера
  let adaptationLevel: 'recovery' | 'deload' | 'maintenance' | 'standard' | 'progression';
  if (overallScore >= 86) adaptationLevel = 'progression';
  else if (overallScore >= 71) adaptationLevel = 'standard';
  else if (overallScore >= 51) adaptationLevel = 'maintenance';
  else if (overallScore >= 31) adaptationLevel = 'deload';
  else adaptationLevel = 'recovery';
  
  // Детальний аналіз обмежуючих факторів
  const limitingFactors = [];
  const criticalFactors = [];
  
  if (energyScore <= 3) {
    criticalFactors.push('критично низька енергія');
  } else if (energyScore <= 5) {
    limitingFactors.push('низька енергія');
  }
  
  if (sleepScore <= 3) {
    criticalFactors.push('критично поганий сон');
  } else if (sleepScore <= 5) {
    limitingFactors.push('недостатній сон');
  }
  
  if (stressScore <= 3) {
    criticalFactors.push('дуже високий стрес');
  } else if (stressScore <= 5) {
    limitingFactors.push('підвищений стрес');
  }
  
  if (motivationScore <= 3) {
    criticalFactors.push('дуже низька мотивація');
  } else if (motivationScore <= 5) {
    limitingFactors.push('знижена мотивація');
  }
  
  if (wellnessCheck.fatigue >= 8) {
    criticalFactors.push('дуже висока втома');
  } else if (wellnessCheck.fatigue >= 6) {
    limitingFactors.push('помітна втома');
  }
  
  // Аналіз типу тренувального фокусу
  let trainingFocus: 'recovery' | 'activeRecovery' | 'maintenance' | 'performance' | 'progression';
  if (criticalFactors.length > 0) {
    trainingFocus = 'recovery';
  } else if (limitingFactors.length >= 2) {
    trainingFocus = 'activeRecovery';
  } else if (overallScore >= 80) {
    trainingFocus = 'progression';
  } else if (overallScore >= 65) {
    trainingFocus = 'performance';
  } else {
    trainingFocus = 'maintenance';
  }
  
  // Персоналізовані коефіцієнти адаптації
  const adaptationFactors = calculateAdaptationFactors(energyScore, sleepScore, stressScore, motivationScore, fatigueScore);
  
  return {
    overallScore,
    adaptationLevel,
    trainingFocus,
    limitingFactors: [...criticalFactors, ...limitingFactors],
    criticalFactors,
    energyScore,
    sleepScore,
    stressScore,
    motivationScore,
    fatigueScore,
    adaptationFactors,
    needsRecovery: overallScore < 40 || criticalFactors.length > 0,
    needsDeload: overallScore < 60 && criticalFactors.length === 0,
    canProgress: overallScore > 80 && criticalFactors.length === 0,
    primaryConcern: criticalFactors[0] || limitingFactors[0] || 'оптимальний стан',
    readinessLevel: overallScore >= 80 ? 'excellent' : overallScore >= 65 ? 'good' : overallScore >= 45 ? 'moderate' : 'poor'
  };
};

// Допоміжна функція для конвертації енумів в 10-бальну шкалу
const convertToTenScale = (value: any, type: 'energy' | 'sleep' | 'stress'): number => {
  if (type === 'energy') {
    const energyMap: Record<string, number> = {
      'VERY_LOW': 1,
      'LOW': 3,
      'NORMAL': 6,
      'HIGH': 8,
      'VERY_HIGH': 10
    };
    return energyMap[value] || 6;
  }
  
  if (type === 'sleep') {
    const sleepMap: Record<string, number> = {
      'POOR': 2,
      'FAIR': 5,
      'GOOD': 7,
      'EXCELLENT': 10
    };
    return sleepMap[value] || 7;
  }
  
  if (type === 'stress') {
    const stressMap: Record<string, number> = {
      'HIGH': 2,
      'MODERATE': 6,
      'LOW': 9
    };
    return stressMap[value] || 6;
  }
  
  return 5;
};

// Розрахунок персоналізованих коефіцієнтів адаптації
const calculateAdaptationFactors = (energy: number, sleep: number, stress: number, motivation: number, fatigue: number) => {
  return {
    // Коефіцієнти для різних аспектів тренування
    intensityFactor: Math.min(1.5, Math.max(0.4, (energy * 0.4 + sleep * 0.3 + (11 - fatigue) * 0.3) / 10)),
    volumeFactor: Math.min(1.3, Math.max(0.5, (energy * 0.3 + motivation * 0.4 + (11 - fatigue) * 0.3) / 10)),
    restFactor: Math.min(2.0, Math.max(0.7, 1 + ((10 - sleep) * 0.3 + fatigue * 0.4 + (10 - stress) * 0.3) / 30)),
    complexityFactor: Math.min(1.2, Math.max(0.6, (energy * 0.35 + stress * 0.35 + motivation * 0.3) / 10)),
    recoveryNeed: Math.max(0, (fatigue + (10 - sleep) + (10 - energy)) / 3 - 5) / 5 // 0-1 scale
  };
};

// Create personalized exercise adaptation
const createExerciseAdaptation = (exercise: any, analysis: any, exerciseIndex: number) => {
  const exerciseType = getExerciseType(exercise.name.toLowerCase());
  const originalSets = parseInt(String(exercise.sets)) || 3;
  const originalRepsStr = String(exercise.reps);
  const originalRestStr = String(exercise.rest);
  
  // Витягуємо числові значення з рядків
  const originalRepsNum = extractNumberFromString(originalRepsStr);
  const originalRestSeconds = extractTimeFromString(originalRestStr);
  
  // Застосовуємо персоналізовані коефіцієнти адаптації
  const { intensityFactor, volumeFactor, restFactor, complexityFactor, recoveryNeed } = analysis.adaptationFactors;
  
  // Розрахунок нових параметрів з урахуванням типу вправи
  let adaptedSets: number;
  let adaptedReps: string;
  let adaptedRestSeconds: number;
  let recommendation: string;
  let action: string;
  let notes: string;
  
  // Адаптація підходів
  if (exerciseType.category === 'compound') {
    // Базові вправи - більш консервативна адаптація
    adaptedSets = Math.max(1, Math.round(originalSets * (0.7 + volumeFactor * 0.3)));
  } else {
    // Ізоляційні вправи - більш агресивна адаптація
    adaptedSets = Math.max(1, Math.round(originalSets * volumeFactor));
  }
  
  // Адаптація повторень з урахуванням типу тренування
  adaptedReps = adaptRepsForExercise(originalRepsStr, originalRepsNum, intensityFactor, exerciseType, analysis);
  
  // Адаптація відпочинку
  adaptedRestSeconds = Math.round(originalRestSeconds * restFactor);
  const adaptedRestStr = formatRestTime(adaptedRestSeconds);
  
  // Генерація персоналізованих рекомендацій
  const adaptationData = generatePersonalizedRecommendation(
    exercise, 
    analysis, 
    exerciseIndex,
    { originalSets, adaptedSets, originalRepsNum, adaptedReps, originalRestSeconds, adaptedRestSeconds },
    exerciseType
  );
  
  recommendation = adaptationData.recommendation;
  action = adaptationData.action;
  notes = adaptationData.notes;
  
  return {
    sets: adaptedSets.toString(),
    reps: adaptedReps,
    rest: adaptedRestStr,
    recommendation,
    action,
    notes
  };
};

// Функція для визначення типу вправи та її характеристик
const getExerciseType = (exerciseName: string) => {
  const compound = ['присідання', 'станова', 'жим', 'підтягування', 'віджимання', 'тяга', 'випади'];
  const isolation = ['розведення', 'згинання', 'розгинання', 'підйом', 'скручування'];
  const cardio = ['біг', 'стрибки', 'планка', 'берпі', 'велосипед'];
  
  const isCompound = compound.some(word => exerciseName.includes(word));
  const isIsolation = isolation.some(word => exerciseName.includes(word));
  const isCardio = cardio.some(word => exerciseName.includes(word));
  
  let category: 'compound' | 'isolation' | 'cardio' | 'functional';
  if (isCompound) category = 'compound';
  else if (isIsolation) category = 'isolation';
  else if (isCardio) category = 'cardio';
  else category = 'functional';
  
  return {
    category,
    intensity: isCompound ? 'high' : isCardio ? 'medium' : 'low',
    recovery: isCompound ? 'high' : isCardio ? 'medium' : 'low'
  };
};

// Витягнення чисел з рядка повторень
const extractNumberFromString = (str: string): number => {
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : 10;
};

// Витягнення часу з рядка відпочинку (в секундах)
const extractTimeFromString = (str: string): number => {
  const minutesMatch = str.match(/(\d+)\s*хв/);
  const secondsMatch = str.match(/(\d+)\s*сек/);
  
  let totalSeconds = 0;
  if (minutesMatch) totalSeconds += parseInt(minutesMatch[1]) * 60;
  if (secondsMatch) totalSeconds += parseInt(secondsMatch[1]);
  
  return totalSeconds || 60; // За замовчуванням 60 секунд
};

// Адаптація повторень для конкретної вправи
const adaptRepsForExercise = (originalStr: string, originalNum: number, intensityFactor: number, exerciseType: any, analysis: any): string => {
  if (exerciseType.category === 'cardio') {
    // Для кардіо адаптуємо час, а не кількість
    if (originalStr.includes('сек') || originalStr.includes('хв')) {
      const timeMatch = originalStr.match(/(\d+)\s*(сек|хв)/);
      if (timeMatch) {
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[2];
        const adaptedValue = Math.round(value * intensityFactor);
        return `${adaptedValue} ${unit}`;
      }
    }
  }
  
  // Для силових вправ
  if (originalStr.includes('-')) {
    // Діапазон повторень (наприклад, "8-12")
    const [min, max] = originalStr.split('-').map(n => parseInt(n.trim()));
    const adaptedMin = Math.max(1, Math.round(min * intensityFactor));
    const adaptedMax = Math.max(adaptedMin + 1, Math.round(max * intensityFactor));
    return `${adaptedMin}-${adaptedMax}`;
  } else {
    // Фіксована кількість повторень
    const adaptedReps = Math.max(1, Math.round(originalNum * intensityFactor));
    return adaptedReps.toString();
  }
};

// Форматування часу відпочинку
const formatRestTime = (seconds: number): string => {
  if (seconds >= 120) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} хв`;
  } else {
    return `${seconds} сек`;
  }
};

// Генерація персоналізованих рекомендацій як від справжнього тренера
const generatePersonalizedRecommendation = (
  exercise: any, 
  analysis: any, 
  exerciseIndex: number,
  adaptationDetails: any,
  exerciseType: any
) => {
  const { energyScore, sleepScore, stressScore, motivationScore, fatigueScore, primaryConcern, adaptationLevel } = analysis;
  const { originalSets, adaptedSets, originalRepsNum, adaptedReps, originalRestSeconds, adaptedRestSeconds } = adaptationDetails;
  
  let recommendation = '';
  let action = '';
  let notes = '';
  
  // Simplified personalized recommendation generation
  if (adaptationLevel === 'recovery') {
    action = 'recovery_focus';
    recommendation = generateSimpleRecommendation(analysis, exercise.name, adaptationDetails);
    notes = getSimpleNotes(analysis, exerciseType);
  } else if (adaptationLevel === 'deload') {
    action = 'reduced_intensity';
    recommendation = generateSimpleRecommendation(analysis, exercise.name, adaptationDetails);
    notes = getSimpleNotes(analysis, exerciseType);
  } else if (adaptationLevel === 'progression') {
    action = 'progression';
    recommendation = generateSimpleRecommendation(analysis, exercise.name, adaptationDetails);
    notes = getSimpleNotes(analysis, exerciseType);
  } else {
    action = 'maintained';
    recommendation = generateSimpleRecommendation(analysis, exercise.name, adaptationDetails);
    notes = getSimpleNotes(analysis, exerciseType);
  }
  
  return { recommendation, action, notes };
};

// REMOVED: Detailed recommendation generation functions
// These were repetitive and could be simplified
// generateRecoveryRecommendation, generateDeloadRecommendation, 
// generateProgressionRecommendation, generateMaintenanceRecommendation
// getRecoverySpecificNotes, getDeloadSpecificNotes, etc.

// Simple recommendation generation function
const generateSimpleRecommendation = (analysis: any, exerciseName: string, details: any): string => {
  const { adaptationLevel, overallScore } = analysis;
  
  switch (adaptationLevel) {
    case 'recovery':
      return `Відновлення: ${details.adaptedSets} підходи замість ${details.originalSets}. Слухайте тіло.`;
    case 'deload':
      return `Полегшено до ${details.adaptedSets} підходів. Фокус на техніці.`;
    case 'progression':
      return `Відмінне самопочуття! Збільшено до ${details.adaptedSets} підходів.`;
    default:
      return `Стандартне навантаження: ${details.adaptedSets} підходи як заплановано.`;
  }
};

const getSimpleNotes = (analysis: any, exerciseType: any): string => {
  if (analysis.needsRecovery) return 'Фокус на відновленні';
  if (analysis.canProgress) return 'Можна трохи збільшити навантаження';
  return 'Дотримуємось плану';
};

// REMOVED: Unused helper functions
// getEnergyScore, getSleepScore, getStressScore, getExerciseIntensity, getRecoveryNotes
// These were redundant with existing scoring functions

const getAdaptationForExercise = (exercise: any, analysis: any) => {
  return {
    reason: `Адаптовано під ${analysis.adaptationLevel} режим через ${analysis.primaryConcern}`
  };
};

const createOverallAdaptation = (analysis: any) => {
  const intensityMap: Record<string, string> = {
    'recovery': 'significantly_reduced',
    'deload': 'reduced', 
    'maintenance': 'maintained',
    'progression': 'increased'
  };
  
  const durationMap: Record<string, string> = {
    'recovery': 'shorter',
    'deload': 'slightly_shorter',
    'maintenance': 'normal',
    'progression': 'normal'
  };
  
  const focusMap: Record<string, string> = {
    'recovery': 'recovery',
    'deload': 'maintenance', 
    'maintenance': 'maintenance',
    'progression': 'performance'
  };
  
  return {
    intensity: (intensityMap[analysis.adaptationLevel] || 'maintained') as 'maintained' | 'reduced' | 'increased',
    duration: (durationMap[analysis.adaptationLevel] || 'normal') as 'normal' | 'shorter' | 'longer',
    focus: (focusMap[analysis.adaptationLevel] || 'maintenance') as 'maintenance' | 'recovery' | 'performance',
    reason: generateDetailedReason(analysis)
  };
};

const generatePersonalizedNotes = (analysis: any): string => {
  let notes = `Тренування адаптовано під ваш поточний стан (оцінка: ${analysis.overallScore}/100). `;
  
  if (analysis.needsRecovery) {
    notes += 'Сьогодні ваше тіло потребує відновлення. Не перенавантажуйтесь.';
  } else if (analysis.canProgress) {
    notes += 'Відмінне самопочуття дозволяє трохи прогресувати!';
  } else {
    notes += 'Підтримуємо поточний рівень з урахуванням самопочуття.';
  }
  
  if (analysis.limitingFactors.length > 0) {
    notes += ` Основні фактори: ${analysis.limitingFactors.join(', ')}.`;
  }
  
  return notes;
};

// Функція для побудови розумного контексту для AI
const buildSmartContext = (
  userProfile: UserProfile,
  workoutHistory: WorkoutLog[],
  wellnessCheck: WellnessCheck,
  originalPlan: DailyWorkoutPlan
) => {
  const recentWorkouts = workoutHistory.slice(-3); // Останні 3 тренування
  const hasHistory = recentWorkouts.length > 0;
  
  let contextInfo = '';
  
  if (hasHistory) {
    // Аналізуємо останні тренування для виявлення патернів
    const lastWorkout = recentWorkouts[recentWorkouts.length - 1];
    const averageDuration = recentWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / recentWorkouts.length;
    
    // Правильно обробляємо дату з Firestore
    const lastWorkoutDate = lastWorkout.date instanceof Date 
      ? lastWorkout.date 
      : new Date((lastWorkout.date as any).seconds * 1000);
    const daysSinceLastWorkout = Math.round((Date.now() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Виявляємо проблемні вправи
    const problemExercises: string[] = [];
    const planExerciseNames = originalPlan.exercises.map(ex => ex.name.toLowerCase());
    
    recentWorkouts.forEach(workout => {
      const exercises = (workout as any).exercises || (workout as any).loggedExercises;
      if (exercises) {
        exercises.forEach((exercise: any) => {
          const isInCurrentPlan = planExerciseNames.some(name => 
            exercise.name?.toLowerCase().includes(name.split(' ')[0]) || 
            name.includes(exercise.name?.toLowerCase().split(' ')[0])
          );
          
          if (isInCurrentPlan && exercise.notes && 
              (exercise.notes.toLowerCase().includes('важко') || 
               exercise.notes.toLowerCase().includes('болить') ||
               exercise.notes.toLowerCase().includes('втома'))) {
            problemExercises.push(exercise.name);
          }
        });
      }
    });
    
    contextInfo = `
📈 КОНТЕКСТ КЛІЄНТА:
- Останнє тренування: ${daysSinceLastWorkout} днів тому
- Середня тривалість: ${Math.round(averageDuration)} хвилин
- Ціль: ${userProfile.goal}
- Досвід: ${userProfile.experienceLevel}${problemExercises.length > 0 ? `\n- Обережно з: ${problemExercises.slice(0, 2).join(', ')}` : ''}`;
  } else {
    contextInfo = `
📈 НОВИЙ КОРИСТУВАЧ:
- Перші тренування - особлива увага до техніки
- Консервативний підхід до навантажень
- Ціль: ${userProfile.goal}
- Досвід: ${userProfile.experienceLevel}`;
  }
  
  return contextInfo;
};

export const generateDetailedReason = (analysis: any): string => {
  const reasonParts = [];
  
  if (analysis.energyScore <= 4) reasonParts.push('низький рівень енергії');
  if (analysis.sleepScore <= 4) reasonParts.push('недостатня якість сну');
  if (analysis.stressScore <= 4) reasonParts.push('підвищений стрес');
  if (analysis.motivationScore <= 4) reasonParts.push('знижена мотивація');
  if (analysis.fatigueScore <= 4) reasonParts.push('висока втома');
  
  if (reasonParts.length === 0) {
    return 'Відмінне самопочуття дозволяє повноцінне тренування';
  }
  
  return `Адаптація через: ${reasonParts.join(', ')}. Оцінка стану: ${analysis.overallScore}/100`;
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

  // Отримуємо детальний аналіз самопочуття для розумного AI промпту
  const wellnessAnalysis = analyzeWellnessState(wellnessCheck);
  const energyNum = convertToTenScale(wellnessCheck.energyLevel, 'energy');
  const sleepNum = convertToTenScale(wellnessCheck.sleepQuality, 'sleep');
  const stressNum = convertToTenScale(wellnessCheck.stressLevel, 'stress');
  
  // Додаємо розумний контекст користувача
  const smartContext = buildSmartContext(userProfile, workoutHistory, wellnessCheck, originalPlan);

  const adaptivePrompt = `Ти - досвідчений фітнес-тренер з 10-річним досвідом. Адаптуй план тренування як справжній тренер.

ПОКАЗНИКИ САМОПОЧУТТЯ (ВСІ ЦІ ПОКАЗНИКИ МАЮТЬ ВПЛИВАТИ НА ТВОЇ РІШЕННЯ!):
- Енергія: ${energyNum}/10 (${wellnessCheck.energyLevel})
- Сон: ${sleepNum}/10 (${wellnessCheck.sleepQuality})
- Стрес: ${stressNum}/10 (${wellnessCheck.stressLevel})
- Мотивація: ${wellnessCheck.motivation}/10
- Больові відчуття (втома): ${wellnessCheck.fatigue}/10${wellnessCheck.notes ? `\n- Нотатки: "${wellnessCheck.notes}"` : ''}${smartContext}

ОРИГІНАЛЬНИЙ ПЛАН:
${JSON.stringify(originalPlan.exercises.map(ex => ({
  name: ex.name,
  sets: ex.sets,
  reps: ex.reps,
  rest: ex.rest
})), null, 2)}

ІНТЕЛІГЕНТНІ ПРАВИЛА АДАПТАЦІЇ:

1. КОЛИ ЕНЕРГІЯ НИЖКА (1-4): зменшити підходи на 30-50%, повторення на 20-40%, збільшити відпочинок на 50-100%
2. КОЛИ СОН ПОГАНИЙ (1-4): зменшити підходи на 25%, збільшити відпочинок на 30-60 секунд
3. КОЛИ СТРЕС ВИСОКИЙ (1-4): зменшити інтенсивність, збільшити відпочинок, фокус на техніці
4. КОЛИ МОТИВАЦІЯ НИЖКА (1-4): зменшити час тренування, зменшити підходи, менше відпочинку
5. КОЛИ ВТОМА ВИСОКА (8-10): значно зменшити навантаження, більше відпочинку
6. КОЛИ ВСІ ПОКАЗНИКИ ВИСОКІ (8-10): можна збільшити підходи, додати повторення, зменшити відпочинок

ПРИКЛАДИ РЕАЛЬНИХ АДАПТАЦІЙ:
Приклад 1 (енергія 3/10, сон 3/10): 3 підходи х 12 повторень → 2 підходи х 8 повторень
Приклад 2 (мотивація 2/10): 4 підходи → 3 підходи (швидше тренування)
Приклад 3 (все високо): 3 підходи х 10 → 4 підходи х 12

ВІДПОВІДАЙ ТІЛЬКИ валідним JSON у слідуючому форматі:
{
  "day": ${originalPlan.day},
  "exercises": [
    {
      "id": "auto-generated",
      "name": "Назва вправи",
      "description": "Техніка виконання",
      "sets": число_підходів,
      "reps": "число_повторень_або_час",
      "rest": "час_відпочинку",
      "videoSearchQuery": "пошукова фраза",
      "weightType": "total",
      "targetWeight": null,
      "targetReps": null,
      "recommendation": {
        "text": "Конкретна порада з цифрами самопочуття. Пояснюй КОНКРЕТНО чому саме стільки підходів/повторень. 2-3 речення",
        "action": "maintained|reduced_intensity|increased_intensity|recovery_focus|progression"
      },
      "isCompletedDuringSession": false,
      "sessionLoggedSets": [],
      "sessionSuccess": false,
      "notes": "Конкретна порада під поточний стан"
    }
  ],
  "notes": "Персональне пояснення від тренера чому план адаптовано саме так (3-4 речення)",
  "originalPlan": ${JSON.stringify(originalPlan)},
  "adaptations": [
    {
      "exerciseName": "назва",
      "originalSets": "було",
      "originalReps": "було",
      "adaptedSets": "стало",
      "adaptedReps": "стало",
      "adaptationReason": "Персональне пояснення ЧОМУ змінено з конкретними цифрами",
      "energyLevel": "${wellnessCheck.energyLevel}"
    }
  ],
  "overallAdaptation": {
    "intensity": "maintained|reduced|increased",
    "duration": "normal|shorter|longer",
    "focus": "maintenance|recovery|performance",
    "reason": "Комплексне пояснення адаптації з урахуванням ВСІХ параметрів самопочуття"
  }
`;;

  console.log('📝 [ADAPTIVE WORKOUT] Enhanced AI prompt prepared:', {
    promptLength: adaptivePrompt.length,
    model: selectedModel,
    wellnessScore: 
      (convertToTenScale(wellnessCheck.energyLevel, 'energy') * 0.25 + 
       convertToTenScale(wellnessCheck.sleepQuality, 'sleep') * 0.25 + 
       convertToTenScale(wellnessCheck.stressLevel, 'stress') * 0.2 + 
       wellnessCheck.motivation * 0.15 + 
       (11 - wellnessCheck.fatigue) * 0.15) * 10
  });

  try {
    // Оптимізовані налаштування для швидшої обробки (тільки AI-генерація)
    const model = ai.getGenerativeModel({
      model: selectedModel, // Динамічний вибір моделі
      generationConfig: {
        temperature: 0.2, // Менша температура для більш консистентних результатів
        topK: 20, // Менше значення для більш предиктабельності
        topP: 0.8,
        maxOutputTokens: isComplexPlan ? 3000 : 2500, // Більше токенів для складних планів та надійності
        responseMimeType: "application/json"
      }
    } as any);
    
    console.log('🚀 [ADAPTIVE WORKOUT] Making API call (AI-only mode)...');
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

    // Clean and attempt to fix JSON response
    jsonStr = jsonStr.trim();
    
    // Remove common AI response prefixes/suffixes
    jsonStr = jsonStr.replace(/^.*?```json\s*/i, '').replace(/```.*$/i, '');
    jsonStr = jsonStr.replace(/^.*?{/, '{').replace(/}[^}]*$/, '}');
    
    // Remove trailing commas and fix common JSON issues
    jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    
    try {
      const parsedResult: any = JSON.parse(jsonStr);
      
      // Validate structure and create fallback if needed
      if (!parsedResult || !parsedResult.exercises || !Array.isArray(parsedResult.exercises)) {
        throw new Error('Invalid structure');
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
          recommendation: ex.recommendation || null,
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

      return adaptivePlan;
    } catch (parseError) {
      // JSON parsing failed - throw error to force AI retry
      console.error('❌ [ADAPTIVE WORKOUT] JSON parsing failed, rejecting fallback plan');
      console.error('🔍 [ADAPTIVE WORKOUT] Parse error details:', parseError);
      
      throw new Error('Не вдалося розпізнати відповідь AI. Спробуйте ще раз через кілька секунд для отримання адаптивного плану.');
    }
  } catch (error: any) {
    console.error('❌ [ADAPTIVE WORKOUT] Error generating adaptive workout:', error);
    console.error('🔍 [ADAPTIVE WORKOUT] Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorType: typeof error,
      isQuotaError: error.message?.includes('429') || error.message?.includes('quota'),
      isRateLimitError: error.message?.includes('rate limit') || error.message?.includes('exceeded')
    });
    
    // Only for quota errors, throw error to trigger user choice
    if (
      (error.response && error.response.status === 429) ||
      (error.message && (
        error.message.toLowerCase().includes("quota") ||
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("exceeded") ||
        error.message.toLowerCase().includes("429")
      ))
    ) {
      console.warn('⚠️ [ADAPTIVE WORKOUT] Quota exceeded, letting user choose');
      throw new Error('Перевищено ліміт запитів до AI. Спробуйте через 1-2 хвилини або пропустіть перевірку самопочуття для швидкого старту.');
    }
    
    // For other errors (network, parsing, etc.), throw error to force AI-only approach
    console.error('⚠️ [ADAPTIVE WORKOUT] API/parsing error, rejecting fallback plan');
    throw new Error('Не вдалося згенерувати адаптивний план через AI. Спробуйте ще раз через кілька секунд.');
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