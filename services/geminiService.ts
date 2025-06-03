import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UserProfile, DailyWorkoutPlan } from '../types';
import { 
  getUkrainianGoal, 
  getUkrainianBodyType, 
  getUkrainianGender, 
  getUkrainianMuscleGroup, 
  getUkrainianExperienceLevel,
  UI_TEXT, 
  GEMINI_MODEL_TEXT 
} from '../constants';

const getApiKey = (): string | null => {
  // @ts-ignore
  const apiKey = typeof import.meta.env !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY ? import.meta.env.VITE_API_KEY : null;
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
  const { gender, bodyType, goal, trainingFrequency, name, targetMuscleGroups, height, weight, age, experienceLevel } = profile;
  
  const userNamePart = name ? `для користувача на ім'я ${name}` : '';
  const genderText = getUkrainianGender(gender);
  const bodyTypeText = getUkrainianBodyType(bodyType);
  const goalText = getUkrainianGoal(goal);
  const experienceLevelText = getUkrainianExperienceLevel(experienceLevel);
  const targetMuscleGroupsText = targetMuscleGroups.length > 0 
    ? `з особливим акцентом на ${targetMuscleGroups.map(group => getUkrainianMuscleGroup(group)).join(', ')}`
    : 'із загальним розвитком всіх груп м\'язів';

  return `Створи детальний план тренувань ${userNamePart} з наступними параметрами:
- Стать: ${genderText}
- Вік: ${age} років
- Тип статури: ${bodyTypeText}
- Ціль: ${goalText}
- Частота тренувань: ${trainingFrequency} разів на тиждень
- Рівень підготовки: ${experienceLevelText}
- Зріст: ${height} см
- Вага: ${weight} кг
- Цільові групи м'язів: ${targetMuscleGroupsText}

План має бути адаптований під вік та рівень підготовки користувача, включаючи:
1. Розминку перед тренуванням
2. Основні вправи з детальними інструкціями
3. Заминку після тренування
4. Рекомендації щодо відпочинку між підходами
5. Примітки щодо техніки виконання

Для кожної вправи вкажи:
- Назву вправи
- Кількість підходів
- Кількість повторень
- Вагу (якщо потрібно)
- Відпочинок між підходами
- Примітки щодо техніки виконання

План має бути безпечним та ефективним для віку користувача, з акцентом на правильну техніку виконання вправ.`;
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
              imageSuggestion: ex.imageSuggestion || null,
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