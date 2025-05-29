import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UserProfile, DailyWorkoutPlan } from '../types';
import { getUkrainianGoal, getUkrainianBodyType, getUkrainianGender, getUkrainianMuscleGroup, UI_TEXT, GEMINI_MODEL_TEXT } from '../constants';

const getApiKey = (): string | null => {
  // @ts-ignore
  const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY ? process.env.API_KEY : null;
  if (!apiKey) {
    console.warn("API_KEY for Gemini is not set. Please ensure it's configured in your environment.");
    return null;
  }
  return apiKey;
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
  const { gender, bodyType, goal, trainingFrequency, name, primaryTargetMuscleGroup } = profile;
  
  const userNamePart = name ? `для користувача на ім'я ${name}` : '';
  const genderText = getUkrainianGender(gender);
  const bodyTypeText = getUkrainianBodyType(bodyType);
  const goalText = getUkrainianGoal(goal);
  const targetMuscleGroupText = primaryTargetMuscleGroup ? `з особливим акцентом на ${getUkrainianMuscleGroup(primaryTargetMuscleGroup)}` : 'із загальним розвитком всіх груп м\'язів';

  return `
Ти — висококваліфікований персональний фітнес-тренер, який створює індивідуальні програми тренувань. Твоя мета — розробити максимально ефективний, безпечний та логічний план тренувань у тренажерному залі ${userNamePart}.

**Дій як справжній персональний тренер:**
*   **Індивідуалізація:** План має бути глибоко персоналізованим, враховуючи всі надані дані.
*   **Безпека та техніка:** Завжди наголошуй на важливості правильної техніки та безпеки.
*   **Реалістичність:** Не ускладнюй тренування без потреби, особливо якщо ціль — загальна фізична форма або користувач може бути новачком.
*   **Мотивація:** Твої описи мають бути чіткими та мотивуючими.

**Вхідні дані користувача:**
*   Стать: ${genderText}
*   Тип статури: ${bodyTypeText}
*   Головна фітнес-ціль: ${goalText}
*   Бажана частота тренувань: ${trainingFrequency} рази на тиждень.
*   Бажаний акцент: ${targetMuscleGroupText}.

**Вимоги до плану:**
1.  **Структура:** Розбий план на ${trainingFrequency} тренувальних дні(в). Кожен день повинен мати чітку мету і, якщо вказано, фокусуватися на цільовій групі м'язів, забезпечуючи при цьому достатній час для відновлення цієї групи.
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
    *   **Кількість підходів:** Вкажи кількість робочих підходів (наприклад, "3-4" або число 4). Не включай розминочні підходи сюди.
    *   **Кількість повторень:** Вкажи діапазон повторень, оптимальний для цілі (наприклад, "8-12" для гіпертрофії, "12-15" для витривалості).
    *   **Відпочинок:** Вкажи рекомендований час відпочинку між підходами в секундах (наприклад, "60-90 секунд").
    *   **imageSuggestion:** Надай коротку текстову пропозицію для статичного зображення або GIF, яке б чітко ілюструвало КЛЮЧОВИЙ МОМЕНТ або правильну форму вправи (наприклад, "Анімований GIF: присідання, вид збоку, акцент на глибині та прямій спині" або "Фото: правильний хват штанги при жимі лежачи"). Якщо ідеї немає, залиш null.
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
      "sets": "<кількість підходів, '3-4' або 4>",
      "reps": "<діапазон повторень, '8-12'>",
      "rest": "<час відпочинку, '60-90 секунд'>",
      "imageSuggestion": "<текстова пропозиція для зображення/GIF або null>",
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
        "imageSuggestion": "Анімований GIF: присідання зі штангою, вид збоку, показана глибина присіду та пряма спина.",
        "videoSearchQuery": "присідання зі штангою техніка виконання"
      }
      // ... інші вправи
    ],
    "cooldown": "Статична розтяжка м'язів ніг (квадрицепси, біцепси стегна, сідничні, литкові) по 20-30 секунд на кожну розтяжку.",
    "notes": "Сьогодні акцент на ногах. Фокусуйтесь на ідеальній техніці. Якщо ви новачок, почніть з порожнім грифом або легкою вагою для відпрацювання руху. Намагайтесь щотижня додавати 1-2.5кг до робочої ваги, якщо виконуєте всі повторення з правильною технікою."
  }
  // ... інші дні
]
Переконайся, що JSON валідний, всі текстові поля заповнені українською мовою, а описи технік максимально детальні та корисні.
`;
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
            // Consider adding temperature for more varied plans if needed, e.g., temperature: 0.7
        },
    });

    let jsonStr = (response.text ?? '').trim();
    
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    try {
      const parsedPlan: any[] = JSON.parse(jsonStr); 
      if (!Array.isArray(parsedPlan) || parsedPlan.some(day => 
          typeof day.day !== 'number' || 
          !Array.isArray(day.exercises) || 
          !day.exercises.every((ex: any) => ex.name && ex.description && ex.sets && ex.reps && ex.rest) // Basic check
        )) {
        console.error("AI response has incorrect structure:", parsedPlan);
        throw new Error("AI повернув план у неочікуваному форматі. Будь ласка, спробуйте змінити запит або повторити пізніше.");
      }
      
      return parsedPlan.map((day): DailyWorkoutPlan => ({
        ...day,
        exercises: day.exercises.map((ex: any) => ({
          name: ex.name || "Невідома вправа",
          description: ex.description || "Опис відсутній.",
          sets: ex.sets || "3",
          reps: ex.reps || "10-12",
          rest: ex.rest || "60 секунд",
          imageSuggestion: ex.imageSuggestion || null,
          videoSearchQuery: ex.videoSearchQuery || null, // Add videoSearchQuery
          targetWeight: null, 
          targetReps: null,   
        })),
        warmup: day.warmup || "",
        cooldown: day.cooldown || "",
        notes: day.notes || ""
      }));
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