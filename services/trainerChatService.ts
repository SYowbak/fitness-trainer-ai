import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserProfile, DailyWorkoutPlan } from '../types';
import { UI_TEXT, GEMINI_MODELS } from '../constants';
import { withQuotaManagement, shouldEnableAIFeature, getSmartModel } from '../utils/apiQuotaManager';
import { generateNewExercise, regenerateExercise } from './workoutEditService';

const ai = new GoogleGenerativeAI(import.meta.env.VITE_API_KEY || '');

interface TrainerAction {
  type: 'chat' | 'modify_workout' | 'replace_exercise' | 'add_exercise' | 'remove_exercise';
  data?: any;
}

interface TrainerResponse {
  message: string;
  action?: TrainerAction;
  modifiedPlan?: DailyWorkoutPlan;
}

// Helper function to generate regular chat responses
const generateRegularChatResponse = async (
  userProfile: UserProfile,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  todaysWorkout?: DailyWorkoutPlan | null
): Promise<TrainerResponse> => {
  const recentHistory = conversationHistory.slice(-4); // Last 4 messages for context
  
  const chatPrompt = `Ти - персональний фітнес-тренер. Відповідай коротко, зрозуміло та по суті.

Профіль: Вік ${userProfile.age}, ціль: ${userProfile.goal}

${todaysWorkout ? `План на сьогодні: ${todaysWorkout.exercises.map(e => e.name).join(', ')}` : ''}

${recentHistory.length > 0 ? `Останні повідомлення:\n${recentHistory.map(msg => `${msg.role === 'user' ? 'Користувач' : 'Тренер'}: ${msg.content}`).join('\n')}\n` : ''}

Повідомлення: ${userMessage}

Відповідай українською, дружньо та професійно. Якщо користувач скаржиться на біль або хоче змінити вправи, порадь йому написати щось на кшталт "заміни вправу Х на вправу У".`;

  return withQuotaManagement(async () => {
    const selectedModel = getSmartModel(GEMINI_MODELS.CHAT);
    console.log(`Чат використовує модель: ${selectedModel}`);
    
    const model = ai!.getGenerativeModel({ model: selectedModel });
    const response = await model.generateContent(chatPrompt);
    const result = await response.response;
    
    return {
      message: result.text()
    };
  }, { message: 'Пробачте, сталася помилка з AI. Спробуйте пізніше.' }, { 
    priority: 'high',
    bypassQuotaInDev: true,
    skipOnQuotaExceeded: false  // Changed to false for chat - we want it to work
  });
};

