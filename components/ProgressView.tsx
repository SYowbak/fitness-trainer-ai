import React, { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import { WorkoutLog, UserProfile } from '../types';
import { UI_TEXT } from '../constants';
import '../styles/Calendar.css';
import { WorkoutLogModal } from './WorkoutLogModal'; // Імпортуємо модальне вікно

interface ProgressViewProps {
  workoutLogs: WorkoutLog[];
  userProfile: UserProfile | null;
  onAnalyzeWorkout: (log: WorkoutLog) => void;
  onDeleteLog?: (log: WorkoutLog) => void;
  isAnalyzing: boolean;
}

const ProgressView: React.FC<ProgressViewProps> = ({ workoutLogs, userProfile, onAnalyzeWorkout, onDeleteLog, isAnalyzing }) => {
  const [modalLogs, setModalLogs] = useState<WorkoutLog[]>([]);

  const workoutDates = useMemo(() => {
    const dates = new Set<string>();
    workoutLogs.forEach(log => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
      dates.add(logDate.toDateString());
    });
    return dates;
  }, [workoutLogs]);

  const tileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month' && workoutDates.has(date.toDateString())) {
      return <div className="workout-dot" />;
    }
    return null;
  };
  
  const handleDateClick = (value: Date) => {
    const logs = workoutLogs.filter(log => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
      return logDate.toDateString() === value.toDateString();
    });
    if (logs.length > 0) {
      setModalLogs(logs);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-900/50 rounded-xl shadow-2xl backdrop-blur-sm">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        <i className="fas fa-calendar-alt mr-3"></i>{UI_TEXT.progressTitle}
      </h2>
      <p className="text-center text-gray-400 mb-6 sm:mb-8 text-sm">
        Оберіть день, щоб переглянути деталі тренувань.
      </p>
      
      <div className="mb-8">
        <Calendar
          onClickDay={handleDateClick}
          tileContent={tileContent}
          locale="uk-UA"
          className="mx-auto"
        />
      </div>
      
      {modalLogs.length > 0 && (
        <WorkoutLogModal
          logs={modalLogs}
          onClose={() => setModalLogs([])}
          onAnalyzeWorkout={onAnalyzeWorkout}
          isAnalyzing={isAnalyzing}
        />
      )}
    </div>
  );
};

export default ProgressView;
