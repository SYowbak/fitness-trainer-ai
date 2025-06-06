import { WorkoutLog, LoggedExercise, Exercise, UserProfile, ExperienceLevel, FitnessGoal } from '../types';

// Константи для розрахунку прогресу
const PROGRESS_CONSTANTS = {
  MIN_SUCCESS_RATE: 0.7, // 70% успішних виконань для прогресу
  MAX_FAILURES: 2, // Максимальна кількість послідовних невдач
  ADAPTATION_PERIOD: 3, // Кількість тренувань для адаптації до нової ваги
  REGRESSION_PERCENTAGE: 0.9, // Зменшення ваги при регресії (90% від поточної)
  WEIGHT_INCREMENT: {
    [ExperienceLevel.BEGINNER]: 2.5, // кг
    [ExperienceLevel.INTERMEDIATE]: 2.5, // кг
    [ExperienceLevel.ADVANCED]: 5.0 // кг
  },
  // Константи для різних цілей тренувань
  GOAL_SETTINGS: {
    [FitnessGoal.STRENGTH]: {
      REPS_RANGE: { min: 3, max: 6 },
      SETS_RANGE: { min: 4, max: 6 },
      WEIGHT_INCREMENT_MULTIPLIER: 1.2 // Більший приріст ваги
    },
    [FitnessGoal.MUSCLE_GAIN]: {
      REPS_RANGE: { min: 8, max: 12 },
      SETS_RANGE: { min: 3, max: 4 },
      WEIGHT_INCREMENT_MULTIPLIER: 1.0 // Стандартний приріст ваги
    },
    [FitnessGoal.ENDURANCE]: {
      REPS_RANGE: { min: 12, max: 20 },
      SETS_RANGE: { min: 3, max: 4 },
      WEIGHT_INCREMENT_MULTIPLIER: 0.8 // Менший приріст ваги
    },
    [FitnessGoal.WEIGHT_LOSS]: {
      REPS_RANGE: { min: 12, max: 15 },
      SETS_RANGE: { min: 3, max: 4 },
      WEIGHT_INCREMENT_MULTIPLIER: 0.7 // Менший приріст ваги
    },
    [FitnessGoal.GENERAL_FITNESS]: {
      REPS_RANGE: { min: 8, max: 15 },
      SETS_RANGE: { min: 3, max: 4 },
      WEIGHT_INCREMENT_MULTIPLIER: 1.0 // Стандартний приріст ваги
    }
  }
};

interface ExerciseProgress {
  exerciseName: string;
  currentWeight: number; // Цільова вага з останнього логу
  currentReps: number;   // Цільові повторення з останнього логу (або з плану)
  currentSets: number;   // Цільові підходи з останнього логу (або з плану)
  averageLoggedWeight: number; // Середня фактична вага за підходи в останньому тренуванні
  averageLoggedReps: number;   // Середня фактична кількість повторень за підходи в останньому тренуванні
  successRate: number;
  consecutiveFailures: number;
  adaptationCount: number;
  lastWorkoutDate: Date;
  recommendedWeight: number;
  recommendedReps: number; // Рекомендована кількість повторень
  recommendedSets: number; // Рекомендована кількість підходів
  recommendationReason: string;
}

export class ProgressCalculator {
  private workoutLogs: WorkoutLog[];
  private userProfile: UserProfile;

  constructor(workoutLogs: WorkoutLog[], userProfile: UserProfile) {
    this.workoutLogs = workoutLogs;
    this.userProfile = userProfile;
  }

