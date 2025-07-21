import React, { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import { WorkoutLog, UserProfile, LoggedExercise } from '../types';
import { UI_TEXT } from '../constants';
import '../styles/Calendar.css'; // Імпортуємо стилі

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
  const [selectedDate, setSelectedDate] = useState(new Date());

  const workoutDates = useMemo(() => {
    const dates = new Set<string>();
    workoutLogs.forEach(log => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
      dates.add(logDate.toDateString());
    });
    return dates;
  }, [workoutLogs]);

  const logsForSelectedDate = useMemo(() => {
    return workoutLogs
      .filter(log => {
        const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
        return logDate.toDateString() === selectedDate.toDateString();
      })
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date.getTime() : a.date.seconds * 1000;
        const dateB = b.date instanceof Date ? b.date.getTime() : b.date.seconds * 1000;
        return dateB - dateA; // Сортуємо від новішого до старішого
      });
  }, [workoutLogs, selectedDate]);

  const tileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month' && workoutDates.has(date.toDateString())) {
      return <div className="workout-dot" />;
    }
    return null;
  };
  
  const handleDateChange = (value: any) => {
    if (value instanceof Date) {
      setSelectedDate(value);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-900/50 rounded-xl shadow-2xl backdrop-blur-sm">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        <i className="fas fa-chart-line mr-3"></i>{UI_TEXT.progressTitle}
      </h2>
      <p className="text-center text-gray-400 mb-6 sm:mb-8 text-sm">
        Вітаємо, <span className="font-semibold text-purple-300">{userProfile?.name || 'спортсмен'}</span>! Оберіть день, щоб переглянути деталі.
      </p>
      
      <div className="mb-8">
        <Calendar
          onChange={handleDateChange}
          value={selectedDate}
          tileContent={tileContent}
          locale="uk-UA"
          className="mx-auto"
        />
      </div>

      <div className="space-y-6">
        {logsForSelectedDate.length > 0 ? (
          logsForSelectedDate.map((log, idx) => (
            <div key={log.id || idx} className="p-4 sm:p-5 bg-gray-800/60 rounded-lg border border-gray-700 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                  {log.workoutDuration && (
                    <span className="text-sm font-semibold text-yellow-400"><i className="fas fa-stopwatch mr-1.5"></i>{log.workoutDuration}</span>
                  )}
                  {log.dayCompleted && (
                    <span className="text-sm font-semibold text-gray-300"><i className="fas fa-running mr-1.5"></i>День {log.dayCompleted}</span>
                  )}
                </div>
                {onDeleteLog && (
                   <button
                     onClick={() => { if(window.confirm('Видалити цей лог?')) onDeleteLog(log); }}
                     className="px-2 py-1 text-gray-400 hover:text-red-500 transition-colors text-xs"
                     title="Видалити лог"
                   >
                     <i className="fas fa-trash-alt"></i>
                   </button>
                )}
              </div>

              {/* Wellness Check */}
              {log.wellnessCheck && (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-md">
                  <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center"><i className="fas fa-heartbeat mr-2"></i>Самопочуття</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <p><strong className="text-blue-400">Енергія:</strong> {log.wellnessCheck.energyLevel}</p>
                    <p><strong className="text-blue-400">Сон:</strong> {log.wellnessCheck.sleepQuality}</p>
                    <p><strong className="text-blue-400">Мотивація:</strong> {log.wellnessCheck.motivation}/10</p>
                    <p><strong className="text-blue-400">Втома:</strong> {log.wellnessCheck.fatigue}/10</p>
                  </div>
                </div>
              )}

              {/* Адаптації */}
              {log.adaptiveWorkoutPlan?.adaptations && log.adaptiveWorkoutPlan.adaptations.length > 0 && (
                 <div className="mb-4 p-3 bg-green-900/30 border border-green-700/50 rounded-md">
                   <h4 className="text-sm font-medium text-green-300 mb-2 flex items-center"><i className="fas fa-magic mr-2"></i>Адаптації</h4>
                   <div className="space-y-1 text-xs">
                     {log.adaptiveWorkoutPlan.adaptations.map((a, i) => (
                       <p key={i}><strong className="text-green-400">{a.exerciseName}:</strong> {a.adaptationReason}</p>
                     ))}
                   </div>
                 </div>
              )}

              {/* Рекомендації */}
              {log.recommendation?.text && (
                <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-md">
                  <h4 className="text-sm font-medium text-yellow-300 mb-2 flex items-center"><i className="fas fa-star mr-2"></i>Загальний аналіз</h4>
                  <p className="text-xs text-yellow-200">{log.recommendation.text}</p>
                </div>
              )}
              
              {/* Вправи */}
              <div className="mt-4">
                 <h4 className="text-sm font-semibold text-pink-400 mb-2 flex items-center"><i className="fas fa-dumbbell mr-2"></i>Виконані вправи</h4>
                 <div className="space-y-2">
                   {log.loggedExercises.map((ex, i) => <ExerciseLogRow key={i} loggedEx={ex} />)}
                 </div>
              </div>
              
            </div>
          ))
        ) : (
          <div className="text-center p-8 bg-gray-800/60 rounded-lg">
            <i className="fas fa-calendar-times text-4xl text-gray-500 mb-4"></i>
            <p className="text-lg text-gray-400">За вибраний день тренувань не знайдено.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressView;
