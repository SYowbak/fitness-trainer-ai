import { UserProfile, WorkoutLog, Exercise } from '../types';
import { generateExerciseVariations, shouldVaryExercise } from './geminiService';


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

  // Обмежуємо екстремальні значення для більш реалістичного відображення
  const clampedWeightImprovement = Math.max(-100, Math.min(100, weightImprovement));
  const clampedRepsImprovement = Math.max(-100, Math.min(100, repsImprovement));
  const clampedVolumeImprovement = Math.max(-100, Math.min(100, volumeImprovement));

  // Визначаємо загальний тренд на основі покращень
  let overallProgress: 'improving' | 'plateau' | 'declining';
  
  // Комбінований показник прогресу (вага має більший вплив для силових тренувань)
  const combinedProgress = (clampedWeightImprovement * 0.4) + (clampedRepsImprovement * 0.3) + (clampedVolumeImprovement * 0.3);
  
  console.log('📊 Progress Analysis:', {
    workoutCount: workoutHistory.length,
    validWorkoutsCount: validWorkouts.length,
    recentWorkoutsCount: recentWorkouts.length,
    weightImprovement: Math.round(weightImprovement * 100) / 100,
    clampedWeightImprovement: Math.round(clampedWeightImprovement * 100) / 100,
    repsImprovement: Math.round(repsImprovement * 100) / 100,
    clampedRepsImprovement: Math.round(clampedRepsImprovement * 100) / 100,
    volumeImprovement: Math.round(volumeImprovement * 100) / 100,
    clampedVolumeImprovement: Math.round(clampedVolumeImprovement * 100) / 100,
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
    strengthProgress: Math.round(clampedWeightImprovement * 10) / 10, // Відсоток покращення ваги
    enduranceProgress: Math.round(clampedRepsImprovement * 10) / 10, // Відсоток покращення повторень
    consistencyScore: Math.round(consistencyScore)
  };
}; 