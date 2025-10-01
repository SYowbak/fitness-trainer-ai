import { UserProfile, DailyWorkoutPlan, WorkoutLog, WorkoutAnalysisResult, Exercise, ExerciseRecommendation } from '../types';
import { generateWorkoutAnalysis, generateExerciseVariations, shouldVaryExercise } from './geminiService';

export const analyzeWorkout = async (
  userProfile: UserProfile,
  dayPlan: DailyWorkoutPlan,
  lastWorkoutLog: WorkoutLog | null,
  previousWorkoutLogs: WorkoutLog[] = []
): Promise<WorkoutAnalysisResult> => {
  try {
    console.log('🔍 Starting workout analysis...', {
      dayNumber: dayPlan.day,
      exerciseCount: dayPlan.exercises.length,
      hasLastLog: !!lastWorkoutLog
    });
    
    const analysis = await generateWorkoutAnalysis({
      userProfile,
      dayPlan,
      lastWorkoutLog,
      previousWorkoutLogs
    });

    console.log('✅ Workout analysis completed successfully');
    
    // Ensure all recommendations have the required action field
    const processedRecommendations: ExerciseRecommendation[] = analysis.dailyRecommendations.map(rec => ({
      exerciseName: rec.exerciseName,
      recommendation: rec.recommendation,
      suggestedWeight: rec.suggestedWeight,
      suggestedReps: rec.suggestedReps,
      suggestedSets: rec.suggestedSets,
      reason: rec.reason,
      action: (rec as any).action || 'maintain' // Ensure action field exists
    }));
    
    return {
      updatedPlan: analysis.updatedPlan,
      recommendation: analysis.recommendation,
      dailyRecommendations: processedRecommendations
    };
  } catch (error) {
    console.error('⚠️ Error during workout analysis:', error);
    
    // Створюємо fallback відповідь замість викидання помилки
    const fallbackResult: WorkoutAnalysisResult = {
      updatedPlan: {
        ...dayPlan,
        notes: dayPlan.notes || 'План залишено без змін'
      },
      recommendation: {
        text: 'Не вдалося провести аналіз тренування. Продовжуйте за попереднім планом.',
        action: 'maintain'
      },
      dailyRecommendations: dayPlan.exercises.map(ex => ({
        exerciseName: ex.name,
        recommendation: 'Продовжуйте виконання за попереднім планом',
        action: 'maintain',
        reason: 'Аналіз недоступний'
      }))
    };
    
    console.log('🔄 Returning fallback analysis result');
    return fallbackResult;
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
    if (shouldVaryExercise(exercise.name, userProfile, workoutHistory)) {
      const variations = await generateExerciseVariations(
        exercise.name,
        userProfile,
        `variation for ${targetMuscleGroup}`
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

  // Фільтруємо тренування з надто великою тривалістю (більше 3 годин) - ймовірно забуті
  const filteredWorkouts = sortedWorkouts.filter(workout => {
    // Якщо тривалість більше 3 годин (10800 секунд), вважаємо її підозрілою
    // Також включаємо тренування без тривалості (старі записи)
    return !workout.duration || workout.duration <= 10800;
  });

  // Якщо після фільтрації залишилося менше 2 тренувань, використовуємо оригінальні
  const validWorkouts = filteredWorkouts.length >= 2 ? filteredWorkouts : sortedWorkouts;
  
  // Беремо останні 10 тренувань для аналізу (або менше, якщо їх менше)
  const recentWorkouts = validWorkouts.slice(0, Math.min(10, validWorkouts.length));
  
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
              // Перевіряємо, чи встановлені значення, навіть якщо completed не визначено
              if (set.weightUsed !== null && set.weightUsed !== undefined && set.repsAchieved !== null && set.repsAchieved !== undefined) {
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
    : (newerMetrics.avgWeightPerSet > 0 ? 100 : 0); // Якщо старе значення 0, а нове > 0, то покращення 100%
  
  const repsImprovement = olderMetrics.avgRepsPerSet > 0 
    ? ((newerMetrics.avgRepsPerSet - olderMetrics.avgRepsPerSet) / olderMetrics.avgRepsPerSet) * 100 
    : (newerMetrics.avgRepsPerSet > 0 ? 100 : 0); // Якщо старе значення 0, а нове > 0, то покращення 100%
    
  const volumeImprovement = olderMetrics.avgVolumePerSet > 0 
    ? ((newerMetrics.avgVolumePerSet - olderMetrics.avgVolumePerSet) / olderMetrics.avgVolumePerSet) * 100 
    : (newerMetrics.avgVolumePerSet > 0 ? 100 : 0); // Якщо старе значення 0, а нове > 0, то покращення 100%

  // Визначаємо загальний тренд на основі покращень
  let overallProgress: 'improving' | 'plateau' | 'declining';
  
  // Комбінований показник прогресу (вага має більший вплив для силових тренувань)
  const combinedProgress = (weightImprovement * 0.4) + (repsImprovement * 0.3) + (volumeImprovement * 0.3);
  
  console.log('📊 Progress Analysis:', {
    weightImprovement: Math.round(weightImprovement * 100) / 100,
    repsImprovement: Math.round(repsImprovement * 100) / 100,
    volumeImprovement: Math.round(volumeImprovement * 100) / 100,
    combinedProgress: Math.round(combinedProgress * 100) / 100,
    newerMetrics,
    olderMetrics
  });
  
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
    strengthProgress: Math.round(weightImprovement * 10) / 10, // Відсоток покращення ваги
    enduranceProgress: Math.round(repsImprovement * 10) / 10, // Відсоток покращення повторень
    consistencyScore: Math.round(consistencyScore)
  };
}; 