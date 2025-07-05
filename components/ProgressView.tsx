import React, { useState } from 'react';
import { WorkoutLog, UserProfile, LoggedExercise } from '../types';
import { UI_TEXT } from '../constants';

interface ProgressViewProps {
  workoutLogs: WorkoutLog[];
  userProfile: UserProfile | null;
  onAnalyzeWorkout?: (workoutLog: WorkoutLog) => void;
  onDeleteLog?: (logOrDate: WorkoutLog | string) => void; // string - дата
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
    </div>
  );
};

function groupLogsByDate(logs: WorkoutLog[]) {
  const groups: Record<string, WorkoutLog[]> = {};
  logs.forEach(log => {
    let dateStr = '';
    if (log.date && typeof log.date === 'object' && 'seconds' in log.date) {
      dateStr = new Date(log.date.seconds * 1000).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
    } else if (log.date instanceof Date) {
      dateStr = log.date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      dateStr = 'Невідома дата';
    }
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(log);
  });
  return groups;
}

const ProgressView: React.FC<ProgressViewProps> = ({ workoutLogs, userProfile, onAnalyzeWorkout, onDeleteLog }) => {
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const grouped = groupLogsByDate(workoutLogs.slice().reverse());
  const dateKeys = Object.keys(grouped);

  const toggleDate = (date: string) => {
    setOpenDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  // Функції для перекладу значень wellnessCheck українською
  const getEnergyText = (level: string) => {
    switch (level) {
      case 'very_low': return 'Дуже низька';
      case 'low': return 'Низька';
      case 'normal': return 'Нормальна';
      case 'high': return 'Висока';
      case 'very_high': return 'Дуже висока';
      default: return level;
    }
  };

  const getSleepText = (quality: string) => {
    switch (quality) {
      case 'poor': return 'Поганий';
      case 'fair': return 'Посередній';
      case 'good': return 'Хороший';
      case 'excellent': return 'Відмінний';
      default: return quality;
    }
  };

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
                {dateKeys.map(date => (
                  <div key={date} className="border border-gray-600 rounded-md bg-gray-600/30 hover:bg-gray-600/40 transition-colors mb-2">
                    <div className="flex justify-between items-center p-3 cursor-pointer select-none" onClick={() => toggleDate(date)}>
                      <div className="flex items-center">
                        <i className="fas fa-calendar-alt mr-2 text-purple-300"></i>
                        <span className="font-semibold text-purple-200 text-base sm:text-lg">{date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {onDeleteLog && (
                          <button
                            onClick={e => { e.stopPropagation(); if(window.confirm('Видалити всі логи за цю дату?')) onDeleteLog(String(date)); }}
                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        )}
                        <i className={`fas ${openDates[date] ? 'fa-chevron-up' : 'fa-chevron-down'} text-purple-300 text-lg`}></i>
                      </div>
                    </div>
                    {openDates[date] && (
                      <div className="p-2 sm:p-4">
                        {grouped[date].map((log, idx) => (
                          <div key={idx} className="mb-4 last:mb-0">
                            {log.workoutDuration !== undefined && (
                              <p className="text-xs sm:text-sm text-yellow-400 mb-1"><i className="fas fa-stopwatch mr-1"></i>{log.workoutDuration}</p>
                            )}
                            {log.dayCompleted !== undefined && (
                              <p className="text-sm mb-2"><i className="fas fa-running mr-2"></i>День плану: {log.dayCompleted}</p>
                            )}
                            {/* Відображення wellness check, якщо був адаптивний тренування */}
                            {log.wasAdaptiveWorkout && log.wellnessCheck && (
                              <div className="mb-3 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                                <h4 className="text-sm font-medium text-blue-300 mb-2">
                                  <i className="fas fa-heart mr-1"></i>
                                  Самопочуття під час тренування
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-blue-200">Енергія:</span>
                                    <span className="text-blue-300 ml-1">{getEnergyText(log.wellnessCheck.energyLevel || '')}</span>
                                  </div>
                                  <div>
                                    <span className="text-blue-200">Сон:</span>
                                    <span className="text-blue-300 ml-1">{getSleepText(log.wellnessCheck.sleepQuality || '')}</span>
                                  </div>
                                  <div>
                                    <span className="text-blue-200">Мотивація:</span>
                                    <span className="text-blue-300 ml-1">{log.wellnessCheck.motivation}/10</span>
                                  </div>
                                  <div>
                                    <span className="text-blue-200">Втома:</span>
                                    <span className="text-blue-300 ml-1">{log.wellnessCheck.fatigue}/10</span>
                                  </div>
                                </div>
                                {log.wellnessCheck.notes && (
                                  <p className="text-xs text-blue-200 mt-1">
                                    <strong>Нотатки:</strong> {log.wellnessCheck.notes}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Відображення адаптацій, якщо були */}
                            {log.wasAdaptiveWorkout && log.adaptiveWorkoutPlan && log.adaptiveWorkoutPlan.adaptations && (log.adaptiveWorkoutPlan.adaptations || []).length > 0 && (
                              <div className="mb-3 p-3 bg-green-900/30 border border-green-500/30 rounded-lg">
                                <h4 className="text-sm font-medium text-green-300 mb-2">
                                  <i className="fas fa-magic mr-1"></i>
                                  Адаптації тренування
                                </h4>
                                <div className="space-y-1">
                                  {(log.adaptiveWorkoutPlan.adaptations || []).map((adaptation, idx) => (
                                    <div key={idx} className="text-xs text-green-200">
                                      <strong>{adaptation.exerciseName}:</strong> {adaptation.adaptationReason}
                                      <div className="text-green-300">
                                        {adaptation.originalSets}×{adaptation.originalReps} → {adaptation.adaptedSets}×{adaptation.adaptedReps}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {log.adaptiveWorkoutPlan.overallAdaptation && (
                                  <div className="mt-2 text-xs text-green-200">
                                    <strong>Загальна адаптація:</strong> {log.adaptiveWorkoutPlan.overallAdaptation.reason}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Відображення рекомендацій, якщо були */}
                            {log.wasAdaptiveWorkout && log.wellnessRecommendations && (log.wellnessRecommendations || []).length > 0 && (
                              <div className="mb-3 p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg">
                                <h4 className="text-sm font-medium text-purple-300 mb-2">
                                  <i className="fas fa-lightbulb mr-1"></i>
                                  Рекомендації по самопочуттю
                                </h4>
                                <div className="space-y-1">
                                  {(log.wellnessRecommendations || []).slice(0, 3).map((rec, idx) => (
                                    <div key={idx} className="text-xs text-purple-200">
                                      <strong>{rec.title}</strong>
                                      <div className="text-purple-300">{rec.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {Array.isArray(log.loggedExercises) && log.loggedExercises.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-pink-400 mt-2 mb-1">Виконані вправи:</h4>
                                {log.loggedExercises.map((ex, exIdx) =>
                                  ex && typeof ex === 'object' ? <ExerciseLogRow key={exIdx} loggedEx={ex} /> : null
                                )}
                              </div>
                            )}
                            {onAnalyzeWorkout && (
                              <button
                                onClick={() => onAnalyzeWorkout(log)}
                                className="mt-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                              >
                                <i className="fas fa-chart-line mr-1"></i>
                                Аналізувати
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
