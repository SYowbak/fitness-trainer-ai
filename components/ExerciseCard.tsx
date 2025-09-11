import React, { useState, useEffect } from 'react';
import { Exercise, LoggedSetWithAchieved, WeightType } from '../types';
import { UI_TEXT, formatTime } from '../constants';

interface ExerciseCardProps {
  exercise: Exercise;
  isActive: boolean;
  onLogExercise: (loggedSets: LoggedSetWithAchieved[], success: boolean) => void;
  onSkipExercise: () => void;
  recommendations?: {
    exerciseName: string;
    recommendation: string;
    suggestedWeight?: number;
    suggestedReps?: number;
    suggestedSets?: number;
    reason: string;
  }[];
  variations?: Exercise[];
  onSelectVariation?: (variation: Exercise) => Promise<void> | void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  isActive,
  onLogExercise,
  onSkipExercise,
  recommendations = [],
  variations = [],
  onSelectVariation
}) => {
  // console.log(`ExerciseCard ${exercise.name} rendering. isCompleted: ${exercise.isCompletedDuringSession}`);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(exercise.isCompletedDuringSession);
  const [loggedSetsData, setLoggedSetsData] = useState<LoggedSetWithAchieved[]>([]);
  const [numSets, setNumSets] = useState(3);
  const [allSetsSuccessful, setAllSetsSuccessful] = useState<boolean>(true);
  const [restTimer, setRestTimer] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);
  const [audioElement] = useState(() => new Audio('/sounds/Yeah_buddy_Ronnie_Ccoleman.mp3'));
  const [isSelectingVariation, setIsSelectingVariation] = useState<boolean>(false);
  const [variationsHidden, setVariationsHidden] = useState<boolean>(false);

  const getWeightLabel = (weightType: WeightType) => {
    switch (weightType) {
      case 'total':
        return 'Загальна вага (кг)';
      case 'single':
        return 'Вага 1 гантелі (кг)';
      case 'bodyweight':
        return 'Вага тіла (кг)';
      case 'none':
      default:
        return 'Вага (кг)';
    }
  };

  const exerciseRecommendation = recommendations.find(rec => rec.exerciseName === exercise.name);
  const hasVariations = !variationsHidden && variations.length > 0;

  // Ініціалізуємо або оновлюємо isCompleted та allSetsSuccessful, коли exercise змінюється
  useEffect(() => {
    // console.log(`ExerciseCard ${exercise.name}: useEffect [isCompletedDuringSession, sessionSuccess] triggered.`);
    setIsCompleted(exercise.isCompletedDuringSession);
    setAllSetsSuccessful(exercise.sessionSuccess ?? true);
    // Приховуємо форму логування, якщо вправу вже завершено
    if (exercise.isCompletedDuringSession) {
      setShowLogForm(false);
    }
  }, [exercise.isCompletedDuringSession, exercise.sessionSuccess, exercise.name]);

  useEffect(() => {
    // console.log(`ExerciseCard ${exercise.name}: loggedSetsData changed:`, loggedSetsData);
  }, [loggedSetsData, exercise.name]);

  useEffect(() => {
    let animationFrameId: number | null = null;

    if (isResting && restStartTime !== null) {
      const totalRestDuration = typeof exercise.rest === 'string' 
        ? (exercise.rest.includes('секунд') ? parseInt(exercise.rest.split(' ')[0], 10) : parseInt(exercise.rest, 10)) || 60
        : (typeof exercise.rest === 'number' ? exercise.rest : 60);

      const calculateTime = () => {
        const elapsed = Math.floor((Date.now() - restStartTime!) / 1000);
        const remaining = totalRestDuration - elapsed;
        
        setRestTimer(Math.max(0, remaining));

        if (remaining <= 0) {
          console.log('[ExerciseCard] Таймер завершено, відтворюємо звук.');
          audioElement.play().catch(e => console.error("Помилка відтворення звуку:", e));
          
          if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification('Час відпочинку завершено!', {
                  body: `Час продовжити вправу: ${exercise.name}`,
                  icon: '/favicon.ico'
                });
              }
            });
          }
          
          setIsResting(false);
          setRestStartTime(null);
        } else {
          animationFrameId = requestAnimationFrame(calculateTime);
        }
      };
      
      calculateTime();
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isResting, restStartTime, exercise.rest, exercise.name, audioElement]);

  const handleStartRest = () => {
    setRestStartTime(Date.now());
    setIsResting(true);
  };

  const handleSetDataChange = (setIndex: number, field: keyof LoggedSetWithAchieved, value: string) => {
    // console.log(`ExerciseCard ${exercise.name}: handleSetDataChange for set ${setIndex}, field ${field}, value ${value}`);
    const newLoggedSetsData = [...loggedSetsData];
    newLoggedSetsData[setIndex] = { ...newLoggedSetsData[setIndex], [field]: value === '' ? null : parseFloat(value) };
    setLoggedSetsData(newLoggedSetsData);
  };

  const handleWeightContextChange = (setIndex: number, ctx: 'total' | 'per_dumbbell' | 'bodyweight') => {
    const newLoggedSetsData = [...loggedSetsData];
    newLoggedSetsData[setIndex] = { ...newLoggedSetsData[setIndex], weightContext: ctx };
    setLoggedSetsData(newLoggedSetsData);
  };
  
  const handleLogFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // console.log(`ExerciseCard ${exercise.name}: handleLogFormSubmit. loggedSetsData:`, loggedSetsData);
    // Фільтруємо підходи, щоб включити лише ті, які мають введені дані (не null)
    const validSets = loggedSetsData.filter(s => s.repsAchieved !== null && s.weightUsed !== null) as LoggedSetWithAchieved[];
    
    if (validSets.length === 0) {
        if (!confirm("Ви не ввели дані для жодного підходу. Залогувати вправу як пропущену (без зарахування прогресу)?")) {
          return; 
        }
      onLogExercise([], false); // Вважаємо не успішною, якщо даних немає
    } else {
        onLogExercise(validSets, allSetsSuccessful);
    }
    setShowLogForm(false);
  };

  const handleAddSet = () => {
    setNumSets(prev => prev + 1);
    setLoggedSetsData(prev => [...prev, { repsAchieved: null, weightUsed: null, completed: false }]);
  };

  const handleRemoveSet = () => {
    if (numSets > 1) {
      setNumSets(prev => prev - 1);
      setLoggedSetsData(prev => prev.slice(0, -1));
    }
  };
  
  const cardBaseClasses = "p-3 sm:p-4 rounded-lg shadow-md transition-all duration-300";
  const cardBgClasses = isCompleted ? "bg-green-800/50 hover:bg-green-700/60" : "bg-gray-700/60 hover:bg-gray-700/80";
  const completedTextClasses = isCompleted ? "text-green-300" : "text-yellow-300";

  return (
    <div className={`${cardBaseClasses} ${cardBgClasses} ${isCompleted ? 'border-l-4 border-green-500' : 'border-l-4 border-purple-600'}`}>
      <button 
        className="w-full flex justify-between items-center text-left focus:outline-none" 
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`exercise-details-${exercise.name.replace(/\s+/g, '-')}`}
      >
        <h5 className={`text-md sm:text-lg font-semibold ${completedTextClasses} hover:text-yellow-200 ${isCompleted ? 'line-through' : ''}`}>
          {exercise.name} {isCompleted && <i className="fas fa-check-circle text-green-300 ml-2"></i>}
        </h5>
        <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-purple-300 text-lg sm:text-xl transition-transform duration-200`}></i>
      </button>
      
      {isExpanded && (
        <div id={`exercise-details-${exercise.name.replace(/\s+/g, '-')}`} className="mt-3 space-y-3 border-t border-gray-500/50 pt-3">
          <div>
            <strong className="text-purple-200 block mb-1 text-xs sm:text-sm">
              <i className="fas fa-info-circle mr-1"></i>{UI_TEXT.exerciseInstructions}
            </strong>
            <div className="mt-2 text-xs sm:text-sm text-gray-300 whitespace-pre-line">
              {exercise.description}
            </div>
          </div>

          {exercise.videoSearchQuery && (
            <div className="mt-3">
              <strong className="text-purple-200 block mb-1 text-xs sm:text-sm">
                <i className="fab fa-youtube mr-1"></i>{UI_TEXT.videoSuggestion}
              </strong>
              <a 
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoSearchQuery)}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline text-sm inline-flex items-center"
              >
                {UI_TEXT.watchOnYouTube} <i className="fas fa-external-link-alt ml-1 text-xs"></i>
              </a>
            </div>
          )}

          {/* Рекомендації AI */}
          {exerciseRecommendation && (
            <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="fas fa-lightbulb text-blue-400 mt-1"></i>
                <div className="flex-1">
                  <h4 className="text-blue-300 font-semibold mb-2">Рекомендація AI</h4>
                  <p className="text-blue-200 text-sm mb-2">{exerciseRecommendation.recommendation}</p>
                  <div className="text-xs text-blue-300">
                    <p><strong>Причина:</strong> {exerciseRecommendation.reason}</p>
                    {exerciseRecommendation.suggestedWeight && (
                      <p><strong>Рекомендована вага:</strong> {exerciseRecommendation.suggestedWeight} кг</p>
                    )}
                    {exerciseRecommendation.suggestedReps && (
                      <p><strong>Рекомендовані повторення:</strong> {exerciseRecommendation.suggestedReps}</p>
                    )}
                    {exerciseRecommendation.suggestedSets && (
                      <p><strong>Рекомендовані підходи:</strong> {exerciseRecommendation.suggestedSets}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Варіації вправ */}
          {hasVariations && (
            <div className="mb-4 p-4 bg-purple-900/30 border border-purple-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="fas fa-random text-purple-400 mt-1"></i>
                <div className="flex-1">
                  <h4 className="text-purple-300 font-semibold mb-2">Варіації вправи</h4>
                  <p className="text-purple-200 text-sm mb-3">
                    Спробуйте варіацію для уникнення плато та підтримки прогресу
                  </p>
                  <div className="space-y-2">
                    {variations.slice(0, 2).map((variation) => (
                      <button
                        key={variation.id}
                        disabled={isSelectingVariation}
                        onClick={async () => {
                          if (isSelectingVariation) return;
                          try {
                            setIsSelectingVariation(true);
                            await onSelectVariation?.(variation);
                            setVariationsHidden(true); // сховати варіації після успішного вибору
                            setIsExpanded(false); // згорнути картку для чіткої індикації
                          } finally {
                            setIsSelectingVariation(false);
                          }
                        }}
                        className={`w-full text-left p-3 rounded border border-purple-600/30 transition-colors ${isSelectingVariation ? 'bg-purple-800/30 cursor-wait' : 'bg-purple-800/50 hover:bg-purple-700/50'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className="text-purple-200 font-medium">{variation.name}</h5>
                            <p className="text-purple-300 text-xs mt-1">
                              {variation.sets} підходів × {variation.reps} повторень
                            </p>
                            {variation.notes && (
                              <p className="text-purple-400 text-xs mt-1">{variation.notes}</p>
                            )}
                          </div>
                          <i className="fas fa-arrow-right text-purple-400 ml-2"></i>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
            <div className="bg-gray-600/70 p-2 rounded shadow">
              <strong className="block text-purple-200 mb-0.5"><i className="fas fa-layer-group mr-1"></i>{UI_TEXT.sets}</strong>
              <span className="text-gray-100">{typeof exercise.sets === 'string' ? exercise.sets : exercise.sets?.toString()}</span>
            </div>
            <div className="bg-gray-600/70 p-2 rounded shadow">
              <strong className="block text-purple-200 mb-0.5"><i className="fas fa-redo mr-1"></i>{UI_TEXT.reps}</strong>
              <span className="text-gray-100">{exercise.targetReps ?? exercise.reps}</span>
            </div>
            <div className="bg-gray-600/70 p-2 rounded shadow col-span-2 sm:col-span-1">
              <strong className="block text-purple-200 mb-0.5"><i className="fas fa-stopwatch mr-1"></i>{UI_TEXT.rest}</strong>
              <span className="text-gray-100">{exercise.rest || '-'}</span>
            </div>
            {exercise.targetWeight !== undefined && exercise.targetWeight !== null && (
                 <div className="bg-purple-700/60 p-2 rounded shadow col-span-full">
                    <strong className="block text-yellow-200 mb-0.5"><i className="fas fa-bullseye mr-1"></i>{UI_TEXT.targetWeight}</strong>
                    <span className="text-gray-100 font-semibold">{exercise.targetWeight} kg</span>
                 </div>
            )}
            {exercise.recommendation?.text && (
                 <div className="bg-blue-800/30 p-2 rounded shadow col-span-full text-blue-200">
                    <strong className="block text-blue-100 mb-0.5"><i className="fas fa-comment-dots mr-1"></i>Аналіз виконання на попередньому тренуванні та наступна рекомендація:</strong>
                    <p className="text-xs sm:text-sm">{exercise.recommendation.text}</p>
                 </div>
            )}

          {isActive && !isCompleted && (
            <div className="mt-3 pt-3 border-t border-gray-500/50 space-y-2 sm:space-y-0 sm:flex sm:space-x-3">
              <button
                onClick={handleStartRest}
                disabled={isResting}
                className={`w-full sm:w-auto font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out text-white flex items-center justify-center text-xs sm:text-sm mb-2 sm:mb-0
                            ${isResting ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <i className="fas fa-hourglass-half mr-2"></i>
                {isResting ? `Відпочинок: ${formatTime(restTimer)}` : `${UI_TEXT.startRest} (${typeof exercise.rest === 'number' ? `${exercise.rest} секунд` : exercise.rest ?? '60 секунд'})`}
              </button>

              <button 
                  onClick={() => {
                    // console.log(`ExerciseCard ${exercise.name}: 'Mark as Done' button clicked. Initializing form data.`);
                    if (exercise.sessionLoggedSets && exercise.sessionLoggedSets.length > 0) {
                      setLoggedSetsData(exercise.sessionLoggedSets.map(set => ({
                        repsAchieved: set.repsAchieved !== undefined ? set.repsAchieved : null,
                        weightUsed: set.weightUsed !== undefined ? set.weightUsed : null,
                        completed: set.completed ?? false,
                        weightContext: set.weightContext || (exercise.weightType === 'single' ? 'per_dumbbell' : exercise.weightType === 'total' ? 'total' : exercise.weightType === 'bodyweight' ? 'bodyweight' : undefined),
                      })));
                      setNumSets(exercise.sessionLoggedSets.length);
                    } else {
                      const initialSets = parseInt(exercise.sets.toString()) || 3;
                      const initialLoggedSets = Array(initialSets).fill({
                        repsAchieved: null,
                        weightUsed: exercise.weightType === 'bodyweight' ? 0 : null, // Вага тіла за замовчуванням 0
                        completed: false,
                        weightContext: exercise.weightType === 'single' ? 'per_dumbbell' : exercise.weightType === 'total' ? 'total' : exercise.weightType === 'bodyweight' ? 'bodyweight' : undefined,
                      });
                      setLoggedSetsData(initialLoggedSets);
                      setNumSets(initialSets);
                    }
                    setShowLogForm(true);
                  }}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out flex items-center justify-center text-xs sm:text-sm"
              >
                <i className="fas fa-check-square mr-2"></i>{UI_TEXT.markAsDone}
              </button>
              <button
                onClick={onSkipExercise}
                className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out flex items-center justify-center text-xs sm:text-sm"
              >
                <i className="fas fa-forward mr-2"></i>Пропустити
              </button>
            </div>
          )}
          {isCompleted && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs sm:text-sm text-green-200 font-medium"><i className="fas fa-check-double mr-1"></i>Вправу успішно залоговано!</p>
              {isActive && (
                <button
                  onClick={() => {
                    // Перевідкрити форму з уже внесеними даними
                    if (exercise.sessionLoggedSets && exercise.sessionLoggedSets.length > 0) {
                      setLoggedSetsData(exercise.sessionLoggedSets.map(set => ({
                        repsAchieved: set.repsAchieved !== undefined ? set.repsAchieved : null,
                        weightUsed: set.weightUsed !== undefined ? set.weightUsed : null,
                        completed: set.completed ?? false,
                        weightContext: set.weightContext || (exercise.weightType === 'single' ? 'per_dumbbell' : exercise.weightType === 'total' ? 'total' : exercise.weightType === 'bodyweight' ? 'bodyweight' : undefined),
                      })));
                      setNumSets(exercise.sessionLoggedSets.length);
                    } else {
                      const initialSets = parseInt(exercise.sets.toString()) || 3;
                      const initialLoggedSets = Array(initialSets).fill({
                        repsAchieved: null,
                        weightUsed: exercise.weightType === 'bodyweight' ? 0 : null, // Вага тіла за замовчуванням 0
                        completed: false,
                        weightContext: exercise.weightType === 'single' ? 'per_dumbbell' : exercise.weightType === 'total' ? 'total' : exercise.weightType === 'bodyweight' ? 'bodyweight' : undefined,
                      });
                      setLoggedSetsData(initialLoggedSets);
                      setNumSets(initialSets);
                    }
                    setIsCompleted(false);
                    setShowLogForm(true);
                  }}
                  className="text-xs sm:text-sm px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
                >
                  Редагувати
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {showLogForm && !isCompleted && isActive && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-3 z-[100]" onClick={() => setShowLogForm(false)}>
          <div className="bg-gray-700 p-3 sm:p-5 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg sm:text-xl font-semibold text-purple-300 mb-3">{UI_TEXT.logExercise}: {exercise.name}</h3>
            <p className="text-xs sm:text-sm text-gray-300 mb-1">План: {exercise.sets} підходів по {exercise.targetReps ?? exercise.reps} повторень.</p>
            {exercise.targetWeight !== null && exercise.targetWeight !== undefined && <p className="text-xs sm:text-sm text-gray-300 mb-2">Цільова вага: {exercise.targetWeight} кг.</p>}
            
            <form onSubmit={handleLogFormSubmit} className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs sm:text-sm font-medium text-yellow-300">Кількість підходів: {numSets}</p>
                <div className="flex space-x-2">
                  <button 
                    type="button"
                    onClick={handleRemoveSet}
                    disabled={numSets <= 1}
                    className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs sm:text-sm disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-minus"></i>
                  </button>
                  <button 
                    type="button"
                    onClick={handleAddSet}
                    className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs sm:text-sm"
                  >
                    <i className="fas fa-plus"></i>
                  </button>
                </div>
              </div>
              {Array.from({ length: numSets }).map((_, setIndex) => (
                <div key={setIndex} className="p-2 sm:p-3 bg-gray-600/70 rounded-md space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-yellow-300">Підхід {setIndex + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`reps-${setIndex}`} className="block text-xs text-purple-200 mb-1">{UI_TEXT.repsAchieved}</label>
                      <input 
                        type="number" 
                        id={`reps-${setIndex}`}
                        min="0"
                        placeholder={typeof (exercise.targetReps || exercise.reps) === 'string' 
                          ? (exercise.targetReps || exercise.reps).toString().split('-')[0] 
                          : (exercise.targetReps || exercise.reps)?.toString()}
                        value={loggedSetsData[setIndex]?.repsAchieved ?? ''}
                        onChange={(e) => handleSetDataChange(setIndex, 'repsAchieved', e.target.value)}
                        className="w-full p-2 bg-gray-500 border border-gray-400 rounded-md text-gray-100 text-xs sm:text-sm"
                        required
                      />
                    </div>
                    {exercise.weightType !== 'none' && (
                      <>
                        <div>
                          <label htmlFor={`weight-${setIndex}`} className="block text-xs text-purple-200 mb-1">
                            {getWeightLabel(exercise.weightType)}
                          </label>
                          <input
                            type="number"
                            id={`weight-${setIndex}`}
                            min="0"
                            step="0.5"
                            placeholder={exercise.targetWeight?.toString() ?? (exercise.weightType === 'bodyweight' ? '0' : '')}
                            value={loggedSetsData[setIndex]?.weightUsed !== null ? loggedSetsData[setIndex]?.weightUsed : (exercise.weightType === 'bodyweight' ? 0 : '')}
                            onChange={(e) => handleSetDataChange(setIndex, 'weightUsed', e.target.value)}
                            className="w-full p-2 bg-gray-500 border border-gray-400 rounded-md text-gray-100 text-xs sm:text-sm"
                            required={exercise.weightType !== 'bodyweight'}
                            disabled={exercise.weightType === 'bodyweight'}
                          />
                          {(exercise.weightType === 'total' || exercise.weightType === 'single') && (
                            <div className="mt-1 flex items-center space-x-2 text-[11px] text-gray-200">
                              {exercise.weightType === 'total' && (
                                <label className="inline-flex items-center space-x-1 cursor-pointer">
                                  <input type="radio" name={`wctx-${setIndex}`} className="form-radio" checked={loggedSetsData[setIndex]?.weightContext === 'total'} onChange={() => handleWeightContextChange(setIndex, 'total')} />
                                  <span>загальна</span>
                                </label>
                              )}
                              {exercise.weightType === 'single' && (
                                <label className="inline-flex items-center space-x-1 cursor-pointer">
                                  <input type="radio" name={`wctx-${setIndex}`} className="form-radio" checked={loggedSetsData[setIndex]?.weightContext === 'per_dumbbell'} onChange={() => handleWeightContextChange(setIndex, 'per_dumbbell')} />
                                  <span>1 гантель</span>
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-end space-x-2 mt-4">
                <button 
                  type="button"
                  onClick={() => setShowLogForm(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                >
                  {UI_TEXT.cancel}
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs sm:text-sm"
                >
                  {UI_TEXT.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ExerciseCard);