import React, { useState, useMemo, useEffect } from 'react';
import Calendar from 'react-calendar';
import { WorkoutLog } from '../types';
import { UI_TEXT } from '../constants';
import '../styles/Calendar.css';
import { WorkoutLogModal } from './WorkoutLogModal';
import { analyzeProgressTrends } from '../services/workoutAnalysisService';

interface ProgressViewProps {
  workoutLogs: WorkoutLog[];
  onAnalyzeWorkout: (log: WorkoutLog) => void;
  onDeleteLog: (log: WorkoutLog) => void;
  isAnalyzing: boolean;
  analyzingLogId: string | null;
  exerciseRecommendations?: any[];
  progressTrends?: {
    overallProgress: 'improving' | 'plateau' | 'declining';
    strengthProgress: number;
    enduranceProgress: number;
    consistencyScore: number;
  } | null;
  onGenerateNewPlan?: () => Promise<void>;
}

const ProgressView: React.FC<ProgressViewProps> = ({ 
  workoutLogs, 
  onAnalyzeWorkout, 
  onDeleteLog, 
  isAnalyzing,
  analyzingLogId,
  exerciseRecommendations = [],
  progressTrends = null,
  onGenerateNewPlan
}) => {
  const [modalLogs, setModalLogs] = useState<WorkoutLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  const workoutDates = useMemo(() => {
    const dates = new Set<string>();
    console.log('📅 [ProgressView] Обробляємо логи для календаря:', workoutLogs.length);
    
    // Видаляємо дублікати по ID та даті
    const uniqueLogs = workoutLogs.filter((log, index, self) => 
      index === self.findIndex(l => l.id === log.id)
    );
    
    console.log('📅 [ProgressView] Після видалення дублікатів:', uniqueLogs.length);
    
    uniqueLogs.forEach(log => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
      const dateString = logDate.toDateString();
      console.log('📅 [ProgressView] Додаємо дату до календаря:', dateString, 'з логу:', log.id);
      dates.add(dateString);
    });
    console.log('📅 [ProgressView] Всього дат у календарі:', dates.size, Array.from(dates));
    return dates;
  }, [workoutLogs]);

  // Цей ефект буде оновлювати вміст модального вікна при зміні workoutLogs
  useEffect(() => {
    if (selectedDate) {
      const updatedLogsForDate = workoutLogs.filter(log => {
        const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
        return logDate.toDateString() === selectedDate.toDateString();
      });
      setModalLogs(updatedLogsForDate);
    }
  }, [workoutLogs, selectedDate]);

  const tileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month' && workoutDates.has(date.toDateString())) {
      return <div className="workout-dot" />;
    }
    return null;
  };
  
  const handleDateClick = (value: Date) => {
    console.log('📅 [ProgressView] Клік по даті:', value.toDateString());
    setSelectedDate(value);
    const logs = workoutLogs.filter(log => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
      const matches = logDate.toDateString() === value.toDateString();
      console.log('📅 [ProgressView] Перевіряємо лог:', log.id, 'дата логу:', logDate.toDateString(), 'співпадає:', matches);
      return matches;
    });
    console.log('📅 [ProgressView] Знайдено логів для дати:', logs.length);
    if (logs.length > 0) {
      setModalLogs(logs);
    } else {
      setModalLogs([]); // Очищуємо, якщо логів немає
    }
  };

  const handleCloseModal = () => {
    setModalLogs([]);
    setSelectedDate(null); // Скидаємо вибрану дату
  };

  // Використовуємо прогрес з пропсів або розраховуємо локально як fallback
  const progressAnalysis = useMemo(() => {
    // Якщо є progressTrends з пропсів - використовуємо їх
    if (progressTrends) {
      return progressTrends;
    }
    
    // Fallback: розраховуємо локально якщо немає пропсів
    if (workoutLogs.length < 2) return null;
    try {
      return analyzeProgressTrends(workoutLogs);
    } catch (error) {
      console.error('Error analyzing progress trends:', error);
      return null;
    }
  }, [progressTrends, workoutLogs]);

  // Розраховуємо додаткові статистики
  const workoutStats = useMemo(() => {
    if (workoutLogs.length === 0) return null;

    // Фільтруємо сесії з надмірною тривалістю (> 3 годин), якщо користувач забув завершити
    const saneWorkouts = workoutLogs.filter(log => !log.duration || log.duration <= 10800);
    const totalWorkouts = saneWorkouts.length;
    const last30Days = workoutLogs.filter(log => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date.seconds * 1000);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return logDate >= thirtyDaysAgo;
    });

    let totalDuration = 0;
    let totalExercises = 0;
    let totalSets = 0;
    let bestWorkoutDuration = 0;
    
    saneWorkouts.forEach(log => {
      if (log.duration) totalDuration += log.duration;
      if (log.loggedExercises) {
        totalExercises += log.loggedExercises.length;
        log.loggedExercises.forEach(exercise => {
          if (exercise.loggedSets) totalSets += exercise.loggedSets.length;
        });
      }
      if (log.duration && log.duration > bestWorkoutDuration) {
        bestWorkoutDuration = log.duration;
      }
    });

    const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts / 60) : 0; // в хвилинах
    const avgExercisesPerWorkout = totalWorkouts > 0 ? Math.round(totalExercises / totalWorkouts * 10) / 10 : 0;
    const avgSetsPerWorkout = totalWorkouts > 0 ? Math.round(totalSets / totalWorkouts * 10) / 10 : 0;

    return {
      totalWorkouts,
      workoutsLast30Days: last30Days.length,
      avgDuration,
      avgExercisesPerWorkout,
      avgSetsPerWorkout,
      bestWorkoutDuration: Math.round(bestWorkoutDuration / 60), // в хвилинах
    };
  }, [workoutLogs]);

  const renderProgressAnalysis = () => {
    if (!progressAnalysis || !workoutStats) return null;

    const getTrendIcon = (progress: string) => {
      switch (progress) {
        case 'improving': return 'fas fa-arrow-up text-green-400';
        case 'plateau': return 'fas fa-minus text-yellow-400';
        case 'declining': return 'fas fa-arrow-down text-gray-400';
        default: return 'fas fa-minus text-gray-400';
      }
    };

    const getTrendText = (progress: string) => {
      switch (progress) {
        case 'improving': return 'Прогрес';
        case 'plateau': return 'Плато';
        case 'declining': return 'Регрес';
        default: return 'Невідомо';
      }
    };

    return (
      <div className="mb-6 space-y-4">
        {/* Аналіз прогресу */}
        <div className="mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl mb-1">
                <i className={getTrendIcon(progressAnalysis.overallProgress)}></i>
              </div>
              <p className="text-sm text-gray-300">Загальний тренд</p>
              <p className="text-xs text-gray-400">{getTrendText(progressAnalysis.overallProgress)}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-fitness-gold-400 mb-1">
                <i className="fas fa-dumbbell"></i>
              </div>
              <p className="text-sm text-gray-300">Прогрес сили</p>
              <p className={`text-xs font-medium ${
                progressAnalysis.strengthProgress > 5 ? 'text-green-400' : 
                progressAnalysis.strengthProgress < -5 ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {progressAnalysis.strengthProgress > 0 ? '+' : ''}{progressAnalysis.strengthProgress}%
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-green-400 mb-1">
                <i className="fas fa-running"></i>
              </div>
              <p className="text-sm text-gray-300">Прогрес витривалості</p>
              <p className={`text-xs font-medium ${
                progressAnalysis.enduranceProgress > 5 ? 'text-green-400' : 
                progressAnalysis.enduranceProgress < -5 ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {progressAnalysis.enduranceProgress > 0 ? '+' : ''}{progressAnalysis.enduranceProgress}%
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-fitness-gold-400 mb-1">
                <i className="fas fa-calendar-check"></i>
              </div>
              <p className="text-sm text-gray-300">Консистентність</p>
              <p className="text-xs text-gray-400">{progressAnalysis.consistencyScore}%</p>
            </div>
          </div>
        </div>

        {/* Статистика тренувань */}
        <div className="p-4 bg-fitness-gold-500/10 border border-fitness-gold-500/30 rounded-lg">
          <button 
            onClick={() => setIsStatsExpanded(!isStatsExpanded)}
            className="w-full flex items-center justify-between text-lg font-semibold text-fitness-gold-300 mb-3 hover:text-fitness-gold-200 transition-colors"
          >
            <span>
              <i className="fas fa-chart-bar mr-2"></i>
              Статистика тренувань
            </span>
            <i className={`fas fa-chevron-${isStatsExpanded ? 'up' : 'down'} transition-transform duration-200`}></i>
          </button>
          {isStatsExpanded && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-fadeIn">
            <div className="text-center">
              <div className="text-2xl text-fitness-gold-400 mb-1">
                <i className="fas fa-trophy"></i>
              </div>
              <p className="text-sm text-gray-300">Загальна кількість тренувань</p>
              <p className="text-lg font-bold text-fitness-gold-200">{workoutStats.totalWorkouts}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-green-400 mb-1">
                <i className="fas fa-calendar-week"></i>
              </div>
              <p className="text-sm text-gray-300">Тренувань за останні 30 днів</p>
              <p className="text-lg font-bold text-green-200">{workoutStats.workoutsLast30Days}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-yellow-400 mb-1">
                <i className="fas fa-clock"></i>
              </div>
              <p className="text-sm text-gray-300">Середня тривалість</p>
              <p className="text-lg font-bold text-yellow-200">{workoutStats.avgDuration} хв</p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-orange-400 mb-1">
                <i className="fas fa-fire"></i>
              </div>
              <p className="text-sm text-gray-300">Середньо вправ на тренування</p>
              <p className="text-lg font-bold text-orange-200">{workoutStats.avgExercisesPerWorkout}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-gray-400 mb-1">
                <i className="fas fa-layer-group"></i>
              </div>
              <p className="text-sm text-gray-300">Середньо підходів на тренування</p>
              <p className="text-lg font-bold text-gray-200">{workoutStats.avgSetsPerWorkout}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl text-fitness-gold-400 mb-1">
                <i className="fas fa-star"></i>
              </div>
              <p className="text-sm text-gray-300">Найдовше тренування</p>
              <p className="text-lg font-bold text-fitness-gold-200">{workoutStats.bestWorkoutDuration} хв</p>
            </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-gold">
        <i className="fas fa-chart-line mr-3"></i>{UI_TEXT.progressTitle}
      </h2>
      
      {/* Відображення аналізу прогресу */}
      {renderProgressAnalysis()}
      
      {/* Рекомендації після завершення тренування */}
      {exerciseRecommendations && exerciseRecommendations.length > 0 && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
          <h3 className="text-lg font-semibold text-green-300 mb-3">
            <i className="fas fa-lightbulb mr-2"></i>
            Рекомендації після останнього тренування
          </h3>
          <div className="space-y-3">
            {exerciseRecommendations.map((rec, index) => (
              <div key={index} className="bg-gray-800/50 p-3 rounded-lg border border-gray-600">
                <h4 className="font-medium text-green-200 mb-1">{rec.exerciseName}</h4>
                <p className="text-sm text-gray-300 mb-2">{rec.recommendation}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {rec.suggestedWeight && (
                    <span className="px-2 py-1 bg-fitness-gold-600/30 text-fitness-gold-200 rounded">
                      Вага: {rec.suggestedWeight}кг
                    </span>
                  )}
                  {rec.suggestedReps && (
                    <span className="px-2 py-1 bg-fitness-gold-600/30 text-fitness-gold-200 rounded">
                      Повторення: {rec.suggestedReps}
                    </span>
                  )}
                  {rec.suggestedSets && (
                    <span className="px-2 py-1 bg-fitness-gold-600/30 text-fitness-gold-200 rounded">
                      Підходи: {rec.suggestedSets}
                    </span>
                  )}
                  {rec.action && (
                    <span className={`px-2 py-1 rounded ${
                      rec.action === 'increase' ? 'bg-green-600/30 text-green-200' :
                      rec.action === 'decrease' ? 'bg-gray-600/30 text-gray-200' :
                      'bg-yellow-600/30 text-yellow-200'
                    }`}>
                      {rec.action === 'increase' ? '📈 Збільшити' :
                       rec.action === 'decrease' ? '📉 Зменшити' : 
                       '➡️ Залишити'}
                    </span>
                  )}
                </div>
                {rec.reason && (
                  <p className="text-xs text-gray-400 mt-2 italic">{rec.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-center text-gray-400 mb-6 sm:mb-8 text-sm">
        Оберіть день на календарі, щоб переглянути деталі тренувань.
      </p>
      
      <div className="mb-8">
        <Calendar
          onClickDay={handleDateClick}
          tileContent={tileContent}
          tileClassName={({ date, view }) => {
            if (view === 'month') {
              const isToday = date.toDateString() === new Date().toDateString();
              const hasWorkout = workoutDates.has(date.toDateString());
              
              let classes = [];
              if (isToday) classes.push('today-tile');
              if (hasWorkout) classes.push('workout-tile');
              
              return classes.join(' ');
            }
            return '';
          }}
          locale="uk-UA"
          className="mx-auto"
        />
      </div>
      
      {modalLogs.length > 0 && (
        <WorkoutLogModal
          logs={modalLogs}
          onClose={handleCloseModal}
          onAnalyzeWorkout={onAnalyzeWorkout}
          onDeleteLog={onDeleteLog}
          isAnalyzing={isAnalyzing}
          analyzingLogId={analyzingLogId}
        />
      )}
    </div>
  );
};

export default ProgressView;
