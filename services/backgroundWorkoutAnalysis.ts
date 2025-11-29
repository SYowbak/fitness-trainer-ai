import { UserProfile, DailyWorkoutPlan, WorkoutLog, ExerciseRecommendation } from '../types';
import { generateWorkoutAnalysis } from './geminiService';
import { isOnline } from '../utils/offlineUtils';
import { quotaManager } from '../utils/apiQuotaManager';
import { generateExerciseRecommendation } from '../utils/exerciseRecommendationGenerator';

/**
 * Сервіс для фонового аналізу тренувань з AI
 * Аналізує тренування після завершення та генерує рекомендації для наступного тренування
 */
export class BackgroundWorkoutAnalysisService {
  private static instance: BackgroundWorkoutAnalysisService;
  private analysisQueue: Map<string, WorkoutLog> = new Map();
  private isProcessing = false;

  private constructor() {}

  static getInstance(): BackgroundWorkoutAnalysisService {
    if (!BackgroundWorkoutAnalysisService.instance) {
      BackgroundWorkoutAnalysisService.instance = new BackgroundWorkoutAnalysisService();
    }
    return BackgroundWorkoutAnalysisService.instance;
  }

  /**
   * Додає тренування в чергу для фонового аналізу
   */
  async queueWorkoutForAnalysis(
    workoutLog: WorkoutLog,
    userProfile: UserProfile,
    dayPlan: DailyWorkoutPlan,
    previousLogs: WorkoutLog[],
    saveWorkoutLog: (log: WorkoutLog) => Promise<WorkoutLog>
  ): Promise<void> {
    console.log('🔄 [BackgroundAnalysis] Додаємо тренування в чергу аналізу:', workoutLog.id);
    
    if (!workoutLog.id) {
      console.error('❌ [BackgroundAnalysis] Неможливо додати тренування без ID');
      return;
    }

    // Позначаємо що аналіз очікується
    const updatedLog = {
      ...workoutLog,
      analysisStatus: 'pending' as const,
      analysisStartedAt: new Date()
    };

    try {
      await saveWorkoutLog(updatedLog);
      this.analysisQueue.set(workoutLog.id, {
        log: updatedLog,
        userProfile,
        dayPlan,
        previousLogs,
        saveWorkoutLog
      } as any);

      // Запускаємо обробку черги
      this.processQueue();
    } catch (error) {
      console.error('❌ [BackgroundAnalysis] Помилка при додаванні в чергу:', error);
    }
  }

  /**
   * Обробляє чергу аналізу
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.analysisQueue.size === 0) {
      return;
    }

    this.isProcessing = true;
    console.log('🔄 [BackgroundAnalysis] Починаємо обробку черги, елементів:', this.analysisQueue.size);

    for (const [logId, queueItem] of this.analysisQueue.entries()) {
      try {
        await this.analyzeWorkout(queueItem as any);
        this.analysisQueue.delete(logId);
      } catch (error) {
        console.error(`❌ [BackgroundAnalysis] Помилка аналізу для ${logId}:`, error);
        // Позначаємо як невдалий аналіз
        await this.markAnalysisAsFailed(queueItem as any, error as Error);
        this.analysisQueue.delete(logId);
      }
    }

    this.isProcessing = false;
    console.log('✅ [BackgroundAnalysis] Обробка черги завершена');
  }

  /**
   * Аналізує одне тренування
   */
  private async analyzeWorkout(queueItem: {
    log: WorkoutLog;
    userProfile: UserProfile;
    dayPlan: DailyWorkoutPlan;
    previousLogs: WorkoutLog[];
    saveWorkoutLog: (log: WorkoutLog) => Promise<WorkoutLog>;
  }): Promise<void> {
    const { log, userProfile, dayPlan, previousLogs, saveWorkoutLog } = queueItem;
    
    console.log('🧠 [BackgroundAnalysis] Аналізуємо тренування:', log.id);

    // Перевіряємо чи можемо робити AI запити
    if (!isOnline()) {
      console.log('📵 [BackgroundAnalysis] Офлайн - відкладаємо аналіз');
      return;
    }

    if (!quotaManager.canMakeRequest()) {
      console.log('⚠️ [BackgroundAnalysis] Ліміт AI запитів - відкладаємо аналіз');
      return;
    }

    // Позначаємо що аналіз розпочато
    const analyzingLog = {
      ...log,
      analysisStatus: 'analyzing' as const
    };
    await saveWorkoutLog(analyzingLog);

    try {
      // Генеруємо розумний аналіз з AI
      const analysisResult = await this.generateIntelligentAnalysis(
        userProfile,
        dayPlan,
        log,
        previousLogs
      );

      // Зберігаємо результати аналізу
      const completedLog = {
        ...log,
        analysisStatus: 'completed' as const,
        analysisCompletedAt: new Date(),
        nextWorkoutRecommendations: analysisResult.nextWorkoutRecommendations,
        recommendation: analysisResult.overallRecommendation
      };

      await saveWorkoutLog(completedLog);
      console.log('✅ [BackgroundAnalysis] Аналіз завершено успішно для:', log.id);

    } catch (error) {
      console.error('❌ [BackgroundAnalysis] Помилка AI аналізу:', error);
      throw error;
    }
  }

