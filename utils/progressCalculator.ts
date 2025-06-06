import { WorkoutLog, LoggedExercise, Exercise, UserProfile, ExperienceLevel } from '../types';

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
  }
};

interface ExerciseProgress {
  exerciseName: string;
  currentWeight: number;
  currentReps: number;
  currentSets: number;
  successRate: number;
  consecutiveFailures: number;
  adaptationCount: number;
  lastWorkoutDate: Date;
  recommendedWeight: number;
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

    const latestWorkout = history[0];
    const weightIncrement = PROGRESS_CONSTANTS.WEIGHT_INCREMENT[this.userProfile.experienceLevel];
    
    // Розрахунок успішності
    const successRate = history
      .slice(0, 5) // Аналізуємо останні 5 тренувань
      .reduce((sum, { exercise }) => sum + (exercise.completedSuccessfully ? 1 : 0), 0) / Math.min(5, history.length);

    // Підрахунок послідовних невдач
    let consecutiveFailures = 0;
    for (const { exercise } of history) {
      if (!exercise.completedSuccessfully) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Розрахунок адаптації
    const adaptationCount = history
      .slice(0, PROGRESS_CONSTANTS.ADAPTATION_PERIOD)
      .filter(({ exercise }) => exercise.completedSuccessfully)
      .length;

    // Розрахунок рекомендованої ваги
    let recommendedWeight = latestWorkout.exercise.targetWeightAtLogging || 0;
    let recommendationReason = '';

    // Логіка прогресу
    if (successRate >= PROGRESS_CONSTANTS.MIN_SUCCESS_RATE && adaptationCount >= PROGRESS_CONSTANTS.ADAPTATION_PERIOD) {
      recommendedWeight += weightIncrement;
      recommendationReason = 'Прогресія навантаження - успішне виконання попередніх тренувань';
    } else if (consecutiveFailures >= PROGRESS_CONSTANTS.MAX_FAILURES) {
      recommendedWeight *= PROGRESS_CONSTANTS.REGRESSION_PERCENTAGE;
      recommendationReason = 'Регресія навантаження - необхідна адаптація';
    } else if (adaptationCount < PROGRESS_CONSTANTS.ADAPTATION_PERIOD) {
      recommendationReason = 'Залиште поточну вагу - період адаптації';
    } else {
      recommendationReason = 'Залиште поточну вагу - необхідно покращити техніку';
    }

    return {
      exerciseName,
      currentWeight: latestWorkout.exercise.targetWeightAtLogging || 0,
      currentReps: typeof latestWorkout.exercise.originalReps === 'string' 
        ? parseInt(latestWorkout.exercise.originalReps.split('-')[0], 10) 
        : (latestWorkout.exercise.originalReps || 0),
      currentSets: typeof latestWorkout.exercise.originalSets === 'string'
        ? parseInt(latestWorkout.exercise.originalSets.split('-')[0], 10)
        : (latestWorkout.exercise.originalSets || 0),
      successRate,
      consecutiveFailures,
      adaptationCount,
      lastWorkoutDate: latestWorkout.date,
      recommendedWeight,
      recommendationReason
    };
  }

  private getInitialProgress(exerciseName: string): ExerciseProgress {
    return {
      exerciseName,
      currentWeight: 0,
      currentReps: 0,
      currentSets: 0,
      successRate: 0,
      consecutiveFailures: 0,
      adaptationCount: 0,
      lastWorkoutDate: new Date(),
      recommendedWeight: 0,
      recommendationReason: 'Початкові рекомендації для нової вправи'
    };
  }

  public getProgressRecommendation(exercise: Exercise): string {
    const progress = this.calculateExerciseProgress(exercise.name);
    
    const formatWeight = (weight: number) => weight.toFixed(1);
    
    let recommendation = '';

    if (progress.currentWeight === 0) {
      recommendation = `Рекомендація для нової вправи: ${formatWeight(progress.recommendedWeight)} кг`;
    } else {
      recommendation = `Попередній результат: ${formatWeight(progress.currentWeight)} кг\n`;
      recommendation += `Рекомендація: ${formatWeight(progress.recommendedWeight)} кг\n`;
      recommendation += `Причина: ${progress.recommendationReason}`;
    }

    return recommendation;
  }

  public getUserLevelInfo(): string {
    return `Рівень підготовки: ${this.userProfile.experienceLevel}\nЗагальна кількість тренувань: ${this.workoutLogs.length}`;
  }
} 