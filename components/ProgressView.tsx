import React from 'react';
import { WorkoutLog, UserProfile, LoggedExercise, Exercise, ExerciseProgress } from '../types';
import { UI_TEXT } from '../constants';
import { ProgressCalculator } from '../utils/progressCalculator';

interface ProgressViewProps {
  workoutLogs: WorkoutLog[];
  userProfile: UserProfile | null;
}

interface ExerciseLogRowProps {
  loggedEx: LoggedExercise;
  exerciseProgress: ExerciseProgress | null;
  originalExercise: Exercise | undefined;
}

const ExerciseLogRow: React.FC<ExerciseLogRowProps> = ({ loggedEx, exerciseProgress, originalExercise }) => {
  if (!loggedEx || typeof loggedEx !== 'object') {
    console.warn('Invalid logged exercise data:', loggedEx);
    return null;
  }

  const plannedReps = originalExercise?.reps ?? loggedEx.originalReps;
  const plannedSets = originalExercise?.sets ?? loggedEx.originalSets;
  const plannedWeight = originalExercise?.targetWeight ?? loggedEx.targetWeightAtLogging;

  let totalLoggedWeightActual = 0;
  let totalLoggedRepsActual = 0;
  let totalLoggedSetsActual = 0;
  const validLoggedSetsActual = (Array.isArray(loggedEx.loggedSets) ? loggedEx.loggedSets : []).filter(set =>
    (set.repsAchieved !== undefined && set.repsAchieved !== null && !isNaN(set.repsAchieved)) ||
    (set.weightUsed !== undefined && set.weightUsed !== null && !isNaN(set.weightUsed))
  );

  validLoggedSetsActual.forEach(set => {
    totalLoggedRepsActual += set.repsAchieved ?? 0;
    totalLoggedWeightActual += set.weightUsed ?? 0;
    totalLoggedSetsActual += 1;
  });

  const averageLoggedRepsActual = validLoggedSetsActual.length > 0 ? totalLoggedRepsActual / validLoggedSetsActual.length : 0;
  const averageLoggedWeightActual = validLoggedSetsActual.length > 0 ? totalLoggedWeightActual / validLoggedSetsActual.length : 0;
  const averageLoggedSetsActual = validLoggedSetsActual.length > 0 ? totalLoggedSetsActual / validLoggedSetsActual.length : 0;

  return (
    <div className="p-3 bg-gray-600/50 rounded-md my-2 text-xs sm:text-sm">
      <p className="font-semibold text-yellow-400">{loggedEx.exerciseName || 'Невідома вправа'}</p>
      {(plannedSets !== undefined || plannedReps !== undefined) && (
         <p>План: {plannedSets ?? '-'} x {plannedReps ?? '-'}
           {plannedWeight !== undefined && plannedWeight !== 0 && ` @ ${plannedWeight}kg`}
         </p>
      )}
      {Array.isArray(loggedEx.loggedSets) && loggedEx.loggedSets.length > 0 && (
        <div className="mt-1 space-y-1">
          {loggedEx.loggedSets.map((set, i) => (
            set && (set.repsAchieved !== undefined || set.weightUsed !== undefined) ? (
              <p key={i} className="text-gray-300">
                Підхід {i+1}: {set.repsAchieved ?? '-'} повт. @ {set.weightUsed ?? '-'} кг
              </p>
            ) : null
          ))}
        </div>
      )}

      {exerciseProgress && (
        <div className="mt-2 pt-2 border-t border-gray-500">
          <h5 className="text-sm font-semibold text-blue-300 mb-1">Аналітика прогресу:</h5>
          {(averageLoggedWeightActual !== undefined && averageLoggedRepsActual !== undefined && averageLoggedSetsActual !== undefined) ? (
            <p className="text-xs text-gray-300">
              Попередній факт: ~{averageLoggedWeightActual.toFixed(1)} кг x ~{averageLoggedRepsActual.toFixed(1)} повт.
              ({averageLoggedSetsActual.toFixed(1)} підх.)
            </p>
          ) : (
             <p className="text-xs text-gray-300">Попередній факт: Немає даних</p>
          )}
          {(exerciseProgress.recommendedWeight !== undefined && exerciseProgress.recommendedWeight !== 0) ||
           (exerciseProgress.recommendedReps !== undefined && exerciseProgress.recommendedReps !== 0) ||
           (exerciseProgress.recommendedSets !== undefined && exerciseProgress.recommendedSets !== 0) ? (
            <p className="text-sm font-medium text-green-400 mt-1">
              Рекомендована ціль:
              {exerciseProgress.recommendedWeight !== undefined && exerciseProgress.recommendedWeight !== 0 ? `${exerciseProgress.recommendedWeight.toFixed(1)} кг, ` : ''}
              {exerciseProgress.recommendedSets !== undefined && exerciseProgress.recommendedSets !== 0 ? `${exerciseProgress.recommendedSets} підх., ` : ''}
              {exerciseProgress.recommendedReps !== undefined && exerciseProgress.recommendedReps !== 0 ? `${exerciseProgress.recommendedReps} повт.` : ''}
            </p>
          ) : (
            <p className="text-sm font-medium text-yellow-400 mt-1">
              Рекомендована ціль: Підберіть вагу для
              {plannedSets ?? '-'} підходів по {plannedReps ?? '-'} повторень.
            </p>
          )}
          {exerciseProgress.recommendationReason && (
            <p className="text-xs text-gray-400 mt-1">Причина: {exerciseProgress.recommendationReason}</p>
          )}
        </div>
      )}
    </div>
  );
};