  /**
   * Генерує розумний аналіз тренування з AI
   */
  private async generateIntelligentAnalysis(
    userProfile: UserProfile,
    dayPlan: DailyWorkoutPlan,
    workoutLog: WorkoutLog,
    previousLogs: WorkoutLog[]
  ): Promise<{
    nextWorkoutRecommendations: ExerciseRecommendation[];
    overallRecommendation: { text: string; action: string };
  }> {
    console.log('🧠 [BackgroundAnalysis] Генеруємо розумний аналіз з AI');

    // Створюємо детальний промпт для аналізу
    const analysisPrompt = this.createAnalysisPrompt(userProfile, dayPlan, workoutLog, previousLogs);
    
    try {
      // Використовуємо існуючий сервіс, але з розширеним промптом
      const result = await generateWorkoutAnalysis({
        userProfile,
        dayPlan,
        lastWorkoutLog: workoutLog,
        previousWorkoutLogs: previousLogs,
        customPrompt: analysisPrompt
      });

      // Обробляємо результат для наступного тренування
      const nextWorkoutRecommendations = this.processRecommendationsForNextWorkout(
        result.dailyRecommendations,
        dayPlan,
        workoutLog
      );

      return {
        nextWorkoutRecommendations,
        overallRecommendation: result.recommendation
      };

    } catch (error) {
      console.error('❌ [BackgroundAnalysis] Помилка генерації AI аналізу:', error);
      
      // Fallback - створюємо базові рекомендації
      return this.createFallbackRecommendations(dayPlan, workoutLog);
    }
  }

