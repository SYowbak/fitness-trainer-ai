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
  GEMINI_MODEL_TEXT 
} from '../constants';
import { withQuotaManagement, shouldEnableAIFeature, quotaManager } from '../utils/apiQuotaManager';

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
1.  **Структура:** Розбий план тоно на ${trainingFrequency} тренувальних дні(в), ні більше ні менше. Кожен день повинен мати чітку мету і, якщо вказано, фокусуватися на цільовій групі м'язів, забезпечуючи при цьому достатній час для відновлення цієї групи.
2.  **Розминка та Заминка:** Для кожного тренувального дня надай конкретні рекомендації щодо розминки (5-10 хвилин, наприклад, легке кардіо, динамічна розтяжка основних робочих груп) та заминки (5-10 хвилин, наприклад, статична розтяжка пропрацьованих м'язів).
3.  **Вправи:**
    *   **Підбір:** Ретельно підбери вправи, що відповідають статі, типу статури, цілі та бажаному акценту користувача. Включи оптимальне поєднання базових та ізолюючих вправ.
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


export const generateWorkoutPlan = async (profile: UserProfile, modelName: string = GEMINI_MODEL_TEXT): Promise<DailyWorkoutPlan[]> => {
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  const prompt = constructPlanPrompt(profile);
  
  return withQuotaManagement(async () => {
    const model = ai!.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(prompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
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
              sessionSuccess: false
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
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  const modelName = "gemini-1.5-flash"; // Використовуємо gemini-1.5-flash для аналізу

  // Аналізуємо історію тренувань для виявлення патернів
  const workoutHistory = lastWorkoutLog ? [lastWorkoutLog, ...previousWorkoutLogs] : previousWorkoutLogs;
  const recentWorkouts = workoutHistory.slice(0, 5); // Останні 5 тренувань
  
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

  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(analysisPrompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    try {
      const parsedResult: any = JSON.parse(jsonStr); 
      
      // Перевіряємо базову структуру відповіді від аналізу
      if (!parsedResult || !parsedResult.updatedPlan || !parsedResult.recommendation) {
         console.error("Неправильна базова структура відповіді від AI аналізу:", parsedResult);
        throw new Error("Неправильна базова структура відповіді від AI аналізу");
      }

      const updatedPlan = parsedResult.updatedPlan;
      const generalRecommendation = parsedResult.recommendation;
      const dailyRecommendations = parsedResult.dailyRecommendations || [];

      // Перевіряємо структуру оновленого плану (аналогічно generateWorkoutPlan)
      if (typeof updatedPlan.day !== 'number' || !Array.isArray(updatedPlan.exercises)) {
         console.error("Неправильна структура updatedPlan у відповіді від AI аналізу:", updatedPlan);
        throw new Error("Неправильна структура updatedPlan у відповіді від AI аналізу");
      }

       // Мапуємо дані з відповіді AI до типу DailyWorkoutPlan, включаючи нові поля
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
               weightType: ex.weightType || 'total', // Додано обробку нового поля
               videoSearchQuery: ex.videoSearchQuery || null,
               targetWeight: ex.targetWeight !== undefined && ex.targetWeight !== null ? ex.targetWeight : null,
               targetReps: ex.targetReps !== undefined && ex.targetReps !== null ? ex.targetReps : null,
               recommendation: ex.recommendation || { text: '', action: '' },
               isCompletedDuringSession: false,
               sessionLoggedSets: [],
               sessionSuccess: false
           }))
       };

      return {
        updatedPlan: mappedUpdatedPlan,
        recommendation: generalRecommendation,
        dailyRecommendations: dailyRecommendations
      };
    } catch (e) {
      console.error("Error parsing JSON from AI analysis response:", e);
      console.error("Received string (after processing):", jsonStr);
      console.error("Original AI response text:", result.text());
      throw new Error("Не вдалося розібрати результат аналізу від AI. Можливо, формат відповіді змінився, або сталася помилка на стороні AI.");
    }

  } catch (error: any) {
    console.error("Error during workout analysis via Gemini API:", error);
     if (error.message && (error.message.includes("API_KEY_INVALID") || (error.response && error.response.status === 400))) {
         throw new Error("Наданий API ключ недійсний або не має дозволів для використання аналізу. Будь ласка, перевірте ваш API ключ.");
    }
    if (error.message && error.message.toLowerCase().includes("candidate.safetyetyratings")) {
        throw new Error("Відповідь від AI була заблокована через налаштування безпеки при аналізі. Спробуйте змінити дані або запит.");
    }
     if (error.message && error.message.toLowerCase().includes("fetch")) { 
        throw new Error("Помилка мережі при зверненні до AI сервісу аналізу. Перевірте ваше інтернет-з'єднання та спробуйте пізніше.");
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
    throw new Error(`Помилка аналізу тренування: ${error.message || 'Невідома помилка сервісу AI'}`);
  }
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

  const modelName = "gemini-1.5-flash";

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
      notes: `Варіація: ${variation.variationType || 'alternative'} | Складність: ${variation.difficulty || 'intermediate'}`
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
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  const modelName = "gemini-1.5-flash"; // Використовуємо gemini-1.5-flash для адаптивного тренування

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

  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(adaptivePrompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    try {
      const parsedResult: any = JSON.parse(jsonStr);
      
      // Перевіряємо структуру
      if (!parsedResult || !parsedResult.exercises || !Array.isArray(parsedResult.exercises)) {
        throw new Error("Неправильна структура адаптивного плану");
      }

      const adaptivePlan: AdaptiveWorkoutPlan = {
        day: parsedResult.day || originalPlan.day,
        exercises: parsedResult.exercises.map((ex: any): Exercise => ({
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
          sessionSuccess: false
        })),
        notes: parsedResult.notes || originalPlan.notes || '',
        originalPlan: originalPlan,
        adaptations: Array.isArray(parsedResult.adaptations) ? parsedResult.adaptations : [],
        overallAdaptation: parsedResult.overallAdaptation || {
          intensity: 'maintained',
          duration: 'normal',
          focus: 'maintenance',
          reason: 'План адаптовано'
        }
      };

      return adaptivePlan;
    } catch (e) {
      console.error("Error parsing adaptive workout:", e);
      throw new Error("Не вдалося розібрати адаптивний план від AI");
    }
  } catch (error: any) {
    console.error("Error generating adaptive workout:", error);
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
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

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

  try {
    const model = ai.getGenerativeModel({
      model: GEMINI_MODEL_TEXT,
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 256,
        responseMimeType: "application/json"
      }
    } as any);
    const response = await model.generateContent(wellnessPrompt);
    const result = await response.response;
    let jsonStr = result.text().trim();
    
    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    try {
      const recommendations: WellnessRecommendation[] = JSON.parse(jsonStr);
      return recommendations;
    } catch (e) {
      console.error("Error parsing wellness recommendations:", e);
      throw new Error("Не вдалося розібрати рекомендації по самопочуттю");
    }
  } catch (error: any) {
    console.error("Error generating wellness recommendations:", error);
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
    throw new Error(`Помилка генерації рекомендацій: ${error.message || 'Невідома помилка'}`);
  }
};