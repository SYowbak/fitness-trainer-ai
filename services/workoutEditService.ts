import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserProfile, DailyWorkoutPlan, Exercise } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getApiKey } from './geminiService';
import { getUkrainianGender, getUkrainianBodyType, getUkrainianGoal, getUkrainianExperienceLevel, getUkrainianMuscleGroup } from '../constants';

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

const constructExercisePrompt = (
  profile: UserProfile,
  currentPlan: DailyWorkoutPlan[],
  targetDay: number,
  targetExerciseIndex?: number,
  exerciseToComplete?: Exercise
): string => {
  const { gender, bodyType, goal, trainingFrequency, targetMuscleGroups, height, weight, age, experienceLevel } = profile;
  
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

  const planStyleContext = `\n**Приклад вправи з поточного плану (стиль для наслідування):**\n${currentExercises.length > 0 ? JSON.stringify(currentExercises[0], null, 2) : "План поки що порожній, використовуй загальні рекомендації."}`;

  if (exerciseToComplete) {
    exerciseContext = `\n**Вправа для доповнення деталей (змінена користувачем):**\n${JSON.stringify(exerciseToComplete, null, 2)}`;
    taskInstruction = `Твоя мета — надати повні та детальні дані (опис техніки, підходи, повторення, відпочинок, пошук відео) для наданої вправи. **Зроби це у стилі, який використовується в вже існуючому плані тренувань, і надавай інформацію, яка відповідає цілям користувача.** Відповідь має бути у форматі JSON-об'єкта.`;
    targetExerciseJson = JSON.stringify({
      name: exerciseToComplete.name,
      description: "<дуже детальний покроковий опис техніки>",
      sets: "<кількість підходів, '3-4' або 4>",
      reps: "<діапазон повторень, '8-12'>",
      rest: "<час відпочинку, '60-90 секунд'>",
      videoSearchQuery: "<пошуковий запит для YouTube або null>"
    }, null, 2);
  } else if (typeof targetExerciseIndex === 'number') {
    exerciseContext = `\n**Поточна вправа для перегенерації:**\n${JSON.stringify(currentExercises[targetExerciseIndex], null, 2)}`;
    taskInstruction = `Твоя мета — перегенерувати надану вправу, замінивши її на схожу за призначенням, але іншу вправу. **Зроби це у стилі, який використовується в вже існуючому плані тренувань, і надавай інформацію, яка відповідає цілям користувача.** Відповідь має бути у форматі JSON-об'єкта.`;
    targetExerciseJson = JSON.stringify({
      name: "<назва вправи>",
      description: "<дуже детальний покроковий опис техніки>",
      sets: "<кількість підходів, '3-4' або 4>",
      reps: "<діапазон повторень, '8-12'>",
      rest: "<час відпочинку, '60-90 секунд'>",
      videoSearchQuery: "<пошуковий запит для YouTube або null>"
    }, null, 2);
  } else {
    exerciseContext = `\n**Поточні вправи в плані (для контексту):**\n${JSON.stringify(currentExercises, null, 2)}`;
    taskInstruction = `Твоя мета — згенерувати нову вправу для поточного плану тренувань. **Зроби це у стилі, який використовується в вже існуючому плані тренувань, і надавай інформацію, яка відповідає цілям користувача.** Відповідь має бути у форматі JSON-об'єкта.`;
    targetExerciseJson = JSON.stringify({
      name: "<назва вправи>",
      description: "<дуже детальний покроковий опис техніки>",
      sets: "<кількість підходів, '3-4' або 4>",
      reps: "<діапазон повторень, '8-12'>",
      rest: "<час відпочинку, '60-90 секунд'>",
      videoSearchQuery: "<пошуковий запит для YouTube або null>"
    }, null, 2);
  }

  return `Ти — висококваліфікований персональний фітнес-тренер, який допомагає коригувати індивідуальні програми тренувань. ${taskInstruction}

**Дій як справжній персональний тренер:**
*   **Індивідуалізація:** Відповідь має бути глибоко персоналізованою, враховуючи всі надані дані.
*   **Безпека та техніка:** Завжди наголошуй на важливості правильної техніки та безпеки.
*   **Реалістичність:** Не ускладнюй без потреби.
*   **Мотивація:** Твій опис має бути чітким та мотивуючим.
**Вимоги до відповіді AI:**
*   Надай відповідь **ВИКЛЮЧНО** у форматі JSON-об'єкта, що представляє одну вправу.
*   Не додавай жодних пояснень, коментарів або тексту поза JSON структурою.
*   Дотримуйся структури JSON, наведеної у прикладі.

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

**Поточний план тренувань (для контексту):**
${JSON.stringify(currentPlan, null, 2)}
${exerciseContext}
${planStyleContext}

**Вимоги до даних у JSON:**
1.  **Назва:** Вкажи точну українську назву вправи.
2.  **Опис Техніки:** Надай **ДУЖЕ ДЕТАЛЬНИЙ**, покроковий опис правильної техніки виконання вправи. Включи:
    *   Початкове положення.
    *   Ключові моменти руху.
    *   Правильне дихання.
    *   Типові помилки та як їх уникнути.
    *   Поради для максимальної ефективності.
3.  **Кількість підходів:** Вкажи кількість робочих підходів (наприклад, "3-4" або число 4).
4.  **Кількість повторень:** Вкажи діапазон повторень, оптимальний для цілі (наприклад, "8-12" для гіпертрофії, "12-15" для витривалості).
5.  **Відпочинок:** Вкажи рекомендований час відпочинку між підходами в секундах (наприклад, "60-90 секунд").
6.  **videoSearchQuery:** Надай точний пошуковий запит для YouTube українською або російською мовою (наприклад, "присідання зі штангою техніка виконання"). Якщо якісного запиту сформулювати не вдається, залиш null.

**Приклад структури JSON для однієї вправи:**
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
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
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
      const exercise: Exercise = JSON.parse(jsonStr);
      
      // Перевіряємо обов'язкові поля
      if (!exercise.name || !exercise.description || !exercise.sets || !exercise.reps || !exercise.rest) {
        throw new Error("Відсутні обов'язкові поля у згенерованій вправі");
      }

      return {
        ...exercise,
        id: uuidv4(),
        targetWeight: null,
        targetReps: null,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: false
      };
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      console.error("Original AI response text:", result.text());
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
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
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
      const exercise: Exercise = JSON.parse(jsonStr);
      
      // Перевіряємо обов'язкові поля
      if (!exercise.name || !exercise.description || !exercise.sets || !exercise.reps || !exercise.rest) {
        throw new Error("Відсутні обов'язкові поля у згенерованій вправі");
      }

      return {
        ...exercise,
        id: uuidv4(),
        targetWeight: null,
        targetReps: null,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: false
      };
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      console.error("Original AI response text:", result.text());
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
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
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
      const exercise: Exercise = JSON.parse(jsonStr);
      
      // Перевіряємо обов'язкові поля
      if (!exercise.name || !exercise.description || !exercise.sets || !exercise.reps || !exercise.rest) {
        throw new Error("Відсутні обов'язкові поля у згенерованій вправі");
      }

      return {
        ...exercise,
        id: exercise.id || uuidv4(),
        targetWeight: exercise.targetWeight !== undefined ? exercise.targetWeight : null,
        targetReps: exercise.targetReps !== undefined ? exercise.targetReps : null,
        isCompletedDuringSession: exercise.isCompletedDuringSession ?? false,
        sessionLoggedSets: exercise.sessionLoggedSets ?? [],
        sessionSuccess: exercise.sessionSuccess ?? false,
        recommendation: exercise.recommendation || null,
      };
    } catch (e) {
      console.error("Error parsing JSON from AI response:", e);
      console.error("Original AI response text:", result.text());
      throw new Error("Не вдалося розібрати відповідь від AI");
    }
  } catch (error: any) {
    console.error("Error during exercise details completion:", error);
    throw new Error(`Помилка доповнення деталей вправи: ${error.message || 'Невідома помилка'}`);
  }
}; 