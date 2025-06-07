import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserProfile, DailyWorkoutPlan, WorkoutLog, Exercise } from '../types';
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
    *   **Кількість підходів:** Вкажи кількість робочих підходів (наприклад, "3-4" або число 4 , вказуєш скільки насправді потрібно зробити підходів залежно від цілі користувача).
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

  const prompt = constructPlanPrompt(profile);
  
  try {
    const model = ai.getGenerativeModel({ model: modelName });
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
              imageSuggestion: null,
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
}> => {
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  const analysisPrompt = `Ти - елітний фітнес-аналітик, який аналізує тренування та дає рекомендації щодо прогресу.\n\nВАЖЛИВО: Відповідь має бути ВИКЛЮЧНО у форматі JSON без жодних додаткових пояснень, коментарів або тексту поза JSON структурою.\n\nПрофіль користувача:\n${JSON.stringify(userProfile, null, 2)}\n\nПлан тренування на день:\n${JSON.stringify(dayPlan, null, 2)}\n\nОстанні тренування (від найновішого до старішого):\n${lastWorkoutLog ? JSON.stringify([lastWorkoutLog, ...previousWorkoutLogs], null, 2) : 'Немає попередніх логів'}\n\nПроаналізуй дані та надай рекомендації згідно з наступними принципами:\n\n1. Подвійна прогресія для вправ з вагою:\n   - Спочатку збільшуй кількість повторень\n   - Після досягнення верхньої межі повторень - збільшуй вагу\n\n2. Структура JSON відповіді: Очікується JSON об'єкт з полями "updatedPlan" та "recommendation".\n   - "updatedPlan": Об'єкт, що представляє оновлений план на день. Структура ідентична структурі плану дня, але в кожній вправі можуть бути оновлені поля "sets", "reps", додані "targetWeight", "targetReps" та "recommendation" (об'єкт з полями "text" та "action").\n   - "recommendation": Загальна рекомендація після аналізу (об'єкт з полями "text" та "action").\n\n   Приклад JSON:\n   {\n     "updatedPlan": {\n       "day": 1,\n       "warmup": "...",\n       "exercises": [\n         {\n           "name": "Назва вправи",\n           "description": "...",\n           "sets": "4",\n           "reps": "8-10",\n           "rest": "60 секунд",\n           "videoSearchQuery": "...",\n           "targetWeight": 100,\n           "targetReps": 10,\n           "recommendation": {\n             "text": "Відмінна робота! Спробуйте збільшити вагу наступного разу.",\n             "action": "increase_weight"\n           }\n         }\n         // ... інші вправи\n       ],\n       "cooldown": "...",\n       "notes": "..."\n     },\n     "recommendation": {\n       "text": "Загальна рекомендація по тренуванню дня...",\n       "action": "general_feedback"\n     }\n   }\n   \n   \n   Зверни особливу увагу на заповнення полів targetWeight, targetReps та recommendation всередині об'єктів вправ в updatedPlan на основі аналізу логів та профілю користувача.\n
Проаналізуй надані дані та згенеруй JSON відповідь з оновленим планом на день та загальною рекомендацією.\n
`;

  try {
    const model = ai.getGenerativeModel({ model: GEMINI_MODEL_TEXT });
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
               imageSuggestion: null,
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
        recommendation: generalRecommendation // Return the general recommendation
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
    if (error.message && error.message.toLowerCase().includes("candidate.safetyratings")) {
        throw new Error("Відповідь від AI була заблокована через налаштування безпеки при аналізі. Спробуйте змінити дані або запит.");
    }
     if (error.message && error.message.toLowerCase().includes("fetch")) { 
        throw new Error("Помилка мережі при зверненні до AI сервісу аналізу. Перевірте ваше інтернет-з'єднання та спробуйте пізніше.");
    }
    throw new Error(`Помилка аналізу тренування: ${error.message || 'Невідома помилка сервісу AI'}`);
  }
};