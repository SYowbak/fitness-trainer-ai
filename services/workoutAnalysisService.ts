import { UserProfile, DailyWorkoutPlan, WorkoutLog, WorkoutAnalysisResult } from '../types';
import { generateWorkoutAnalysis, generateExerciseVariations, shouldVaryExercise } from './geminiService';

export const analyzeWorkout = async (
  userProfile: UserProfile,
  dayPlan: DailyWorkoutPlan,
  lastWorkoutLog: WorkoutLog | null,
  previousWorkoutLogs: WorkoutLog[] = []
): Promise<WorkoutAnalysisResult> => {
  try {
    const analysis = await generateWorkoutAnalysis({
      userProfile,
      dayPlan,
      lastWorkoutLog,
      previousWorkoutLogs
    });

    return {
      updatedPlan: analysis.updatedPlan,
      recommendation: analysis.recommendation,
      dailyRecommendations: analysis.dailyRecommendations.map(rec => ({
        ...rec,
        action: 'maintain' as const // Додаємо обов'язкове поле action з дефолтним значенням
      }))
    };
  } catch (error) {
    console.error('Помилка при аналізі тренування:', error);
    throw new Error('Не вдалося проаналізувати тренування');
  }
};

export const getExerciseVariations = async (
  userProfile: UserProfile,
  exercise: any,
  workoutHistory: WorkoutLog[],
  targetMuscleGroup: string
): Promise<any[]> => {
  try {
    // Перевіряємо чи потрібно варіювати вправу
    if (shouldVaryExercise(exercise.name, workoutHistory)) {
      const variations = await generateExerciseVariations(
        userProfile,
        exercise,
        workoutHistory,
        targetMuscleGroup
      );
      return variations;
    }
    return [];
  } catch (error) {
    console.error('Помилка при отриманні варіацій вправ:', error);
    return [];
  }
};

export const analyzeProgressTrends = (workoutHistory: WorkoutLog[]): {
  overallProgress: 'improving' | 'plateau' | 'declining';
  strengthProgress: number;
  enduranceProgress: number;
  consistencyScore: number;
} => {
  if (workoutHistory.length < 2) {
    return {
      overallProgress: 'plateau',
      strengthProgress: 0,
      enduranceProgress: 0,
      consistencyScore: 0
    };
  }

  const recentWorkouts = workoutHistory.slice(0, 5);
  let totalWeight = 0;
  let totalReps = 0;
  let completedWorkouts = 0;

  recentWorkouts.forEach(workout => {
    workout.loggedExercises.forEach(exercise => {
      exercise.loggedSets.forEach(set => {
        if (set.weightUsed) totalWeight += set.weightUsed;
        if (set.repsAchieved) totalReps += set.repsAchieved;
      });
    });
    if (workout.loggedExercises.length > 0) completedWorkouts++;
  });

  const avgWeight = totalWeight / Math.max(1, recentWorkouts.length);
  const avgReps = totalReps / Math.max(1, recentWorkouts.length);
  const consistencyScore = (completedWorkouts / recentWorkouts.length) * 100;

  // Простий аналіз тренду (можна покращити)
  const overallProgress = consistencyScore > 80 ? 'improving' : 
                         consistencyScore > 60 ? 'plateau' : 'declining';

  return {
    overallProgress,
    strengthProgress: avgWeight,
    enduranceProgress: avgReps,
    consistencyScore
  };
}; 