  private getExerciseHistory(exerciseName: string): { exercise: LoggedExercise; date: Date }[] {
    return this.workoutLogs
      .flatMap(log => {
        const logDate = log.date instanceof Date 
          ? log.date 
          : new Date(log.date.seconds * 1000);
        
        return log.loggedExercises
          .filter(ex => ex.exerciseName === exerciseName)
          .map(ex => ({ exercise: ex, date: logDate }));
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private calculateExerciseProgress(exerciseName: string): ExerciseProgress {
    const history = this.getExerciseHistory(exerciseName);
    if (history.length === 0) {
      return this.getInitialProgress(exerciseName);
    }

    const latestWorkoutEntry = history[0];
    const latestWorkout = latestWorkoutEntry.exercise;
    const workoutDate = latestWorkoutEntry.date;

    const weightIncrement = PROGRESS_CONSTANTS.WEIGHT_INCREMENT[this.userProfile.experienceLevel];
    
    const requiredReps = typeof latestWorkout.originalReps === 'string' 
      ? parseInt(latestWorkout.originalReps.split('-')[0], 10) || 0
      : (latestWorkout.originalReps || 0);
    const requiredSets = typeof latestWorkout.originalSets === 'string'
      ? parseInt(latestWorkout.originalSets.split('-')[0], 10) || 0
      : (latestWorkout.originalSets || 0);
    const targetWeight = latestWorkout.targetWeightAtLogging || 0;

    // Розрахунок середньої фактичної ваги та повторень з залогованих підходів
    let totalLoggedWeight = 0;
    let totalLoggedReps = 0;
    let totalLoggedSets = 0;
    const validLoggedSets = (Array.isArray(latestWorkout.loggedSets) ? latestWorkout.loggedSets : []).filter(set => 
      (set.repsAchieved !== undefined && set.repsAchieved !== null && !isNaN(set.repsAchieved)) || 
      (set.weightUsed !== undefined && set.weightUsed !== null && !isNaN(set.weightUsed))
    );

    validLoggedSets.forEach(set => {
      totalLoggedReps += set.repsAchieved ?? 0;
      totalLoggedWeight += set.weightUsed ?? 0;
      totalLoggedSets += 1;
    });

    const averageLoggedReps = validLoggedSets.length > 0 ? totalLoggedReps / validLoggedSets.length : 0;
    const averageLoggedWeight = validLoggedSets.length > 0 ? totalLoggedWeight / validLoggedSets.length : 0;
    const averageLoggedSets = validLoggedSets.length > 0 ? totalLoggedSets / validLoggedSets.length : 0;

    // Уточнена логіка успішності: Вправа успішна, якщо виконано заплановану кількість підходів
    // АБО успішно виконано достатньо підходів (хоча б MIN_SUCCESS_RATE від plannedSets), де успіх підходу
    // визначається досягненням цільової ваги та повторень.
    
    // Простий критерій успіху підходу: виконано >= plannedReps * 0.9 І вага >= targetWeight * 0.9
    const thresholdReps = requiredReps > 0 ? requiredReps * 0.9 : 0;
    const thresholdWeight = targetWeight > 0 ? targetWeight * 0.9 : 0;

    const successfulSetsBasedOnThreshold = (Array.isArray(latestWorkout.loggedSets) ? latestWorkout.loggedSets : []).filter(set => {
      const meetsReps = set.repsAchieved !== undefined && set.repsAchieved !== null && set.repsAchieved >= thresholdReps;
      const meetsWeight = set.weightUsed !== undefined && set.weightUsed !== null && set.weightUsed >= thresholdWeight;
      
      // Підхід успішний, якщо він відповідає критеріям по повторенням та вазі (якщо цільові значення > 0)
      // Або якщо вказано тільки повторення і вони досягнуті (якщо targetWeight === 0)
      // Або якщо вказано тільки вагу і вона досягнута (якщо targetReps === 0)
      if (requiredReps > 0 && targetWeight > 0) return meetsReps && meetsWeight;
      if (requiredReps > 0 && targetWeight === 0) return meetsReps;
      if (requiredReps === 0 && targetWeight > 0) return meetsWeight;
      
      // Якщо цільові повторення та вага не вказані, будь-який залогований підхід вважається успішним
      return (set.repsAchieved !== undefined && set.repsAchieved !== null) || (set.weightUsed !== undefined && set.weightUsed !== null);

    }).length;

    // Вправа успішна, якщо кількість успішних підходів >= MIN_SUCCESS RATE від plannedSets
    const exerciseCompletedSuccessfullyForProgress = requiredSets > 0 
      ? (successfulSetsBasedOnThreshold / requiredSets) >= PROGRESS_CONSTANTS.MIN_SUCCESS_RATE
      : successfulSetsBasedOnThreshold > 0; // Якщо підходи не вказані в плані, будь-який успішний підхід вважається успіхом


    // Розрахунок успішності на основі останніх тренувань (використовуємо новий прапор успішності)
    const recentHistory = history.slice(0, 5);
    const successRate = recentHistory
      .reduce((sum, entry) => {
        // Перераховуємо успішність для кожної історичної вправи на основі її loggedSets
        const historicalRequiredReps = typeof entry.exercise.originalReps === 'string' 
          ? parseInt(entry.exercise.originalReps.split('-')[0], 10) || 0
          : (entry.exercise.originalReps || 0);
        const historicalRequiredSets = typeof entry.exercise.originalSets === 'string'
          ? parseInt(entry.exercise.originalSets.split('-')[0], 10) || 0
          : (entry.exercise.originalSets || 0);
        const historicalTargetWeight = entry.exercise.targetWeightAtLogging || 0;
        
        const historicalThresholdReps = historicalRequiredReps > 0 ? historicalRequiredReps * 0.9 : 0;
        const historicalThresholdWeight = historicalTargetWeight > 0 ? historicalTargetWeight * 0.9 : 0;
        
        const historicalSuccessfulSets = (Array.isArray(entry.exercise.loggedSets) ? entry.exercise.loggedSets : []).filter(set => {
          const meetsReps = set.repsAchieved !== undefined && set.repsAchieved !== null && set.repsAchieved >= historicalThresholdReps;
          const meetsWeight = set.weightUsed !== undefined && set.weightUsed !== null && set.weightUsed >= historicalThresholdWeight;
          
          if (historicalRequiredReps > 0 && historicalTargetWeight > 0) return meetsReps && meetsWeight;
          if (historicalRequiredReps > 0 && historicalTargetWeight === 0) return meetsReps;
          if (historicalRequiredReps === 0 && historicalTargetWeight > 0) return meetsWeight;

          return (set.repsAchieved !== undefined && set.repsAchieved !== null) || (set.weightUsed !== undefined && set.weightUsed !== null);
        }).length;

        const historicalExerciseSuccess = historicalRequiredSets > 0 
          ? (historicalSuccessfulSets / historicalRequiredSets) >= PROGRESS_CONSTANTS.MIN_SUCCESS_RATE
          : historicalSuccessfulSets > 0;

        return sum + (historicalExerciseSuccess ? 1 : 0);
      }, 0) / Math.min(5, history.length);

    // Підрахунок послідовних невдач (використовуємо новий прапор успішності)
    let consecutiveFailures = 0;
    for (const entry of history) {
      // Перераховуємо успішність для кожної історичної вправи
      const historicalRequiredReps = typeof entry.exercise.originalReps === 'string' 
        ? parseInt(entry.exercise.originalReps.split('-')[0], 10) || 0
        : (entry.exercise.originalReps || 0);
      const historicalRequiredSets = typeof entry.exercise.originalSets === 'string'
        ? parseInt(entry.exercise.originalSets.split('-')[0], 10) || 0
        : (entry.exercise.originalSets || 0);
      const historicalTargetWeight = entry.exercise.targetWeightAtLogging || 0;
      
      const historicalThresholdReps = historicalRequiredReps > 0 ? historicalRequiredReps * 0.9 : 0;
      const historicalThresholdWeight = historicalTargetWeight > 0 ? historicalTargetWeight * 0.9 : 0;
      
      const historicalSuccessfulSets = (Array.isArray(entry.exercise.loggedSets) ? entry.exercise.loggedSets : []).filter(set => {
        const meetsReps = set.repsAchieved !== undefined && set.repsAchieved !== null && set.repsAchieved >= historicalThresholdReps;
        const meetsWeight = set.weightUsed !== undefined && set.weightUsed !== null && set.weightUsed >= historicalThresholdWeight;

        if (historicalRequiredReps > 0 && historicalTargetWeight > 0) return meetsReps && meetsWeight;
        if (historicalRequiredReps > 0 && historicalTargetWeight === 0) return meetsReps;
        if (historicalRequiredReps === 0 && historicalTargetWeight > 0) return meetsWeight;

        return (set.repsAchieved !== undefined && set.repsAchieved !== null) || (set.weightUsed !== undefined && set.weightUsed !== null);
      }).length;

      const historicalExerciseSuccess = historicalRequiredSets > 0 
        ? (historicalSuccessfulSets / historicalRequiredSets) >= PROGRESS_CONSTANTS.MIN_SUCCESS_RATE
        : historicalSuccessfulSets > 0;

      if (!historicalExerciseSuccess) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Розрахунок адаптації (використовуємо новий прапор успішності)
    const adaptationCount = history
      .slice(0, PROGRESS_CONSTANTS.ADAPTATION_PERIOD)
      .filter(entry => {
        // Перераховуємо успішність для кожної історичної вправи
        const historicalRequiredReps = typeof entry.exercise.originalReps === 'string' 
          ? parseInt(entry.exercise.originalReps.split('-')[0], 10) || 0
          : (entry.exercise.originalReps || 0);
        const historicalRequiredSets = typeof entry.exercise.originalSets === 'string'
          ? parseInt(entry.exercise.originalSets.split('-')[0], 10) || 0
          : (entry.exercise.originalSets || 0);
        const historicalTargetWeight = entry.exercise.targetWeightAtLogging || 0;
        
        const historicalThresholdReps = historicalRequiredReps > 0 ? historicalRequiredReps * 0.9 : 0;
        const historicalThresholdWeight = historicalTargetWeight > 0 ? historicalTargetWeight * 0.9 : 0;
        
        const historicalSuccessfulSets = (Array.isArray(entry.exercise.loggedSets) ? entry.exercise.loggedSets : []).filter(set => {
          const meetsReps = set.repsAchieved !== undefined && set.repsAchieved !== null && set.repsAchieved >= historicalThresholdReps;
          const meetsWeight = set.weightUsed !== undefined && set.weightUsed !== null && set.weightUsed >= historicalThresholdWeight;

          if (historicalRequiredReps > 0 && historicalTargetWeight > 0) return meetsReps && meetsWeight;
          if (historicalRequiredReps > 0 && historicalTargetWeight === 0) return meetsReps;
          if (historicalRequiredReps === 0 && historicalTargetWeight > 0) return meetsWeight;

          return (set.repsAchieved !== undefined && set.repsAchieved !== null) || (set.weightUsed !== undefined && set.weightUsed !== null);
        }).length;

        const historicalExerciseSuccess = historicalRequiredSets > 0 
          ? (historicalSuccessfulSets / historicalRequiredSets) >= PROGRESS_CONSTANTS.MIN_SUCCESS_RATE
          : historicalSuccessfulSets > 0;

        return historicalExerciseSuccess;
      })
      .length;

    let recommendedWeight = targetWeight;
    let recommendedReps = requiredReps; // Початково - цільові повторення з плану
    let recommendedSets = requiredSets; // Початково - цільові підходи з плану
    let recommendationReason = '';

    // Розширена логіка прогресу (вага, повторення, підходи)
    const userLevel = this.userProfile.experienceLevel;
    const userGoal = this.userProfile.goal;
    const goalSettings = PROGRESS_CONSTANTS.GOAL_SETTINGS[userGoal];

    // Адаптуємо діапазони на основі рівня користувача
    const adjustedRepsRange = {
      min: Math.max(goalSettings.REPS_RANGE.min - (userLevel === ExperienceLevel.BEGINNER ? 2 : 0), 1),
      max: goalSettings.REPS_RANGE.max + (userLevel === ExperienceLevel.ADVANCED ? 2 : 0)
    };
    const adjustedSetsRange = {
      min: Math.max(goalSettings.SETS_RANGE.min - (userLevel === ExperienceLevel.BEGINNER ? 1 : 0), 1),
      max: goalSettings.SETS_RANGE.max + (userLevel === ExperienceLevel.ADVANCED ? 1 : 0)
    };

    if (exerciseCompletedSuccessfullyForProgress) {
      if (adaptationCount >= PROGRESS_CONSTANTS.ADAPTATION_PERIOD) {
        // Прогресія ваги з урахуванням цілі та рівня
        const weightIncrementMultiplier = goalSettings.WEIGHT_INCREMENT_MULTIPLIER * 
          (userLevel === ExperienceLevel.BEGINNER ? 0.8 : 
           userLevel === ExperienceLevel.ADVANCED ? 1.2 : 1.0);
        recommendedWeight = targetWeight + (weightIncrement * weightIncrementMultiplier);
        recommendationReason = 'Прогресія ваги - успішне виконання та адаптація';

        // Логіка прогресії повторень/підходів на основі цілі та рівня
        if (averageLoggedReps > requiredReps * 1.1) {
          recommendedReps = Math.min(
            Math.round(averageLoggedReps),
            adjustedRepsRange.max
          );
          recommendationReason += ', розгляньте збільшення повторень';
        } else if (averageLoggedReps < requiredReps * 0.9) {
          recommendedReps = Math.max(
            Math.round(averageLoggedReps),
            adjustedRepsRange.min
          );
          recommendationReason += ', зменшіть повторення для кращої техніки';
        } else {
          recommendedReps = Math.min(
            Math.max(requiredReps, adjustedRepsRange.min),
            adjustedRepsRange.max
          );
        }

        // Логіка прогресії підходів на основі цілі та рівня
        if (averageLoggedSets > requiredSets * 1.1) {
          recommendedSets = Math.min(
            Math.round(averageLoggedSets),
            adjustedSetsRange.max
          );
          if (!recommendationReason.includes('розгляньте збільшення повторень')) {
            recommendationReason += ', розгляньте збільшення підходів';
          } else {
            recommendationReason += ' та підходів';
          }
        } else if (averageLoggedSets < requiredSets * 0.9) {
          recommendedSets = Math.max(
            Math.round(averageLoggedSets),
            adjustedSetsRange.min
          );
          if (!recommendationReason.includes('зменшіть повторення')) {
            recommendationReason += ', зменшіть підходи для кращої техніки';
          } else {
            recommendationReason += ' та підходи';
          }
        } else {
          recommendedSets = Math.min(
            Math.max(requiredSets, adjustedSetsRange.min),
            adjustedSetsRange.max
          );
        }
      } else {
        // Залишити вагу для адаптації
        recommendedWeight = targetWeight;
        recommendedReps = requiredReps;
        recommendedSets = requiredSets;
        recommendationReason = 'Залиште вагу - період адаптації до нового навантаження';
      }
    } else {
      // Вправа не виконана успішно за критеріями прогресії
      if (consecutiveFailures >= PROGRESS_CONSTANTS.MAX_FAILURES) {
        // Регресія ваги з урахуванням цілі та рівня
        const regressionMultiplier = PROGRESS_CONSTANTS.REGRESSION_PERCENTAGE * 
          goalSettings.WEIGHT_INCREMENT_MULTIPLIER * 
          (userLevel === ExperienceLevel.BEGINNER ? 0.9 : 
           userLevel === ExperienceLevel.ADVANCED ? 0.95 : 0.925);
        recommendedWeight = Math.max(0, targetWeight * regressionMultiplier);
        
        // Зменшуємо повторення та підходи до мінімального діапазону для кращої техніки
        recommendedReps = adjustedRepsRange.min;
        recommendedSets = adjustedSetsRange.min;
        recommendationReason = 'Регресія ваги - послідовні невдачі. Фокус на техніці.';
      } else {
        // Залишити вагу, фокус на техніці або обсязі
        recommendedWeight = targetWeight;
        
        // Адаптуємо повторення та підходи на основі цілі, рівня та поточних результатів
        if (averageLoggedReps < requiredReps * 0.8) {
          recommendedReps = Math.max(
            Math.floor(requiredReps * 0.9),
            adjustedRepsRange.min
          );
          recommendationReason = 'Залиште вагу - спростіть повторення для покращення техніки.';
        } else {
          recommendedReps = Math.min(
            Math.max(requiredReps, adjustedRepsRange.min),
            adjustedRepsRange.max
          );
          recommendationReason = 'Залиште вагу - фокус на техніці та виконанні цільового обсягу.';
        }

        if (averageLoggedSets < requiredSets * 0.8) {
          recommendedSets = Math.max(
            Math.floor(requiredSets * 0.9),
            adjustedSetsRange.min
          );
          if (!recommendationReason.includes('спростіть повторення')) {
            recommendationReason = 'Залиште вагу - спростіть підходи для покращення техніки.';
          } else {
            recommendationReason = 'Залиште вагу - спростіть повторення та підходи для покращення техніки.';
          }
        } else {
          recommendedSets = Math.min(
            Math.max(requiredSets, adjustedSetsRange.min),
            adjustedSetsRange.max
          );
        }
      }
    }

    // TODO: Додати логіку зміни кількості підходів (складно і залежить від цілей/рівня)

    // Округлюємо рекомендовану вагу до найближчого кроку (наприклад, 2.5 кг)
    recommendedWeight = Math.round(recommendedWeight / weightIncrement) * weightIncrement;
    recommendedWeight = Math.max(0, recommendedWeight); // Вага не може бути від'ємною

    // Округлюємо рекомендовані повторення та підходи до цілого числа
    recommendedReps = Math.max(1, Math.round(recommendedReps));
    recommendedSets = Math.max(1, Math.round(recommendedSets));

    return {
      exerciseName,
      currentWeight: targetWeight,
      currentReps: requiredReps,
      currentSets: requiredSets,
      averageLoggedWeight,
      averageLoggedReps,
      successRate,
      consecutiveFailures,
      adaptationCount,
      lastWorkoutDate: workoutDate,
      recommendedWeight,
      recommendedReps,
      recommendedSets,
      recommendationReason
    };
  }

  private getInitialProgress(exerciseName: string): ExerciseProgress {
    // Початкові рекомендації для нової вправи - це підібрати вагу для цільових підходів/повторень з плану
    // Оскільки на цьому етапі плану може не бути або він не містить цільових, повертаємо 0, а рекомендація в getProgressRecommendation підкаже підібрати
    return {
      exerciseName,
      currentWeight: 0,
      currentReps: 0, // Початково 0, бо немає історії
      currentSets: 0, // Початково 0, бо немає історії
      averageLoggedWeight: 0,
      averageLoggedReps: 0,
      successRate: 0,
      consecutiveFailures: 0,
      adaptationCount: 0,
      lastWorkoutDate: new Date(),
      recommendedWeight: 0,
      recommendedReps: 0, // Будуть взяті з плану в getProgressRecommendation
      recommendedSets: 0, // Будуть взяті з плану в getProgressRecommendation
      recommendationReason: 'Початкові рекомендації для нової вправи'
    };
  }

  public getProgressRecommendation(exercise: Exercise): string {
    const progress = this.calculateExerciseProgress(exercise.name);
    
    const formatWeight = (weight: number) => weight.toFixed(1);
    
    let recommendation = '';

    // Отримуємо цільові підходи/повторення з поточного плану для нової вправи
    const planReps = typeof exercise.reps === 'string' 
      ? parseInt(exercise.reps.split('-')[0], 10) || '-'
      : (exercise.reps || '-');
    const planSets = typeof exercise.sets === 'string'
      ? parseInt(exercise.sets.split('-')[0], 10) || '-'
      : (exercise.sets || '-');

    if (progress.currentWeight === 0) {
      // Для нової вправи рекомендуємо підібрати вагу, використовуючи підходи/повторення з плану
      recommendation = `Рекомендація для нової вправи: Спробуйте підібрати вагу для ${planSets} підходів по ${planReps} повторень.`;
    } else {
      // Виводимо фактичний результат з останнього тренування та ціль
      recommendation = `Попередній факт. результат: ~${formatWeight(progress.averageLoggedWeight)} кг на ${progress.currentSets || '-'} підходів по ~${progress.averageLoggedReps.toFixed(1)} повторень (ціль: ${formatWeight(progress.currentWeight)} кг, ${progress.currentSets || '-'}x${progress.currentReps || '-'})\n`;
      
      // Виводимо рекомендовану ціль (вага, підходи, повторення)
      recommendation += `Рекомендована ціль на наступне тренування: ${formatWeight(progress.recommendedWeight)} кг, ${progress.recommendedSets} підходів, ${progress.recommendedReps} повторень\n`;
      
      recommendation += `Причина: ${progress.recommendationReason}`;
    }

    return recommendation;
  }

  public getUserLevelInfo(): string {
    // Виправлення попередження лінтера: userLevel використовується тут
    const userLevel = this.userProfile.experienceLevel;
    return `Рівень підготовки: ${userLevel}\nЗагальна кількість тренувань: ${this.workoutLogs.length}`;
  }
} 