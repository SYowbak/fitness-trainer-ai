import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UserProfile, DailyWorkoutPlan, WorkoutLog, ExerciseProgressRecommendation } from '../types';
import { 
  getUkrainianGoal, 
  getUkrainianBodyType, 
  getUkrainianGender, 
  getUkrainianMuscleGroup, 
  getUkrainianExperienceLevel,
  UI_TEXT, 
  GEMINI_MODEL_TEXT 
} from '../constants';

export const getApiKey = (): string | null => {
  return import.meta.env.VITE_API_KEY || null;
};

let ai: GoogleGenAI | null = null;
const apiKey = getApiKey();
if (apiKey) {
  try {
      ai = new GoogleGenAI({ apiKey: apiKey });
  } catch (e) {
      console.error("Failed to initialize GoogleGenAI instance:", e);
      ai = null; 
  }
}


const constructPrompt = (profile: UserProfile): string => {
  const { gender, bodyType, goal, trainingFrequency, name, targetMuscleGroups, height, weight, age, experienceLevel } = profile;
  
  const userNamePart = name ? `для користувача на ім'я ${name}` : '';
  const genderText = getUkrainianGender(gender);
  const bodyTypeText = getUkrainianBodyType(bodyType);
  const goalText = getUkrainianGoal(goal);
  const experienceLevelText = getUkrainianExperienceLevel(experienceLevel);
  const targetMuscleGroupsText = targetMuscleGroups.length > 0 
    ? `з особливим акцентом на ${targetMuscleGroups.map(group => getUkrainianMuscleGroup(group)).join(', ')}`
    : 'із загальним розвитком всіх груп м\'язів';

  return `Ти — висококваліфікований персональний фітнес-тренер, який створює індивідуальні програми тренувань. Твоя мета — розробити максимально ефективний, безпечний та логічний план тренувань у тренажерному залі ${userNamePart}.

**Дій як справжній персональний тренер:**
*   **Індивідуалізація:** План має бути глибоко персоналізованим, враховуючи всі надані дані.
*   **Безпека та техніка:** Завжди наголошуй на важливості правильної техніки та безпеки.
*   **Реалістичність:** Не ускладнюй тренування без потреби, особливо якщо ціль — загальна фізична форма або користувач може бути новачком.
*   **Мотивація:** Твої описи мають бути чіткими та мотивуючими.

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
    *   **Опис Техніки:** Надай ДУЖЕ ДЕТАЛЬНИЙ, покроковий опис правильної техніки виконання кожної вправи. Включи:
        *   Початкове положення.
        *   Ключові моменти руху.
        *   Правильне дихання.
        *   Типові помилки та як їх уникнути.
        *   Поради для максимальної ефективності.
    *   **Кількість підходів:** Вкажи кількість робочих підходів (наприклад, "3-4" або число 4 , вказуєш скільки насправді потрібно зробити підходів залежно від цілі користувача). Не включай розминочні підходи сюди.
    *   **Кількість повторень:** Вкажи діапазон повторень, оптимальний для цілі (наприклад, "8-12" для гіпертрофії, "12-15" для витривалості).
    *   **Відпочинок:** Вкажи рекомендований час відпочинку між підходами в секундах (наприклад, "60-90 секунд").
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

  const prompt = constructPrompt(profile);
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
        },
    });

    let jsonStr = (response.text ?? '').trim();
    
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
              name: ex.name || "Невідома вправа",
              description: ex.description || "Опис відсутній.",
              sets: ex.sets || "3",
              reps: ex.reps || "10-12",
              rest: ex.rest || "60 секунд",
              imageSuggestion: null,
              videoSearchQuery: ex.videoSearchQuery || null,
              targetWeight: null,
              targetReps: null,
              isCompletedDuringSession: false,
              sessionLoggedSets: [],
              sessionSuccess: undefined
            };
          })
        };
      });
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      console.error("Received string (after processing):", jsonStr);
      console.error("Original AI response text:", response.text);
      throw new Error("Не вдалося розібрати план тренувань від AI. Можливо, формат відповіді змінився, або сталася помилка на стороні AI.");
    }

  } catch (error: any) {
    console.error("Error during workout plan generation via Gemini API:", error);
    if (error.message && (error.message.includes("API_KEY_INVALID") || (error.response && error.response.status === 400))) {
         throw new Error("Наданий API ключ недійсний або не має дозволів. Будь ласка, перевірте ваш API ключ.");
    }
    if (error.message && error.message.toLowerCase().includes("candidate.safetyratings")) {
        throw new Error("Відповідь від AI була заблокована через налаштування безпеки. Спробуйте змінити запит.");
    }
    if (error.message && error.message.toLowerCase().includes("fetch")) { 
        throw new Error("Помилка мережі при зверненні до AI сервісу. Перевірте ваше інтернет-з'єднання та спробуйте пізніше.");
    }
    throw new Error(`Помилка генерації плану: ${error.message || 'Невідома помилка сервісу AI'}`);
  }
};

// Нова функція для аналізу прогресу тренувань за допомогою ШІ
export const analyzeProgress = async (userProfile: UserProfile, workoutLogs: WorkoutLog[], modelName: string = GEMINI_MODEL_TEXT): Promise<ExerciseProgressRecommendation[]> => {
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  // Формуємо детальний запит для ШІ
  const prompt = constructProgressAnalysisPrompt(userProfile, workoutLogs);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
        },
    });

    let jsonStr = (response.text ?? '').trim();

    // Видаляємо можливі markdown-розмітки
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    try {
      const parsedRecommendations: any[] = JSON.parse(jsonStr);

      // Перевіряємо базову структуру (масив об'єктів)
      if (!Array.isArray(parsedRecommendations)) {
        throw new Error("AI повернув не масив рекомендацій");
      }

      // Перевіряємо структуру кожного об'єкта та приводимо до потрібного типу
      return parsedRecommendations.map((rec, index): ExerciseProgressRecommendation => {
        if (typeof rec.exerciseName !== 'string' || 
            typeof rec.recommendedWeight !== 'number' || 
            typeof rec.recommendedReps !== 'string' || 
            typeof rec.recommendedSets !== 'string' ||
            typeof rec.recommendationReason !== 'string')
         {
          throw new Error(`Неправильна структура рекомендації для елемента ${index}`);
        }

        return {
          exerciseName: rec.exerciseName,
          recommendedWeight: rec.recommendedWeight,
          recommendedReps: rec.recommendedReps,
          recommendedSets: rec.recommendedSets,
          recommendationReason: rec.recommendationReason,
          lastPerformanceSummary: rec.lastPerformanceSummary || undefined, // Необов'язкове поле
        };
      });

    } catch (e) {
      console.error("Error parsing JSON from AI progress analysis response:", e);
      console.error("Received string (after processing):", jsonStr);
      console.error("Original AI response text:", response.text);
      throw new Error("Не вдалося розібрати рекомендації прогресу від AI.");
    }

  } catch (error: any) {
    console.error("Error during progress analysis via Gemini API:", error);
     if (error.message && (error.message.includes("API_KEY_INVALID") || (error.response && error.response.status === 400))) {
         throw new Error("Наданий API ключ недійсний або не має дозволів. Будь ласка, перевірте ваш API ключ.");
    }
    if (error.message && error.message.toLowerCase().includes("candidate.safetyratings")) {
        throw new Error("Відповідь від AI була заблокована через налаштування безпеки. Спробуйте змінити запит.");
    }
    if (error.message && error.message.toLowerCase().includes("fetch")) { 
        throw new Error("Помилка мережі при зверненні до AI сервісу. Перевірте ваше інтернет-з'єднання та спробуйте пізніше.");
    }
    throw new Error(`Помилка аналізу прогресу: ${error.message || 'Невідома помилка сервісу AI'}`);
  }
};

// Допоміжна функція для формування промпту аналізу прогресу
const constructProgressAnalysisPrompt = (userProfile: UserProfile, workoutLogs: WorkoutLog[]): string => {
  const { goal, experienceLevel, name } = userProfile;

  let prompt = `Ти — висококваліфікований персональний фітнес-тренер, який аналізує історію тренувань користувача та надає рекомендації для прогресу.\n\n**Вхідні дані користувача:**\n*   Ім'я: ${name || 'Користувач'}\n*   Головна фітнес-ціль: ${getUkrainianGoal(goal)}\n*   Рівень підготовки: ${getUkrainianExperienceLevel(experienceLevel)}\n\n**Історія тренувань:**\nНижче наведена історія тренувань користувача у форматі JSON. Проаналізуй результати для КОЖНОЇ вправи, яку користувач виконував хоча б один раз. Врахуй динаміку ваги, повторень, кількості підходів, успішність виконання з часом.\n\n`;

  // Додаємо логи тренувань у форматі JSON
  // Вибираємо тільки необхідні поля для економії токенів
  const simplifiedLogs = workoutLogs.map(log => ({
      date: log.date instanceof Date ? log.date.toISOString() : (log.date as any)?.seconds ? new Date(log.date.seconds * 1000).toISOString() : 'Невідома дата',
      dayCompleted: log.dayCompleted,
      loggedExercises: log.loggedExercises.map(ex => ({
          exerciseName: ex.exerciseName,
          originalSets: ex.originalSets,
          originalReps: ex.originalReps,
          targetWeightAtLogging: ex.targetWeightAtLogging,
          loggedSets: ex.loggedSets ? ex.loggedSets.map(set => ({
              repsAchieved: set.repsAchieved,
              weightUsed: set.weightUsed,
              completed: set.completed,
          })) : []
      })),
  }));

  prompt += `\`\`\`json\n${JSON.stringify(simplifiedLogs, null, 2)}\n\`\`\`\n\n**Завдання:**\nПроаналізуй історію виконання кожної унікальної вправи. На основі аналізу, головної цілі користувача та його рівня підготовки, надай конкретні РЕКОМЕНДАЦІЇ щодо ЦІЛЬОВОЇ ВАГИ, КІЛЬКОСТІ ПІДХОДІВ та КІЛЬКОСТІ ПОВТОРЕНЬ для НАСТУПНОГО виконання КОЖНОЇ з цих вправ.\n\nВраховуй наступні принципи:\n- **Прогресія:** Рекомендуй поступове збільшення навантаження (вага, повторення, підходи) тільки якщо користувач успішно виконує поточне з хорошою технікою.\n- **Адаптація:** Якщо користувач нещодавно збільшив вагу/повторення і результати стабільні, можеш рекомендувати закріпити результат або зробити невеликий крок вперед.\n- **Регресія/Плато:** Якщо є послідовні невдачі або тривале плато, рекомендуй зменшити вагу/повторення або змінити підхід для відновлення прогресу та вдосконалення техніки.\n- **Ціль користувача:** Рекомендації щодо діапазонів повторень та підходів мають відповідати фітнес-цілі (сила, гіпертрофія, витривалість).\n- **Рівень підготовки:** Адаптуй розмір кроків прогресії та загальну складність рекомендацій до рівня користувача (початківець, проміжний, просунутий).\n\n**Формат відповіді:**\nНадай відповідь ВИКЛЮЧНО у форматі JSON-масиву об'єктів. Кожен об'єкт у масиві представляє рекомендацію для ОДНІЄЇ унікальної вправи, яку користувач виконував. Включи рекомендації тільки для тих вправ, які є в історії тренувань.\nНе додавай жодних пояснень, коментарів або тексту поза JSON структурою. JSON має бути ідеально валідним.\n\n**Структура JSON для кожної рекомендації:**\n[\n  {\n    \"exerciseName\": \"<Назва вправи>\",\n    \"recommendedWeight\": <Рекомендована вага для наступного тренування, число, наприклад 105.0. Округляй до найближчого кроку ваги, наприклад 2.5кг. Вага не може бути від'ємною.>, \n    \"recommendedReps\": \"<Рекомендований діапазон повторень для наступного тренування, рядок, наприклад \\\"8-12\\\">\",\n    \"recommendedSets\": \"<Рекомендована кількість підходів для наступного тренування, рядок, наприклад \\\"3-4\\\">\",\n    \"recommendationReason\": \"<Коротке пояснення причини рекомендації (наприклад, 'Прогресія ваги після успішного виконання', 'Зменшення ваги через послідовні невдачі', 'Період адаптації'). Має бути українською.>\",\n    \"lastPerformanceSummary\": \"<Необов'язково: Короткий підсумок останнього виконання вправи (наприклад, \\\"Останнє: 100 кг x 8 повт x 3 підх\\\"). Українською. Якщо даних немає, залиш поле відсутнім. >\"\n  }\n  // ... рекомендації для інших вправ\n]\n\n**Приклад структури відповіді (заповни реальними рекомендаціями):**\n[\n  {\n    \"exerciseName\": \"Жим штанги лежачи на горизонтальній лаві\",\n    \"recommendedWeight\": 102.5,\n    \"recommendedReps\": \"8-10\",\n    \"recommendedSets\": \"4\",\n    \"recommendationReason\": \"Невелике збільшення ваги після успішного виконання минулого тренування.\",\n    \"lastPerformanceSummary\": \"Останнє: 100 кг x 9 повт x 4 підх\"\n  },\n  {\n    \"exerciseName\": \"Присідання зі штангою на плечах\",\n    \"recommendedWeight\": 140.0,\n    \"recommendedReps\": \"5-7\",\n    \"recommendedSets\": \"5\",\n    \"recommendationReason\": \"Прогресія навантаження для розвитку сили.\",\n    \"lastPerformanceSummary\": \"Останнє: 135 кг x 6 повт x 5 підх\"\n  }\n]\n\nПереконайся, що JSON валідний, всі текстові поля заповнені українською мовою, а рекомендовані значення відповідають історії та цілям користувача. Надай рекомендації ТІЛЬКИ для вправ, які є в наданій історії тренувань.`;

  return prompt;
};