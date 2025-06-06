import { UserProfile, DailyWorkoutPlan, WorkoutLog } from '../types';
import { generateWorkoutAnalysis } from './geminiService';

export interface WorkoutAnalysisResult {
  updatedPlan: DailyWorkoutPlan;
  recommendation: {
    text: string;
    action: string;
  };
}

export const analyzeWorkout = async (
  userProfile: UserProfile,
  dayPlan: DailyWorkoutPlan,
  lastWorkoutLog: WorkoutLog | null
): Promise<WorkoutAnalysisResult> => {
  try {
    const analysis = await generateWorkoutAnalysis({
      userProfile,
      dayPlan,
      lastWorkoutLog
    });

    return {
      updatedPlan: analysis.updatedPlan,
      recommendation: analysis.recommendation
    };
  } catch (error) {
    console.error('Помилка при аналізі тренування:', error);
    throw new Error('Не вдалося проаналізувати тренування');
  }
}; 