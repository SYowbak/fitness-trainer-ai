import React, { useState, useEffect, useRef } from 'react';
import { WorkoutLog, LoggedExercise, EnergyLevel, SleepQuality, StressLevel, WellnessRecommendation } from '../types';
import { detectTimeInfo } from '../utils/exerciseTypeDetector';
import { UI_TEXT } from '../constants';

// ExerciseLogRow з можливістю розгортання
const ExerciseLogRow: React.FC<{loggedEx: LoggedExercise}> = ({ loggedEx }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  
  return (
    <div className="p-3 bg-gray-700/50 rounded-md my-2 text-xs sm:text-sm">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center text-left"
      >
        <span className="font-semibold text-yellow-400">{loggedEx.exerciseName}</span>
        <i className={`fas fa-chevron-down transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-600">
          <p>План: {loggedEx.originalSets ?? '-'} x {loggedEx.originalReps ?? '-'} @ {loggedEx.targetWeightAtLogging ?? 'N/A'}kg</p>
          {loggedEx.loggedSets.map((set, i) => {
            const timeInfo = detectTimeInfo(loggedEx.exerciseName || '');
            return (
              <p key={`${loggedEx.exerciseName}-${i}`} className="text-gray-300">
                Підхід {i + 1}: {set.repsAchieved ?? '-'} {timeInfo.isTime ? 'сек.' : 'повт.'} @ {((set.weightUsed ?? '-') as any)} кг
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};

// AccordionSection з можливістю розгортання
interface AccordionSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left text-fitness-gold-300 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center">
          <i className={`fas ${icon} mr-3 w-5 text-center`}></i>
          <span className="font-semibold">{title}</span>
        </div>
        <i className={`fas fa-chevron-down transform transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      {isOpen && <div className="p-4 bg-gray-800 text-gray-300 text-sm">{children}</div>}
    </div>
  );
};

interface WorkoutLogModalProps {
  logs: WorkoutLog[];
  onClose: () => void;
  onAnalyzeWorkout: (log: WorkoutLog) => void;
  onDeleteLog: (log: WorkoutLog) => void;
  isAnalyzing: boolean;
  analyzingLogId: string | null;
}

export const WorkoutLogModal: React.FC<WorkoutLogModalProps> = ({ 
  logs, 
  onClose, 
  onAnalyzeWorkout, 
  onDeleteLog,
  isAnalyzing, 
  analyzingLogId 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Автоматичне прокручування сторінки до початку при відкритті модального вікна
  useEffect(() => {
    // Прокручуємо всю сторінку до початку
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Також блокуємо прокручування фону
    document.body.style.overflow = 'hidden';
    
    // Очищуємо при закритті
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [logs]);

  if (!logs.length) return null;
  const logDate = logs[0].date instanceof Date ? logs[0].date : new Date(logs[0].date.seconds * 1000);

  // Функції для перекладу станів
  const getEnergyLevelText = (level: EnergyLevel) => {
    switch (level) {
      case EnergyLevel.VERY_LOW: return UI_TEXT.veryLow;
      case EnergyLevel.LOW: return UI_TEXT.low;
      case EnergyLevel.NORMAL: return UI_TEXT.normal;
      case EnergyLevel.HIGH: return UI_TEXT.high;
      case EnergyLevel.VERY_HIGH: return UI_TEXT.veryHigh;
      default: return UI_TEXT.normal;
    }
  };

  const getSleepQualityText = (quality: SleepQuality) => {
    switch (quality) {
      case SleepQuality.POOR: return UI_TEXT.poor;
      case SleepQuality.FAIR: return UI_TEXT.fair;
      case SleepQuality.GOOD: return UI_TEXT.good;
      case SleepQuality.EXCELLENT: return UI_TEXT.excellent;
      default: return UI_TEXT.good;
    }
  };

  const getStressLevelText = (level: StressLevel) => {
    switch (level) {
      case StressLevel.HIGH: return UI_TEXT.stressHigh;
      case StressLevel.MODERATE: return UI_TEXT.stressModerate;
      case StressLevel.LOW: return UI_TEXT.stressLow;
      default: return UI_TEXT.stressLow;
    }
  };

  const getRecommendationIcon = (type: WellnessRecommendation['type']) => {
    switch (type) {
      case 'energy': return 'fas fa-bolt text-yellow-400';
      case 'recovery': return 'fas fa-bed text-blue-400';
      case 'motivation': return 'fas fa-fire text-orange-400';
      case 'stress': return 'fas fa-brain text-fitness-gold-400';
      default: return 'fas fa-heartbeat text-red-400';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-4"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <h2 className="heading-primary text-xl sm:text-2xl font-bold text-center">
            Тренування за {logDate.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors">
            <i className="fas fa-times fa-lg"></i>
          </button>
        </div>

        <div className="p-2 sm:p-4 max-h-[70vh] overflow-y-auto">
          {logs.map(log => {
            const isCurrentLogAnalyzing = isAnalyzing && analyzingLogId === log.id;
            return (
              <div key={log.id} className="mb-4 bg-gray-900/50 rounded-lg overflow-hidden">
                <div className="p-4 flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-semibold text-yellow-400">
                      <i className="fas fa-stopwatch mr-1.5"></i>{log.workoutDuration}
                    </span>
                    <span className="text-sm font-semibold text-gray-300">
                      <i className="fas fa-running mr-1.5"></i>День {log.dayCompleted}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onAnalyzeWorkout(log)} 
                      disabled={isCurrentLogAnalyzing}
                      className="btn-primary px-3 py-1.5 text-xs font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center"
                    >
                      {isCurrentLogAnalyzing ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Аналізуємо...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-brain mr-2"></i>
                          {log.recommendation ? 'Переаналізувати' : 'Аналізувати'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {log.wellnessCheck && (
                  <AccordionSection title="Самопочуття" icon="fa-heartbeat" defaultOpen={true}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-fitness-gold-300 mb-1">
                          <i className="fas fa-bolt mr-2"></i>Енергія
                        </p>
                        <p className="pl-6">{getEnergyLevelText(log.wellnessCheck.energyLevel)}</p>
                      </div>
                      <div>
                        <p className="text-fitness-gold-300 mb-1">
                          <i className="fas fa-bed mr-2"></i>Сон
                        </p>
                        <p className="pl-6">{getSleepQualityText(log.wellnessCheck.sleepQuality)}</p>
                      </div>
                      <div>
                        <p className="text-fitness-gold-300 mb-1">
                          <i className="fas fa-brain mr-2"></i>Стрес
                        </p>
                        <p className="pl-6">{getStressLevelText(log.wellnessCheck.stressLevel)}</p>
                      </div>
                      <div>
                        <p className="text-fitness-gold-300 mb-1">
                          <i className="fas fa-fire mr-2"></i>Мотивація
                        </p>
                        <p className="pl-6">{log.wellnessCheck.motivation}/10</p>
                      </div>
                      <div>
                        <p className="text-fitness-gold-300 mb-1">
                          <i className="fas fa-tired mr-2"></i>Втома
                        </p>
                        <p className="pl-6">{log.wellnessCheck.fatigue}/10</p>
                      </div>
                      {log.wellnessCheck.notes && (
                        <div className="col-span-2">
                          <p className="text-fitness-gold-300 mb-1">
                            <i className="fas fa-sticky-note mr-2"></i>Нотатки
                          </p>
                          <p className="pl-6">{log.wellnessCheck.notes}</p>
                        </div>
                      )}
                    </div>
                  </AccordionSection>
                )}

                {log.wellnessRecommendations && log.wellnessRecommendations.length > 0 && (
                  <AccordionSection title="Рекомендації по самопочуттю" icon="fa-lightbulb">
                    <div className="space-y-4">
                      {log.wellnessRecommendations.map((rec, i) => (
                        <div key={`${log.id}-rec-${i}`} className="bg-gray-700/30 p-3 rounded-lg">
                          <h4 className="font-semibold text-lg mb-2 flex items-center">
                            <i className={`${getRecommendationIcon(rec.type)} mr-3`}></i>
                            {rec.title}
                          </h4>
                          <p className="text-gray-300 mb-3">{rec.description}</p>
                          {rec.actions && rec.actions.length > 0 && (
                            <div>
                              <h5 className="font-medium text-gray-400 mb-1">Рекомендовані дії:</h5>
                              <ul className="list-disc list-inside space-y-1 text-gray-300 pl-2">
                                {rec.actions.map((action, j) => (
                                  <li key={`${log.id}-rec-${i}-action-${j}`}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionSection>
                )}

                {log.adaptiveWorkoutPlan?.adaptations && log.adaptiveWorkoutPlan.adaptations.length > 0 && (
                  <AccordionSection title="Адаптації" icon="fa-magic">
                    <div className="space-y-2">
                      {log.adaptiveWorkoutPlan.adaptations.map((a, i) => (
                        <div key={`${log.id}-adaptation-${i}`} className="bg-gray-700/30 p-3 rounded">
                          <p className="font-semibold text-green-400 mb-1">{a.exerciseName}</p>
                          <p className="text-gray-300">{a.adaptationReason}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionSection>
                )}

                {log.recommendation?.text && (
                  <AccordionSection title="Загальний аналіз" icon="fa-star">
                    <div className="bg-gray-700/30 p-3 rounded">
                      <p>{log.recommendation.text}</p>
                      {log.recommendation.action && (
                        <p className="mt-2 text-green-400">
                          <i className="fas fa-arrow-right mr-2"></i>
                          Рекомендована дія: {log.recommendation.action}
                        </p>
                      )}
                    </div>
                  </AccordionSection>
                )}

                <AccordionSection title="Виконані вправи" icon="fa-dumbbell">
                  {log.loggedExercises.map((ex, i) => (
                    <ExerciseLogRow key={`${log.id}-exercise-${i}`} loggedEx={ex} />
                  ))}
                </AccordionSection>

                <div className="p-4 bg-gray-900/70 mt-2">
                  <button
                    onClick={() => onDeleteLog(log)}
                    className="w-full text-red-400 hover:text-red-300 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-trash-alt"></i>
                    Видалити цей запис
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 