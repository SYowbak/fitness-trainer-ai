import { UserProfile, DailyWorkoutPlan, WorkoutLog, WorkoutAnalysisResult, Exercise } from '../types';
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
  exercise: Exercise,
  workoutHistory: WorkoutLog[],
  targetMuscleGroup: string
): Promise<Exercise[]> => {
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

  // Сортуємо тренування від найновіших до найстаріших
  const sortedWorkouts = [...workoutHistory].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date : new Date(a.date.seconds * 1000);
    const dateB = b.date instanceof Date ? b.date : new Date(b.date.seconds * 1000);
    return dateB.getTime() - dateA.getTime();
  });

  // Беремо останні 10 тренувань для аналізу
  const recentWorkouts = sortedWorkouts.slice(0, 10);
  
  // Розділяємо на дві групи для порівняння
  const newerHalf = recentWorkouts.slice(0, Math.ceil(recentWorkouts.length / 2));
  const olderHalf = recentWorkouts.slice(Math.ceil(recentWorkouts.length / 2));

  // Функція для розрахунку метрик групи
  const calculateGroupMetrics = (workouts: WorkoutLog[]) => {
    let totalWeight = 0;
    let totalReps = 0;
    let totalSets = 0;
    let completedWorkouts = 0;
    let totalVolume = 0; // вага × повторення для всіх підходів

    workouts.forEach(workout => {
      if (workout.loggedExercises && Array.isArray(workout.loggedExercises) && workout.loggedExercises.length > 0) {
        completedWorkouts++;
        workout.loggedExercises.forEach(exercise => {
          if (exercise.loggedSets && Array.isArray(exercise.loggedSets)) {
            exercise.loggedSets.forEach(set => {
              if (set.weightUsed && set.repsAchieved && set.completed) {
                totalWeight += set.weightUsed;
                totalReps += set.repsAchieved;
                totalSets++;
                totalVolume += set.weightUsed * set.repsAchieved;
              }
            });
          }
        });
      }
    });

    return {
      avgWeightPerSet: totalSets > 0 ? totalWeight / totalSets : 0,
      avgRepsPerSet: totalSets > 0 ? totalReps / totalSets : 0,
      avgVolumePerSet: totalSets > 0 ? totalVolume / totalSets : 0,
      completionRate: workouts.length > 0 ? (completedWorkouts / workouts.length) * 100 : 0,
      totalSets
    };
  };

  const newerMetrics = calculateGroupMetrics(newerHalf);
  const olderMetrics = calculateGroupMetrics(olderHalf);

  // Розраховуємо відсоток покращення
  const weightImprovement = olderMetrics.avgWeightPerSet > 0 
    ? ((newerMetrics.avgWeightPerSet - olderMetrics.avgWeightPerSet) / olderMetrics.avgWeightPerSet) * 100 
    : 0;
  
  const repsImprovement = olderMetrics.avgRepsPerSet > 0 
    ? ((newerMetrics.avgRepsPerSet - olderMetrics.avgRepsPerSet) / olderMetrics.avgRepsPerSet) * 100 
    : 0;
    
  const volumeImprovement = olderMetrics.avgVolumePerSet > 0 
    ? ((newerMetrics.avgVolumePerSet - olderMetrics.avgVolumePerSet) / olderMetrics.avgVolumePerSet) * 100 
    : 0;

  // Визначаємо загальний тренд на основі покращень
  let overallProgress: 'improving' | 'plateau' | 'declining';
  
  // Комбінований показник прогресу (вага має більший вплив для силових тренувань)
  const combinedProgress = (weightImprovement * 0.4) + (repsImprovement * 0.3) + (volumeImprovement * 0.3);
  
  if (combinedProgress > 5) {
    overallProgress = 'improving';
  } else if (combinedProgress < -5) {
    overallProgress = 'declining';
  } else {
    overallProgress = 'plateau';
  }

  // Розраховуємо консистентність
  const consistencyScore = Math.min(100, newerMetrics.completionRate);

  return {
    overallProgress,
    strengthProgress: Math.round(newerMetrics.avgWeightPerSet * 10) / 10, // Округлюємо до 1 знака після коми
    enduranceProgress: Math.round(newerMetrics.avgRepsPerSet * 10) / 10,
    consistencyScore: Math.round(consistencyScore)
  };
}; 