  /**
   * Створює детальний промпт для аналізу тренування
   */
  private createAnalysisPrompt(
    userProfile: UserProfile,
    dayPlan: DailyWorkoutPlan,
    workoutLog: WorkoutLog,
    previousLogs: WorkoutLog[]
  ): string {
    const completedExercises = workoutLog.loggedExercises || [];
    const skippedExercises = dayPlan.exercises.filter(ex => 
      !completedExercises.some(logged => logged.exerciseName === ex.name)
    );

    return `
АНАЛІЗ ТРЕНУВАННЯ ДЛЯ НАСТУПНОЇ СЕСІЇ:

ПРОФІЛЬ КОРИСТУВАЧА:
- Рівень: ${userProfile.experienceLevel}
- Мета: ${userProfile.goal}
- Проблеми здоров'я: ${userProfile.healthProfile?.conditions?.filter(c => c.isActive).map(c => c.condition).join(', ') || 'Немає'}

ВИКОНАНЕ ТРЕНУВАННЯ (День ${workoutLog.dayCompleted}):
- Тривалість: ${Math.floor((workoutLog.duration || 0) / 60)} хвилин
- Виконано вправ: ${completedExercises.length} з ${dayPlan.exercises.length}
- Самопочуття: ${workoutLog.wellnessCheck ? `Енергія: ${workoutLog.wellnessCheck.energyLevel}, Мотивація: ${workoutLog.wellnessCheck.motivation}/10` : 'Не вказано'}

ДЕТАЛІ ВИКОНАННЯ (КОНКРЕТНІ ЦИФРИ):
${completedExercises.map(ex => {
  const totalVolume = ex.loggedSets?.reduce((sum, set) => 
    sum + ((set.weightUsed || 0) * (set.repsAchieved || 0)), 0) || 0;
  
  const setsDetails = ex.loggedSets?.map((set, index) => 
    `Підхід ${index + 1}: ${set.repsAchieved || 0} повт. @ ${set.weightUsed || 0}кг`
  ).join(', ') || 'Деталі відсутні';
  
  return `- ${ex.exerciseName}:
    * Всього підходів: ${ex.loggedSets?.length || 0}
    * Деталі: ${setsDetails}
    * Загальний об'єм: ${totalVolume}кг`;
}).join('\n')}

${skippedExercises.length > 0 ? `ПРОПУЩЕНІ ВПРАВИ:\n${skippedExercises.map(ex => `- ${ex.name}: ${ex.sets} підходів по ${ex.reps}`).join('\n')}` : ''}

ІСТОРІЯ (останні ${Math.min(3, previousLogs.length)} тренувань):
${previousLogs.slice(0, 3).map(log => {
  const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
  return `- ${logDate.toLocaleDateString()}: ${log.loggedExercises?.length || 0} вправ, ${Math.floor((log.duration || 0) / 60)} хв`;
}).join('\n')}

ЗАВДАННЯ:
Ти персональний тренер, який знає цього користувача. Дай ЖИВІ, ПЕРСОНАЛІЗОВАНІ рекомендації:

1. Проаналізуй прогрес по кожній вправі КОНКРЕТНО для цього користувача
2. Врахуй пропущені вправи та дай поради як їх інтегрувати
3. Адаптуй навантаження на основі РЕАЛЬНОГО виконання
4. Врахуй самопочуття та проблеми здоров'я
5. Дай КОНКРЕТНІ, ПЕРСОНАЛЬНІ рекомендації для НАСТУПНОГО тренування

СТИЛЬ РЕКОМЕНДАЦІЙ:
- Говори як досвідчений тренер, який знає цього користувача особисто
- Використовуй конкретні цифри з його виконання
- Будь коротким та по суті - максимум 2-3 речення на рекомендацію
- Говори простою мовою, як реальний тренер в залі
- Мотивуй, але не перебільшуй - реалістично оцінюй прогрес

ФОРМАТ ВІДПОВІДІ JSON:
{
  "recommendations": [
    {
      "exerciseName": "назва вправи",
      "recommendation": "КОНКРЕТНА персональна рекомендація з можна трохи з цифрами та мотивацією",
      "reason": "Детальне пояснення ЧОМУ саме така рекомендація на основі його виконання",
      "suggestedWeight": число_або_null,
      "suggestedReps": "діапазон_або_null",
      "suggestedSets": число_або_null,
      "action": "increase_weight/decrease_weight/maintain/focus_technique"
    }
  ],
  "overallRecommendation": {
    "text": "Загальна персональна оцінка тренування з мотивацією",
    "action": "maintain"
  }
}

ПРИКЛАД ХОРОШОЇ РЕКОМЕНДАЦІЇ:
"Відмінна робота з присіданнями! Ти впевнено виконав всі 4 підходи по 10 повторень з 60кг. Твоя техніка стабільна, тому на наступному тренуванні спробуй збільшити вагу до 62.5кг. Це допоможе тобі прогресувати до твоєї мети набору м'язової маси."

