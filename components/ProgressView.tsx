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
    return workoutLogs.filter(log => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
      return logDate.toDateString() === selectedDate.toDateString();
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
    <div className="p-4 sm:p-6 bg-gray-800/80 rounded-xl shadow-2xl backdrop-blur-sm">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        <i className="fas fa-chart-line mr-3"></i>{UI_TEXT.progressTitle}
      </h2>
      
      <div className="mb-8">
        <Calendar
          onChange={handleDateChange}
          value={selectedDate}
          tileContent={tileContent}
          locale="uk-UA"
        />
      </div>

      {logsForSelectedDate.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-purple-300">
            Тренування за {selectedDate.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </h3>
          {logsForSelectedDate.map((log, idx) => (
            <div key={idx} className="p-4 bg-gray-700/50 rounded-lg">
              {/* Тут рендеримо деталі логу */}
              {log.workoutDuration && <p>Тривалість: {log.workoutDuration}</p>}
              {log.dayCompleted && <p>День плану: {log.dayCompleted}</p>}
              
              {/* Wellness Check */}
              {log.wellnessCheck && (
                <div className="mt-4">
                  <h4 className="font-semibold text-purple-400">Самопочуття</h4>
                  {/* ... код для wellness check ... */}
                </div>
              )}

              {/* Адаптації */}
              {log.adaptiveWorkoutPlan && (
                 <div className="mt-4">
                  <h4 className="font-semibold text-purple-400">Адаптації</h4>
                  {/* ... код для адаптацій ... */}
                </div>
              )}
              
              {/* Вправи */}
              <div className="mt-4">
                 <h4 className="font-semibold text-purple-400">Виконані вправи</h4>
                 {log.loggedExercises.map((ex, i) => <ExerciseLogRow key={i} loggedEx={ex} />)}
              </div>

              {/* ... і так далі для інших полів ... */}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 bg-gray-700/50 rounded-lg">
          <p className="text-lg text-gray-400">
            {workoutDates.has(selectedDate.toDateString()) 
              ? "Завантаження даних..." 
              : "За вибраний день тренувань не знайдено."}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProgressView;
