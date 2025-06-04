import { GoogleGenAI } from "@google/genai";
import { UserProfile, DailyWorkoutPlan, Exercise } from '../types';
import { getApiKey } from './geminiService';
import { getUkrainianGender, getUkrainianBodyType, getUkrainianGoal, getUkrainianExperienceLevel, getUkrainianMuscleGroup } from '../constants';

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

const constructExercisePrompt = (
  profile: UserProfile,
  currentPlan: DailyWorkoutPlan[],
  targetDay: number,
  targetExerciseIndex?: number,
  exerciseToComplete?: Exercise
): string => {
  const { gender, bodyType, goal, trainingFrequency, name, targetMuscleGroups, height, weight, age, experienceLevel } = profile;
  
  const userNamePart = name ? `для користувача на ім'я ${name}` : '';
  const genderText = getUkrainianGender(gender);
  const bodyTypeText = getUkrainianBodyType(bodyType);
  const goalText = getUkrainianGoal(goal);
  const experienceLevelText = getUkrainianExperienceLevel(experienceLevel);
  const targetMuscleGroupsText = targetMuscleGroups.length > 0 
    ? `з особливим акцентом на ${targetMuscleGroups.map(group => getUkrainianMuscleGroup(group)).join(', ')}`
    : 'із загальним розвитком всіх груп м\'язів';

  const currentDayPlan = currentPlan.find(p => p.day === targetDay);
  const currentExercises = currentDayPlan?.exercises || [];

  let exerciseContext = '';
  let taskInstruction = '';
  let targetExerciseJson = '';

  if (exerciseToComplete) {
    exerciseContext = `\n**Вправа для доповнення деталей:**\n${JSON.stringify(exerciseToComplete, null, 2)}`;
    taskInstruction = `Твоя мета — доповнити відсутні або уточнити наявні деталі для наданої вправи. Згенеруй лише JSON-об'єкт з повними даними цієї вправи, включаючи опис техніки, підходи, повторення, відпочинок, а також пропозиції для зображення та пошуку відео.`;
    targetExerciseJson = JSON.stringify({
      name: exerciseToComplete.name,
      description: "<дуже детальний покроковий опис техніки>",
      sets: "<кількість підходів, '3-4' або 4>",
      reps: "<діапазон повторень, '8-12'>",
      rest: "<час відпочинку, '60-90 секунд'>",
      imageSuggestion: "<текстова пропозиція для зображення/GIF або null>",
      videoSearchQuery: "<пошуковий запит для YouTube або null>"
    }, null, 2);

  } else if (targetExerciseIndex !== undefined) {
    exerciseContext = `\n**Поточна вправа для перегенерації:**\n${JSON.stringify(currentExercises[targetExerciseIndex], null, 2)}`;
    taskInstruction = `Твоя мета — перегенерувати надану вправу для плану тренувань у тренажерному залі ${userNamePart}. Згенеруй новий JSON-об'єкт для цієї вправи, враховуючи всі вхідні дані.`;
    targetExerciseJson = JSON.stringify({
      name: "<назва вправи>",
      description: "<дуже детальний покроковий опис техніки>",
      sets: "<кількість підходів, '3-4' або 4>",
      reps: "<діапазон повторень, '8-12'>",
      rest: "<час відпочинку, '60-90 секунд'>",
      imageSuggestion: "<текстова пропозиція для зображення/GIF або null>",
      videoSearchQuery: "<пошуковий запит для YouTube або null>"
    }, null, 2);

  } else {
    exerciseContext = `\n**Поточні вправи в плані (для контексту):**\n${JSON.stringify(currentExercises, null, 2)}`;
    taskInstruction = `Твоя мета — згенерувати нову вправу для плану тренувань у тренажерному залі ${userNamePart}. Згенеруй новий JSON-об'єкт для цієї вправи, враховуючи всі вхідні дані.`;
    targetExerciseJson = JSON.stringify({
      name: "<назва вправи>",
      description: "<дуже детальний покроковий опис техніки>",
      sets: "<кількість підходів, '3-4' або 4>",
      reps: "<діапазон повторень, '8-12'>",
      rest: "<час відпочинку, '60-90 секунд'>",
      imageSuggestion: "<текстова пропозиція для зображення/GIF або null>",
      videoSearchQuery: "<пошуковий запит для YouTube або null>"
    }, null, 2);
  }

  return `Ти — висококваліфікований персональний фітнес-тренер, який допомагає коригувати індивідуальні програми тренувань. ${taskInstruction}

**Дій як справжній персональний тренер:**
*   **Індивідуалізація:** Відповідь має бути глибоко персоналізованою, враховуючи всі надані дані.
*   **Безпека та техніка:** Завжди наголошуй на важливості правильної техніки та безпеки.
*   **Реалістичність:** Не ускладнюй без потреби.
*   **Мотивація:** Твій опис має бути чітким та мотивуючим.

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

**Поточний план тренувань:**
${JSON.stringify(currentPlan, null, 2)}
${exerciseContext}

**Вимоги до вправи:**
1.  **Відповідність:** Вправа має відповідати загальній структурі плану та цілям користувача.
2.  **Техніка:**
    *   **Назва:** Вкажи точну українську назву вправи.
    *   **Опис Техніки:** Надай ДУЖЕ ДЕТАЛЬНИЙ, покроковий опис правильної техніки виконання вправи. Включи:
        *   Початкове положення.
        *   Ключові моменти руху.
        *   Правильне дихання.
        *   Типові помилки та як їх уникнути.
        *   Поради для максимальної ефективності.
    *   **Кількість підходів:** Вкажи кількість робочих підходів (наприклад, "3-4" або число 4).
    *   **Кількість повторень:** Вкажи діапазон повторень, оптимальний для цілі (наприклад, "8-12" для гіпертрофії, "12-15" для витривалості).
    *   **Відпочинок:** Вкажи рекомендований час відпочинку між підходами в секундах (наприклад, "60-90 секунд").
    *   **imageSuggestion:** Надай коротку текстову пропозицію для статичного зображення або GIF.
    *   **videoSearchQuery:** Надай точний пошуковий запит для YouTube.

**Формат відповіді:**
Надай відповідь ВИКЛЮЧНО у форматі JSON-об'єкта, що представляє одну вправу. Не додавай жодних пояснень, коментарів або тексту поза JSON структурою.

**Структура JSON для вправи:**
${targetExerciseJson}`;
};

