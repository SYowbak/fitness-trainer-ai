import React from 'react';
import { WorkoutLog, UserProfile, LoggedExercise } from '../types';
import { UI_TEXT } from '../constants';

interface ProgressViewProps {
  workoutLogs: WorkoutLog[];
  userProfile: UserProfile | null;
}

const ExerciseLogRow: React.FC<{loggedEx: LoggedExercise}> = ({loggedEx}) => {
  if (!loggedEx || typeof loggedEx !== 'object') {
    console.warn('Invalid logged exercise data:', loggedEx);
    return null;
  }
  return (
    <div className="p-3 bg-gray-600/50 rounded-md my-2 text-xs sm:text-sm">
      <p className="font-semibold text-yellow-400">{loggedEx.exerciseName || 'Невідома вправа'}</p>
      {(loggedEx.originalSets !== undefined || loggedEx.originalReps !== undefined) && (
         <p>План: {loggedEx.originalSets ?? '-'} x {loggedEx.originalReps ?? '-'}
           {loggedEx.targetWeightAtLogging !== undefined && ` @ ${loggedEx.targetWeightAtLogging}kg`}
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
      {loggedEx.completedSuccessfully !== undefined && (
         <p className={`mt-1 font-medium ${loggedEx.completedSuccessfully ? 'text-green-400' : 'text-red-400'}`}>
           {loggedEx.completedSuccessfully ? 'Успішно виконано' : 'Не всі цілі досягнуто'}
         </p>
      )}
    </div>
  );
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
                {Array.isArray(workoutLogs) && workoutLogs.slice().reverse().map((log, index) => ( 
                  log && typeof log === 'object' ? (
                  <div key={index} className="text-gray-200 p-3 sm:p-4 border border-gray-600 rounded-md bg-gray-600/30 hover:bg-gray-600/40 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-semibold text-purple-300 text-base sm:text-lg">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        {log.date ? new Date(log.date).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Невідома дата'}
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
                        {log.loggedExercises.map((ex, exIdx) => 
                          ex && typeof ex === 'object' ? <ExerciseLogRow key={exIdx} loggedEx={ex} /> : null
                        )}
                      </div>
                    )}
                  </div>
                ) : null
                ))}
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