КРИТИЧНО ВАЖЛИВО:
- ЗАВЖДИ використовуй ТОЧНІ цифри з "ДЕТАЛІ ВИКОНАННЯ"
- НЕ вигадуй цифри - бери тільки реальні дані
- Якщо користувач робив 70кг - рекомендуй вагу індивідуально до його можливостей
- Враховуй РЕАЛЬНУ кількість підходів та повторень
- Збільшуй вагу згідно правельних методик тренування
- Якщо користувач не зміг виконати всі повторення - рекомендуй зменшити вагу

УНИКАЙ:
- Загальних фраз типу "підтримуйте поточну вагу"
- Нереалістичних стрибків у вазі (більше 10кг)
- Ігнорування реальних цифр з тренування
`;
  }

  /**
   * Обробляє рекомендації для наступного тренування
   */
  private processRecommendationsForNextWorkout(
    dailyRecommendations: any[],
    dayPlan: DailyWorkoutPlan,
    workoutLog: WorkoutLog
  ): ExerciseRecommendation[] {
    const completedExercises = workoutLog.loggedExercises || [];
    const recommendations: ExerciseRecommendation[] = [];

    // Рекомендації для виконаних вправ
    dailyRecommendations.forEach(rec => {
      recommendations.push({
        exerciseName: rec.exerciseName,
        recommendation: rec.recommendation,
        suggestedWeight: rec.suggestedWeight,
        suggestedReps: rec.suggestedReps,
        suggestedSets: rec.suggestedSets,
        reason: rec.reason || 'На основі аналізу виконання',
        action: rec.action || 'maintain'
      });
    });

    // Рекомендації для пропущених вправ
    const skippedExercises = dayPlan.exercises.filter(ex => 
      !completedExercises.some(logged => logged.exerciseName === ex.name)
    );

    skippedExercises.forEach(exercise => {
      recommendations.push({
        exerciseName: exercise.name,
        recommendation: `Вправу було пропущено в минулому тренуванні. Рекомендуємо виконати її в наступний раз для повноцінного розвитку.`,
        reason: 'Вправа була пропущена',
        action: 'maintain'
      });
    });

    return recommendations;
  }

  /**
   * Створює базові рекомендації якщо AI недоступний
   * Генерує специфічні рекомендації для кожної вправи на основі типу вправи та виконання
   */
  private createFallbackRecommendations(
    dayPlan: DailyWorkoutPlan,
    workoutLog: WorkoutLog
  ): {
    nextWorkoutRecommendations: ExerciseRecommendation[];
    overallRecommendation: { text: string; action: string };
  } {
    const completedExercises = workoutLog.loggedExercises || [];
    const recommendations: ExerciseRecommendation[] = [];

    // Базові рекомендації для виконаних вправ
    completedExercises.forEach(loggedEx => {
      // Знаходимо оригінальну вправу з плану для отримання weightType
      const originalExercise = dayPlan.exercises.find(ex => ex.name === loggedEx.exerciseName);
      
      // Використовуємо універсальну систему генерації рекомендацій
      const recommendation = generateExerciseRecommendation(
        originalExercise || { name: loggedEx.exerciseName, weightType: 'total' } as any,
        loggedEx,
        loggedEx.completedSuccessfully
      );
      
      recommendations.push({
        exerciseName: loggedEx.exerciseName,
        recommendation: recommendation.text,
        suggestedWeight: recommendation.suggestedWeight,
        reason: 'Базова рекомендація на основі типу вправи та виконання',
        action: recommendation.action as any
      });
    });

    // Рекомендації для пропущених вправ
    const skippedExercises = dayPlan.exercises.filter(ex => 
      !completedExercises.some(logged => logged.exerciseName === ex.name)
    );

    skippedExercises.forEach(exercise => {
      const exerciseName = exercise.name.toLowerCase();
      let recommendationText = '';
      
      if (exerciseName.includes('присідання') || exerciseName.includes('squat')) {
        recommendationText = 'Вправу було пропущено. Присідання важливі для розвитку ніг - спробуйте виконати в наступному тренуванні.';
      } else if (exerciseName.includes('тяга') || exerciseName.includes('row') || exerciseName.includes('pull')) {
        recommendationText = 'Вправу було пропущено. Тяги важливі для розвитку спини - спробуйте виконати в наступному тренуванні.';
      } else if (exerciseName.includes('жим') || exerciseName.includes('press')) {
        recommendationText = 'Вправу було пропущено. Жими важливі для розвитку грудей та плечей - спробуйте виконати в наступному тренуванні.';
      } else {
        recommendationText = 'Вправу було пропущено. Спробуйте виконати її в наступному тренуванні для збалансованого розвитку.';
      }
      
      recommendations.push({
        exerciseName: exercise.name,
        recommendation: recommendationText,
        reason: 'Вправа була пропущена',
        action: 'maintain'
      });
    });

    return {
      nextWorkoutRecommendations: recommendations,
      overallRecommendation: {
        text: 'Тренування проаналізовано. Дотримуйтесь рекомендацій для кожної вправи.',
        action: 'maintain'
      }
    };
  }

  /**
   * Позначає аналіз як невдалий
   */
  private async markAnalysisAsFailed(
    queueItem: {
      log: WorkoutLog;
      saveWorkoutLog: (log: WorkoutLog) => Promise<WorkoutLog>;
    },
    error: Error
  ): Promise<void> {
    const { log, saveWorkoutLog } = queueItem;
    
    const failedLog = {
      ...log,
      analysisStatus: 'failed' as const,
      analysisCompletedAt: new Date()
    };

    try {
      await saveWorkoutLog(failedLog);
      console.log('⚠️ [BackgroundAnalysis] Аналіз позначено як невдалий:', log.id);
    } catch (saveError) {
      console.error('❌ [BackgroundAnalysis] Помилка збереження невдалого аналізу:', saveError);
    }
  }

  /**
   * Повторює невдалі аналізи при відновленні мережі
   */
  async retryFailedAnalyses(
    workoutLogs: WorkoutLog[],
    userProfile: UserProfile,
    workoutPlan: any[],
    saveWorkoutLog: (log: WorkoutLog) => Promise<WorkoutLog>
  ): Promise<void> {
    const failedLogs = workoutLogs.filter(log => 
      log.analysisStatus === 'failed' || log.analysisStatus === 'pending'
    );

    if (failedLogs.length === 0) {
      return;
    }

    console.log('🔄 [BackgroundAnalysis] Повторюємо невдалі аналізи:', failedLogs.length);

    for (const log of failedLogs) {
      if (!log.dayCompleted) continue;
      
      const dayPlan = workoutPlan.find(day => day.day === log.dayCompleted);
      if (!dayPlan) continue;

      const previousLogs = workoutLogs.filter(l => 
        l.id !== log.id && 
        l.analysisStatus === 'completed'
      ).slice(0, 5);

      await this.queueWorkoutForAnalysis(
        log,
        userProfile,
        dayPlan,
        previousLogs,
        saveWorkoutLog
      );
    }
  }

  /**
   * Отримує рекомендації для конкретного дня
   */
  getRecommendationsForDay(workoutLogs: WorkoutLog[], dayNumber: number): ExerciseRecommendation[] {
    
    // Знаходимо останній завершений аналіз для цього дня
    const candidateLogs = workoutLogs.filter(log => 
      log.dayCompleted === dayNumber && 
      log.analysisStatus === 'completed'
    );
    
    const lastAnalyzedLog = candidateLogs
      .filter(log => log.nextWorkoutRecommendations)
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date.seconds * 1000);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date.seconds * 1000);
        return dateB.getTime() - dateA.getTime();
      })[0];

    return lastAnalyzedLog?.nextWorkoutRecommendations || [];
  }
}

// Експортуємо singleton instance
export const backgroundAnalysisService = BackgroundWorkoutAnalysisService.getInstance();