const formatDate = (date: Date | { seconds: number; nanoseconds: number }): string => {
  if (date instanceof Date) {
    return date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  // Якщо це Firebase Timestamp
  const timestamp = new Date(date.seconds * 1000);
  return timestamp.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
};

const ProgressView: React.FC<ProgressViewProps> = ({ workoutLogs, userProfile }) => {
  return (
    <div className="p-4 sm:p-6 bg-gray-800/80 rounded-xl shadow-2xl backdrop-blur-sm">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        <i className="fas fa-chart-pie mr-3"></i>{UI_TEXT.progressTitle}
      </h2>
      
      {!userProfile && (
         <p className="text-center text-gray-400">{UI_TEXT.getStarted}</p>
      )}

      {userProfile && (
        <div className="text-center">
          <p className="text-lg sm:text-xl text-gray-300 mb-6">Вітаємо, <span className="font-semibold text-purple-300">{userProfile.name || 'спортсмен'}</span>!</p>
          
          {Array.isArray(workoutLogs) && workoutLogs.length === 0 ? (
            <div className="p-6 bg-gray-700/50 rounded-lg shadow-lg">
              <i className="fas fa-hourglass-half text-5xl text-yellow-400 mb-6"></i>
              <p className="text-lg text-purple-300 mb-2">Поки що немає даних про прогрес.</p>
              <p className="text-gray-400">Як тільки ви почнете логувати свої тренування, тут з'явиться детальна інформація.</p>
            </div>
          ) : (
            <div className="mt-6">
              <h3 className="text-xl sm:text-2xl font-semibold text-purple-300 mb-4">Історія Тренувань:</h3>
              <div className="max-h-[60vh] sm:max-h-[70vh] overflow-y-auto bg-gray-700/50 p-3 sm:p-4 rounded-md shadow-inner space-y-3 sm:space-y-4">
                {userProfile && Array.isArray(workoutLogs) && workoutLogs.slice().reverse().map((log, index) => {
                  if (!log || typeof log !== 'object') return null;

                  const progressCalculator = new ProgressCalculator(workoutLogs, userProfile);

                  return (
                    <div key={index} className="text-gray-200 p-3 sm:p-4 border border-gray-600 rounded-md bg-gray-600/30 hover:bg-gray-600/40 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-purple-300 text-base sm:text-lg">
                          <i className="fas fa-calendar-alt mr-2"></i>
                          {log.date ? formatDate(log.date) : 'Невідома дата'}
                        </p>
                        {log.workoutDuration !== undefined && (
                          <p className="text-xs sm:text-sm text-yellow-400"><i className="fas fa-stopwatch mr-1"></i>{log.workoutDuration}</p>
                        )}
                      </div>
                      {log.dayCompleted !== undefined && (
                         <p className="text-sm mb-2"><i className="fas fa-running mr-2"></i>День плану: {log.dayCompleted}</p>
                      )}
                      
                      {Array.isArray(log.loggedExercises) && log.loggedExercises.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-pink-400 mt-2 mb-1">Виконані вправи:</h4>
                          {log.loggedExercises.map((ex, exIdx) => {
                            const exerciseProgress = progressCalculator.calculateExerciseProgress(ex.exerciseName);
                            const originalExercise = undefined;
                            
                            return ex && typeof ex === 'object' ? 
                              <ExerciseLogRow 
                                key={exIdx} 
                                loggedEx={ex} 
                                exerciseProgress={exerciseProgress} 
                                originalExercise={originalExercise} 
                              /> : null;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
               <p className="text-gray-400 mt-6 text-sm">{UI_TEXT.progressSoon}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressView;
