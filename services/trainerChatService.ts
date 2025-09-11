import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserProfile, WorkoutLog } from '../types';
import { UI_TEXT, GEMINI_MODEL_TEXT } from '../constants';

const ai = new GoogleGenerativeAI(import.meta.env.VITE_API_KEY || '');

export const generateTrainerResponse = async ({
  userProfile,
  lastWorkoutLog,
  previousWorkoutLogs = [],
  userMessage,
  conversationHistory = []
}: {
  userProfile: UserProfile;
  lastWorkoutLog: WorkoutLog | null;
  previousWorkoutLogs?: WorkoutLog[];
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> => {
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  const chatPrompt = `Ти - персональний фітнес-тренер. Твоя задача - надавати персоналізовані рекомендації та  коротко і зрозуміло по суті, як людина відповідати на питання користувача, враховуючи його профіль та історію тренувань.

Профіль користувача:
{
  "gender": "${userProfile.gender}",
  "age": ${userProfile.age},
  "height": ${userProfile.height},
  "weight": ${userProfile.weight},
  "bodyType": "${userProfile.bodyType}",
  "experienceLevel": "${userProfile.experienceLevel}",
  "fitnessGoal": "${userProfile.goal}",
  "targetMuscleGroups": ${JSON.stringify(userProfile.targetMuscleGroups)}
}

Останні тренування (від найновішого до старішого):
${lastWorkoutLog ? JSON.stringify([lastWorkoutLog, ...previousWorkoutLogs], null, 2) : 'Немає попередніх логів'}

Історія діалогу:
${conversationHistory.map(msg => `${msg.role === 'user' ? 'Користувач' : 'Тренер'}: ${msg.content}`).join('\n')}

Повідомлення користувача:
${userMessage}

При аналізі та відповідях враховуй:

1. Фізичні характеристики:
   - Стать: ${userProfile.gender}
   - Вік: ${userProfile.age}
   - Зріст: ${userProfile.height} см
   - Вага: ${userProfile.weight} кг
   - Тип статури: ${userProfile.bodyType}
   - Рівень досвіду: ${userProfile.experienceLevel}
   - Фітнес-ціль: ${userProfile.goal}
   - Цільові групи м'язів: ${userProfile.targetMuscleGroups.join(', ')}

2. Історія тренувань:
   - Аналіз попередніх логів
   - Патерни прогресу/регресу
   - Тривалість тренувань
   - Частота тренувань
   - Відпочинок між підходами
   - Виконані вправи та їх прогресія

3. Прогресія навантаження:
   - Для схуднення: більше повторень (12-15), менша вага, коротший відпочинок
   - Для набору маси: середня кількість повторень (8-12), середня вага, середній відпочинок
   - Для сили: менше повторень (4-6), більша вага, довший відпочинок
   - Для витривалості: більше повторень (15-20), легка вага, мінімальний відпочинок

4. Техніка та безпека:
   - Аналіз виконаних повторень
   - Перевірка прогресу ваги
   - Відстеження болю/дискомфорту
   - Рекомендації щодо техніки

5. Персоналізація відповідей:
   - Адаптуй всі рекомендації під конкретний профіль
   - Враховуй тип статури при розрахунку прогресії
   - Надавай конкретні числові значення для ваги та повторень
   - Включай рекомендації щодо техніки
   - Враховуй загальну втому та час відновлення
   - Надавай мотивуючі коментарі при позитивному прогресі

6. Структура відповіді:
   - Відповідай українською мовою
   - Будь дружнім та професійним
   - Надавай конкретні рекомендації
   - Пояснюй причини рекомендацій
   - Запропонуй альтернативні варіанти
   - Відповідай на конкретне питання користувача

7. Додаткові рекомендації:
   - Харчування та відновлення
   - Зміни в програмі тренувань
   - Технічні аспекти вправ
   - Стратегії прогресу
   - Запобігання травмам

Відповідай на повідомлення користувача, враховуючи всі надані дані та контекст діалогу.`;

  try {
    const model = ai.getGenerativeModel({ model: GEMINI_MODEL_TEXT });
    const response = await model.generateContent(chatPrompt);
    const result = await response.response;
    return result.text();
  } catch (error: any) {
    console.error("Error during trainer chat:", error);
    if (error.message && (error.message.includes("API_KEY_INVALID") || (error.response && error.response.status === 400))) {
      throw new Error("Наданий API ключ недійсний або не має дозволів. Будь ласка, перевірте ваш API ключ.");
    }
    if (error.message && error.message.toLowerCase().includes("candidate.safetyratings")) {
      throw new Error("Відповідь від AI була заблокована через налаштування безпеки. Спробуйте змінити запит.");
    }
    if (error.message && error.message.toLowerCase().includes("fetch")) {
      throw new Error("Помилка мережі при зверненні до AI сервісу. Перевірте ваше інтернет-з'єднання та спробуйте пізніше.");
    }
    throw new Error(`Помилка чату з тренером: ${error.message || 'Невідома помилка сервісу AI'}`);
  }
}; 