// Helper function to handle workout modifications
const handleWorkoutModification = async (
  userProfile: UserProfile,
  userMessage: string,
  todaysWorkout: DailyWorkoutPlan,
  currentWorkoutPlan: DailyWorkoutPlan[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<TrainerResponse> => {
  const modificationPrompt = `Користувач хоче змінити вправи. Проаналізуй повідомлення:

"Повідомлення: ${userMessage}"

Поточні вправи на сьогодні:
${todaysWorkout.exercises.map((ex, i) => `${i + 1}. ${ex.name}`).join('\n')}

Визнач конкретну дію:
1. replace_exercise: заміна конкретної вправи
2. add_exercise: додавання нової вправи
3. remove_exercise: видалення вправи
4. chat: просто розмова

Відповідь JSON: {"action": "replace_exercise", "exercise_name": "Назва вправи", "reason": "Причина", "message": "Повідомлення користувачу"}`;

  try {
    const analysisResult = await withQuotaManagement(async () => {
      const selectedModel = getSmartModel(GEMINI_MODELS.ANALYSIS);
      const model = ai!.getGenerativeModel({ model: selectedModel });
      const response = await model.generateContent(modificationPrompt);
      return response.response.text();
    }, null, { 
      priority: 'high',
      bypassQuotaInDev: true,
      skipOnQuotaExceeded: false  // Changed to false for modifications - we want them to work
    });

    // Parse the JSON response
    if (!analysisResult) {
      return {
        message: `Не вдалося обробити ваш запит. Спробуйте написати: "заміни вправу [назва] на іншу" або "додай вправу".`
      };
    }
    
    const cleanResponse = analysisResult.replace(/```json|```/g, '').trim();
    const parsedAction = JSON.parse(cleanResponse);

    // Handle different actions
    switch (parsedAction.action) {
      case 'replace_exercise': {
        const exerciseIndex = todaysWorkout.exercises.findIndex(ex => 
          ex.name.toLowerCase().includes(parsedAction.exercise_name.toLowerCase()) ||
          parsedAction.exercise_name.toLowerCase().includes(ex.name.toLowerCase())
        );

        if (exerciseIndex === -1) {
          return {
            message: `Не знайшов вправу "${parsedAction.exercise_name}". Повторіть запит, вказавши точну назву.`
          };
        }

        // Generate a replacement exercise
        try {
          const newExercise = await regenerateExercise(
            userProfile, 
            currentWorkoutPlan, 
            todaysWorkout.day, 
            exerciseIndex
          );

          const modifiedWorkout: DailyWorkoutPlan = {
            ...todaysWorkout,
            exercises: todaysWorkout.exercises.map((ex, i) => 
              i === exerciseIndex ? newExercise : ex
            )
          };

          return {
            message: `Замінив "${todaysWorkout.exercises[exerciseIndex].name}" на "${newExercise.name}". ${parsedAction.message || 'Причина: ' + parsedAction.reason}`,
            action: {
              type: 'replace_exercise',
              data: { originalIndex: exerciseIndex, newExercise }
            },
            modifiedPlan: modifiedWorkout
          };
        } catch (error) {
          return {
            message: `Не вдалося згенерувати заміну. Спробуйте пізніше.`
          };
        }
      }

      case 'add_exercise': {
        try {
          const newExercise = await generateNewExercise(
            userProfile,
            currentWorkoutPlan,
            todaysWorkout.day
          );

          const modifiedWorkout: DailyWorkoutPlan = {
            ...todaysWorkout,
            exercises: [...todaysWorkout.exercises, newExercise]
          };

          return {
            message: `Додав нову вправу: "${newExercise.name}". ${parsedAction.message}`,
            action: {
              type: 'add_exercise',
              data: { newExercise }
            },
            modifiedPlan: modifiedWorkout
          };
        } catch (error) {
          return {
            message: `Не вдалося додати нову вправу. Спробуйте пізніше.`
          };
        }
      }

      case 'remove_exercise': {
        const exerciseIndex = todaysWorkout.exercises.findIndex(ex => 
          ex.name.toLowerCase().includes(parsedAction.exercise_name.toLowerCase()) ||
          parsedAction.exercise_name.toLowerCase().includes(ex.name.toLowerCase())
        );

        if (exerciseIndex === -1) {
          return {
            message: `Не знайшов вправу "${parsedAction.exercise_name}".`
          };
        }

        if (todaysWorkout.exercises.length <= 1) {
          return {
            message: `Не можу видалити останню вправу. Мінімум 1 вправа на день.`
          };
        }

        const modifiedWorkout: DailyWorkoutPlan = {
          ...todaysWorkout,
          exercises: todaysWorkout.exercises.filter((_, i) => i !== exerciseIndex)
        };

        return {
          message: `Видалив "${todaysWorkout.exercises[exerciseIndex].name}". ${parsedAction.message}`,
          action: {
            type: 'remove_exercise',
            data: { removedIndex: exerciseIndex }
          },
          modifiedPlan: modifiedWorkout
        };
      }

      default:
        return await generateRegularChatResponse(
          userProfile,
          userMessage,
          conversationHistory,
          todaysWorkout
        );
    }
  } catch (error) {
    console.error('Error in workout modification:', error);
    return {
      message: `Не вдалося обробити ваш запит. Спробуйте написати: "заміни вправу [назва] на іншу" або "додай вправу".`
    };
  }
};

export const generateTrainerResponse = async ({
  userProfile,
  userMessage,
  conversationHistory = [],
  currentWorkoutPlan = null,
  activeDay = null
}: {
  userProfile: UserProfile;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentWorkoutPlan?: DailyWorkoutPlan[] | null;
  activeDay?: number | null;
}): Promise<TrainerResponse> => {
  if (!ai) {
    throw new Error(UI_TEXT.apiKeyMissing);
  }

  // Check if chat feature is enabled based on quota
  if (!shouldEnableAIFeature('chat')) {
    throw new Error(UI_TEXT.aiOverloaded);
  }

  // Get current day's workout if available
  const todaysWorkout = currentWorkoutPlan && activeDay ? 
    currentWorkoutPlan.find(day => day.day === activeDay) : null;

  // Detect if user wants to modify workout
  const modificationKeywords = [
    'замін', 'змін', 'інш', 'болить', 'біль', 'травм', 'не можу', 'важко', 
    'складно', 'додай', 'прибер', 'вилуч', 'убер', 'напряжк', 'лікт'
  ];
  
  const wantsModification = modificationKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  if (wantsModification && todaysWorkout) {
    return await handleWorkoutModification(
      userProfile, 
      userMessage, 
      todaysWorkout, 
      currentWorkoutPlan!,
      conversationHistory
    );
  }

  // Regular chat response
  return await generateRegularChatResponse(
    userProfile,
    userMessage,
    conversationHistory,
    todaysWorkout
  );
};