export const generateNewExercise = async (
  profile: UserProfile,
  currentPlan: DailyWorkoutPlan[],
  targetDay: number
): Promise<Exercise> => {
  if (!ai) {
    throw new Error("API ключ для Gemini не налаштовано");
  }

  const prompt = constructExercisePrompt(profile, currentPlan, targetDay);
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
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
      const exercise: Exercise = JSON.parse(jsonStr);
      
      // Перевіряємо обов'язкові поля
      if (!exercise.name || !exercise.description || !exercise.sets || !exercise.reps || !exercise.rest) {
        throw new Error("Відсутні обов'язкові поля у згенерованій вправі");
      }

      return {
        ...exercise,
        targetWeight: null,
        targetReps: null,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: undefined
      };
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      throw new Error("Не вдалося розібрати відповідь від AI");
    }
  } catch (error: any) {
    console.error("Error during exercise generation:", error);
    throw new Error(`Помилка генерації вправи: ${error.message || 'Невідома помилка'}`);
  }
};

export const regenerateExercise = async (
  profile: UserProfile,
  currentPlan: DailyWorkoutPlan[],
  targetDay: number,
  exerciseIndex: number
): Promise<Exercise> => {
  if (!ai) {
    throw new Error("API ключ для Gemini не налаштовано");
  }

  const prompt = constructExercisePrompt(profile, currentPlan, targetDay, exerciseIndex);
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
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
      const exercise: Exercise = JSON.parse(jsonStr);
      
      // Перевіряємо обов'язкові поля
      if (!exercise.name || !exercise.description || !exercise.sets || !exercise.reps || !exercise.rest) {
        throw new Error("Відсутні обов'язкові поля у згенерованій вправі");
      }

      return {
        ...exercise,
        targetWeight: null,
        targetReps: null,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: undefined
      };
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      throw new Error("Не вдалося розібрати відповідь від AI");
    }
  } catch (error: any) {
    console.error("Error during exercise regeneration:", error);
    throw new Error(`Помилка перегенерації вправи: ${error.message || 'Невідома помилка'}`);
  }
};

export const completeExerciseDetails = async (
  profile: UserProfile,
  currentPlan: DailyWorkoutPlan[],
  targetDay: number,
  exercise: Exercise
): Promise<Exercise> => {
  if (!ai) {
    throw new Error("API ключ для Gemini не налаштовано");
  }

  const prompt = constructExercisePrompt(profile, currentPlan, targetDay, undefined, exercise);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
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
      const completedExercise: Exercise = JSON.parse(jsonStr);

      // Перевіряємо обов'язкові поля (назва має бути присутня з вхідних даних)
      if (!completedExercise.description || !completedExercise.sets || !completedExercise.reps || !completedExercise.rest) {
        throw new Error("Відсутні обов'язкові поля у згенерованих деталях вправи");
      }

      return {
        ...exercise, // Зберігаємо оригінальну назву та інші поля, якщо потрібно
        ...completedExercise,
        targetWeight: exercise.targetWeight ?? null, // Зберігаємо наявну цільову вагу
        targetReps: exercise.targetReps ?? null, // Зберігаємо наявні цільові повторення
        isCompletedDuringSession: exercise.isCompletedDuringSession ?? false,
        sessionLoggedSets: exercise.sessionLoggedSets ?? [],
        sessionSuccess: exercise.sessionSuccess ?? undefined
      };
    } catch (e) {
      console.error("Error parsing JSON from AI response during completion:", e);
      throw new Error("Не вдалося розібрати відповідь від AI при доповненні деталей");
    }
  } catch (error: any) {
    console.error("Error during exercise detail completion:", error);
    throw new Error(`Помилка доповнення деталей вправи: ${error.message || 'Невідома помилка'}`);
  }
}; 