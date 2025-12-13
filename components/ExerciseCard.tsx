import React, { useState, useEffect, useRef } from 'react';
import { Exercise, LoggedSetWithAchieved, WeightType } from '../types';
import { UI_TEXT, formatTime } from '../constants';
import { fixExerciseWeightType } from '../utils/exerciseTypeDetector';

interface ExerciseCardProps {
  exercise: Exercise;
  isActive: boolean;
  onLogExercise: (loggedSets: LoggedSetWithAchieved[], success: boolean) => void;
  onSkipExercise: () => void;
  onUndoSkipExercise?: () => void;
  recommendations?: {
    exerciseName: string;
    recommendation: string;
    suggestedWeight?: number;
    suggestedReps?: number;
    suggestedSets?: number;
    reason: string;
  }[];
  exerciseAdaptation?: {
    exerciseName: string;
    originalSets: string;
    originalReps: string;
    adaptedSets: string;
    adaptedReps: string;
    adaptationReason: string;
    energyLevel: string;
  };
  variations?: Exercise[];
  onSelectVariation?: (variation: Exercise) => Promise<void> | void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  isActive,
  onLogExercise,
  onSkipExercise,
  onUndoSkipExercise,
  recommendations = [],
  exerciseAdaptation,
  variations = [],
  onSelectVariation
}) => {

  const [isExpanded, setIsExpanded] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(isActive ? exercise.isCompletedDuringSession : false);
  const [isSkipped, setIsSkipped] = useState<boolean>(isActive ? (exercise.isSkipped ?? false) : false);
  const [loggedSetsData, setLoggedSetsData] = useState<LoggedSetWithAchieved[]>([]);
  const [numSets, setNumSets] = useState(3);
  const [currentRecommendationIndex, setCurrentRecommendationIndex] = useState(0);
  const [allSetsSuccessful, setAllSetsSuccessful] = useState<boolean>(true);
  const [restTimer, setRestTimer] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);
  const [audioElement] = useState(() => new Audio('/sounds/Yeah_buddy_Ronnie_Ccoleman.mp3'));
  const [isSelectingVariation, setIsSelectingVariation] = useState<boolean>(false);
  const [variationsHidden, setVariationsHidden] = useState<boolean>(false);
  const [focusedWeightInput, setFocusedWeightInput] = useState<number | null>(null);

  // === ЛОГІКА ДЛЯ DRAG-TO-SCROLL (МИШКА) ===
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 8; // Швидкість скролу
    carouselRef.current.scrollLeft = scrollLeft - walk;
  };
  // ==========================================

  // Виправляємо weightType
  const correctedWeightType = fixExerciseWeightType(exercise.name, exercise.weightType);

  const getWeightLabel = (weightType: WeightType) => {
    switch (weightType) {
      case 'total':
        return 'Загальна вага (кг)';
      case 'single':
        return 'Вага 1 снаряда (кг)';
      case 'bodyweight':
        return 'Вага тіла (кг)';
      case 'none':
      default:
        return 'Вага (кг)';
    }
  };
  const getWeightDisplayHint = (weightType: WeightType, exerciseName: string) => {
    const name = exerciseName.toLowerCase();
    switch (weightType) {
      case 'total':
        if (name.includes('штанга')) return 'Штанга + диски';
        if (name.includes('тренажер')) return 'Весь блок';
        if (name.includes('присід')) return 'Штанга + диски';
        if (name.includes('жим')) return 'Штанга + диски';
        return 'Загальна вага';
      case 'single':
        if (name.includes('гантел')) return '1 гантель';
        if (name.includes('гир')) return '1 гиря';
        return '1 снаряд';
      case 'bodyweight':
        return 'Авто';
      default:
        return 'Вага';
    }
  };

  const getSmartWeightSuggestion = (weightType: WeightType, targetWeight?: number | null, exerciseName?: string) => {
    if (weightType === 'bodyweight') return 0;
    if (targetWeight) return targetWeight;
    
    const name = exerciseName?.toLowerCase() || '';
    if (name.includes('присідання') && weightType === 'total') return 60;
    if (name.includes('жим') && name.includes('штанга') && weightType === 'total') return 50;
    if (name.includes('гантел') && weightType === 'single') return 15;
    if (name.includes('тяга') && weightType === 'total') return 70;
    
    return undefined;
  };

  const getAutomaticWeightContext = (weightType: WeightType): 'total' | 'per_dumbbell' | 'bodyweight' => {
    switch (weightType) {
      case 'total':
        return 'total';
      case 'single':
        return 'per_dumbbell';
      case 'bodyweight':
        return 'bodyweight';
      default:
        return 'total';
    }
  };

  const allRecommendations = (() => {
    const recs: Array<{
      exerciseName: string;
      recommendation: string;
      suggestedWeight?: number;
      suggestedReps?: number;
      suggestedSets?: number;
      reason: string;
    }> = [];

    // 1. Адаптація
    if (exerciseAdaptation) {
      const setsChanged = exerciseAdaptation.originalSets !== exerciseAdaptation.adaptedSets;
      const repsChanged = exerciseAdaptation.originalReps !== exerciseAdaptation.adaptedReps;
      
      if (setsChanged || repsChanged) {
        recs.push({
          exerciseName: exercise.name,
          recommendation: `${exerciseAdaptation.adaptationReason}. Змінено: ${exerciseAdaptation.originalSets}×${exerciseAdaptation.originalReps} → ${exerciseAdaptation.adaptedSets}×${exerciseAdaptation.adaptedReps}`,
          reason: "Адаптація на основі самопочуття",
          suggestedSets: parseInt(exerciseAdaptation.adaptedSets) || undefined,
          suggestedReps: exerciseAdaptation.adaptedReps as any, 
          suggestedWeight: undefined
        });
      }
    }
    
    // 2. AI Рекомендації
    if (isActive) {
      const aiRecommendation = recommendations.find(rec => rec.exerciseName === exercise.name);
      if (aiRecommendation) {
        recs.push(aiRecommendation);
      }
    }
    
    // 3. Базові
    if (exercise.recommendation?.text) {
      recs.push({
        exerciseName: exercise.name,
        recommendation: exercise.recommendation.text,
        reason: "Базова рекомендація для прогресу",
        suggestedWeight: undefined,
        suggestedReps: undefined,
        suggestedSets: undefined
      });
    }
    
    return recs;
  })();

  const exerciseRecommendation = allRecommendations.length > 0 ? allRecommendations[0] : null;
  const hasVariations = !variationsHidden && variations.length > 0;

  useEffect(() => {
    if (!isActive) {
      if (isCompleted) setIsCompleted(false);
      if (isSkipped) setIsSkipped(false);
      setAllSetsSuccessful(true);
      return;
    }

    const newIsCompleted = exercise.isCompletedDuringSession;
    const newIsSkipped = exercise.isSkipped ?? false;
    
    if (isCompleted !== newIsCompleted) setIsCompleted(newIsCompleted);
    if (isSkipped !== newIsSkipped) setIsSkipped(newIsSkipped);
    
    setAllSetsSuccessful(exercise.sessionSuccess ?? true);
    
    if ((newIsCompleted || newIsSkipped) && !showLogForm) {
      setShowLogForm(false);
    }
    if ((newIsCompleted || newIsSkipped) && !showLogForm) {
      setIsExpanded(false);
    }
  }, [exercise.isCompletedDuringSession, exercise.sessionSuccess, exercise.isSkipped, exercise.name, isCompleted, isSkipped, showLogForm, isActive]);

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
    const newLoggedSetsData = [...loggedSetsData];
    newLoggedSetsData[setIndex] = { 
      ...newLoggedSetsData[setIndex], 
      [field]: value === '' ? null : parseFloat(value),
      weightContext: getAutomaticWeightContext(exercise.weightType)
    };
    setLoggedSetsData(newLoggedSetsData);
  };

  const handleLogFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validSets = loggedSetsData.filter(s => {
      const hasReps = s.repsAchieved !== null;
      const hasWeight = correctedWeightType === 'bodyweight' || correctedWeightType === 'none' 
        ? true 
        : s.weightUsed !== null;
      return hasReps && hasWeight;
    }) as LoggedSetWithAchieved[];
    
    if (validSets.length === 0) {
        if (!confirm("Ви не ввели дані для жодного підходу. Залогувати вправу як пропущену (без зарахування прогресу)?")) {
          return; 
        }
      onLogExercise([], false); 
    } else {
        const normalizedSets = validSets.map(set => ({
          ...set,
          weightUsed: (correctedWeightType === 'bodyweight' || correctedWeightType === 'none') && set.weightUsed === null 
            ? 0 
            : set.weightUsed
        }));
        onLogExercise(normalizedSets, allSetsSuccessful);
    }
    setShowLogForm(false);
  };

  const handleAddSet = () => {
    setNumSets(prev => prev + 1);
    setLoggedSetsData(prev => [...prev, { 
      repsAchieved: null, 
      weightUsed: exercise.weightType === 'bodyweight' ? 0 : null, 
      completed: false,
      weightContext: getAutomaticWeightContext(exercise.weightType)
    }]);
  };

  const handleRemoveSet = () => {
    if (numSets > 1) {
      setNumSets(prev => prev - 1);
      setLoggedSetsData(prev => prev.slice(0, -1));
    }
  };

  const handleQuickFill = () => {
    const targetRepsValue = typeof exercise.targetReps === 'number' 
      ? exercise.targetReps 
      : typeof exercise.reps === 'string' 
        ? parseInt(exercise.reps.split('-')[0]) || 10
        : 10;
    
    const suggestedWeight = getSmartWeightSuggestion(exercise.weightType, exercise.targetWeight, exercise.name) || 0;
    
    const filledSets = Array(numSets).fill(null).map(() => ({
      repsAchieved: targetRepsValue,
      weightUsed: exercise.weightType === 'bodyweight' ? 0 : suggestedWeight,
      completed: false,
      weightContext: getAutomaticWeightContext(exercise.weightType)
    }));
    
    setLoggedSetsData(filledSets);
  };
  
  const cardBaseClasses = "p-3 sm:p-4 rounded-lg shadow-md transition-all duration-300";
  
  const getCardStyles = () => {
    if (!isActive) {
      return {
        bgClasses: "bg-gray-700/60 hover:bg-gray-700/80",
        textClasses: "text-yellow-300",
        borderClasses: "border-l-4 border-fitness-gold-600"
      };
    }

    if (isSkipped) {
      return {
        bgClasses: "bg-orange-800/50 hover:bg-orange-700/60",
        textClasses: "text-orange-300",
        borderClasses: "border-l-4 border-orange-500"
      };
    }
    if (isCompleted) {
      return {
        bgClasses: "bg-green-800/50 hover:bg-green-700/60",
        textClasses: "text-green-300",
        borderClasses: "border-l-4 border-green-500"
      };
    }
    return {
      bgClasses: "bg-gray-700/60 hover:bg-gray-700/80",
      textClasses: "text-yellow-300",
      borderClasses: "border-l-4 border-fitness-gold-600"
    };
  };
  
  const cardStyles = getCardStyles();
  const cardBgClasses = cardStyles.bgClasses;
  const completedTextClasses = cardStyles.textClasses;
  const borderClasses = cardStyles.borderClasses;

  return (
    <div className={`${cardBaseClasses} ${cardBgClasses} ${borderClasses}`}>
      <button
        className="w-full flex justify-between items-center text-left focus:outline-none"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`exercise-details-${exercise.name.replace(/\s+/g, '-')}`}
      >
        <h5 className={`text-md sm:text-lg font-semibold ${completedTextClasses} hover:text-yellow-200 ${(isActive && (isCompleted || isSkipped)) ? 'line-through' : ''}`}>
          {exercise.name} {isActive && isCompleted && <i className="fas fa-check-circle text-green-300 ml-2"></i>} {isActive && isSkipped && <i className="fas fa-forward text-orange-300 ml-2"></i>}
        </h5>
        <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-fitness-gold-300 text-lg sm:text-xl transition-transform duration-200`}></i>
      </button>
      
      {isExpanded && (
        <div id={`exercise-details-${exercise.name.replace(/\s+/g, '-')}`} className="mt-3 space-y-3 border-t border-gray-500/50 pt-3">
          <div>
            <strong className="text-fitness-gold-200 block mb-1 text-xs sm:text-sm">
              <i className="fas fa-info-circle mr-1"></i>{UI_TEXT.exerciseInstructions}
            </strong>
            <div className="mt-2 text-xs sm:text-sm text-gray-300 whitespace-pre-line">
              {exercise.description}
            </div>
          </div>

          {exercise.videoSearchQuery && (
            <div className="mt-3">
              <strong className="text-fitness-gold-200 block mb-1 text-xs sm:text-sm">
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

          {/* Свайпний карусель рекомендацій (MOUSE + TOUCH) */}
          {allRecommendations.length > 0 && (
            <div className="mb-4">
              {/* Індикатор поточної позиції */}
              {allRecommendations.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  {allRecommendations.map((_, index) => (
                    <div
                      key={`indicator-${index}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === currentRecommendationIndex
                          ? 'w-6 bg-fitness-gold-500'
                          : 'w-2 bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              )}
              
              {/* Карусель з рекомендаціями */}
              <div className="relative">
                <div 
                  ref={carouselRef}
                  className={`flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 ${isDragging ? 'cursor-grabbing snap-none' : 'cursor-grab'}`}
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                  }}
                  onScroll={(e) => {
                    const element = e.currentTarget;
                    const scrollLeft = element.scrollLeft;
                    const cardWidth = element.offsetWidth;
                    const newIndex = Math.round(scrollLeft / cardWidth);
                    if (newIndex !== currentRecommendationIndex && newIndex >= 0 && newIndex < allRecommendations.length) {
                      setCurrentRecommendationIndex(newIndex);
                    }
                  }}
                  // Обробники для миші
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                >
                  {allRecommendations.map((rec, index) => (
                    <div
                      key={`${rec.exerciseName}-${index}`}
                      className={`flex-shrink-0 w-full snap-start p-4 rounded-lg select-none ${ // select-none щоб текст не виділявся при свайпі
                        rec.reason === "Базова рекомендація для прогресу" 
                          ? "bg-green-900/30 border border-green-500/30" 
                          : rec.reason === "Адаптація на основі самопочуття"
                            ? "bg-orange-900/30 border border-orange-500/30"
                            : "bg-blue-900/30 border border-blue-500/30"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <i className={`fas mt-1 ${
                          rec.reason === "Базова рекомендація для прогресу" 
                            ? "fa-lightbulb text-green-400" 
                            : rec.reason === "Адаптація на основі самопочуття"
                              ? "fa-heart-pulse text-orange-400"
                              : "fa-robot text-blue-400"
                        }`}></i>
                        <div className="flex-1">
                          <h4 className={`font-semibold mb-2 ${
                            rec.reason === "Базова рекомендація для прогресу" 
                              ? "text-green-300" 
                              : rec.reason === "Адаптація на основі самопочуття"
                                ? "text-orange-300"
                                : "text-blue-300"
                          }`}>
                            {rec.reason === "Базова рекомендація для прогресу" 
                              ? "Рекомендація для прогресу" 
                              : rec.reason === "Адаптація на основі самопочуття"
                                ? "Адаптація на основі самопочуття"
                                : "Рекомендація на основі аналізу"}
                          </h4>
                          <p className={`text-sm mb-2 ${
                            rec.reason === "Базова рекомендація для прогресу" 
                              ? "text-green-200" 
                              : rec.reason === "Адаптація на основі самопочуття"
                                ? "text-orange-200"
                                : "text-blue-200"
                          }`}>{rec.recommendation}</p>
                          {rec.reason !== "Базова рекомендація для прогресу" && (
                            <div className={`text-xs ${
                              rec.reason === "Адаптація на основі самопочуття"
                                ? "text-orange-300"
                                : "text-blue-300"
                            }`}>
                              <p><strong>Причина:</strong> {rec.reason}</p>
                              {rec.suggestedWeight && (
                                <p><strong>Рекомендована вага:</strong> {rec.suggestedWeight} кг</p>
                              )}
                              {rec.suggestedReps && (
                                <p><strong>Рекомендовані повторення:</strong> {rec.suggestedReps}</p>
                              )}
                              {rec.suggestedSets && (
                                <p><strong>Рекомендовані підходи:</strong> {rec.suggestedSets}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Варіації вправ */}
          {hasVariations && (
            <div className="mb-4 p-4 bg-fitness-gold-900/30 border border-fitness-gold-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="fas fa-random text-fitness-gold-400 mt-1"></i>
                <div className="flex-1">
                  <h4 className="text-fitness-gold-300 font-semibold mb-2">Варіації вправи</h4>
                  <p className="text-fitness-gold-200 text-sm mb-3">
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
                            setVariationsHidden(true); 
                            setIsExpanded(false); 
                          } finally {
                            setIsSelectingVariation(false);
                          }
                        }}
                        className={`w-full text-left p-3 rounded border border-fitness-gold-600/30 transition-colors ${isSelectingVariation ? 'bg-fitness-gold-800/30 cursor-wait' : 'bg-fitness-gold-800/50 hover:bg-fitness-gold-700/50'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className="text-fitness-gold-200 font-medium">{variation.name}</h5>
                            <p className="text-fitness-gold-300 text-xs mt-1">
                              {variation.sets} підходів × {variation.reps} повторень
                            </p>
                            {variation.notes && (
                              <p className="text-fitness-gold-400 text-xs mt-1">{variation.notes}</p>
                            )}
                          </div>
                          <i className="fas fa-arrow-right text-fitness-gold-400 ml-2"></i>
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
              <strong className="block text-fitness-gold-200 mb-0.5"><i className="fas fa-layer-group mr-1"></i>{UI_TEXT.sets}</strong>
              {exerciseRecommendation && exerciseRecommendation.suggestedSets && isActive ? (
                <span className="text-gray-100 font-semibold">{exerciseRecommendation.suggestedSets}</span>
              ) : (
                <span className="text-gray-100">{typeof exercise.sets === 'string' ? exercise.sets : exercise.sets?.toString()}</span>
              )}
            </div>
            <div className="bg-gray-600/70 p-2 rounded shadow">
              <strong className="block text-fitness-gold-200 mb-0.5"><i className="fas fa-redo mr-1"></i>{UI_TEXT.reps}</strong>
              <span className="text-gray-100">{exercise.targetReps ?? exercise.reps}</span>
            </div>
            <div className="bg-gray-600/70 p-2 rounded shadow col-span-2 sm:col-span-1">
              <strong className="block text-fitness-gold-200 mb-0.5"><i className="fas fa-stopwatch mr-1"></i>{UI_TEXT.rest}</strong>
              <span className="text-gray-100">{exercise.rest || '-'}</span>
            </div>
            {exercise.targetWeight !== undefined && exercise.targetWeight !== null && (
                 <div className="bg-fitness-gold-700/60 p-2 rounded shadow col-span-full">
                    <strong className="block text-yellow-200 mb-0.5"><i className="fas fa-bullseye mr-1"></i>{UI_TEXT.targetWeight}</strong>
                    <span className="text-gray-100 font-semibold">{exercise.targetWeight} kg</span>
                 </div>
            )}

          {isActive && !isCompleted && !isSkipped && (
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
                    if (exercise.sessionLoggedSets && exercise.sessionLoggedSets.length > 0) {
                      setLoggedSetsData(exercise.sessionLoggedSets.map(set => ({
                        repsAchieved: set.repsAchieved !== undefined ? set.repsAchieved : null,
                        weightUsed: set.weightUsed !== undefined ? set.weightUsed : null,
                        completed: set.completed ?? false,
                        weightContext: set.weightContext || getAutomaticWeightContext(exercise.weightType),
                      })));
                      setNumSets(exercise.sessionLoggedSets.length);
                    } else {
                      const preferredSets = (exerciseRecommendation && exerciseRecommendation.suggestedSets) ? exerciseRecommendation.suggestedSets : (parseInt(exercise.sets.toString()) || 3);
                      const initialLoggedSets = Array.from({ length: preferredSets }).map(() => ({
                        repsAchieved: null,
                        weightUsed: exercise.weightType === 'bodyweight' ? 0 : null,
                        completed: false,
                        weightContext: getAutomaticWeightContext(exercise.weightType),
                      }));
                      setLoggedSetsData(initialLoggedSets);
                      setNumSets(preferredSets);
                    }
                    setShowLogForm(true);
                  }}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out flex items-center justify-center text-xs sm:text-sm"
              >
                <i className="fas fa-check-square mr-2"></i>{UI_TEXT.markAsDone}
              </button>
              <button
                onClick={() => {
                  setIsSkipped(true);
                  setIsCompleted(false);
                  setShowLogForm(false);
                  setIsExpanded(false);
                  onSkipExercise();
                }}
                className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out flex items-center justify-center text-xs sm:text-sm"
              >
                <i className="fas fa-forward mr-2"></i>Пропустити
              </button>
            </div>
          )}
          {(isCompleted || isSkipped) && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                {isCompleted && <p className="text-xs sm:text-sm text-green-200 font-medium"><i className="fas fa-check-double mr-1"></i>Вправу успішно залоговано!</p>}
                {isSkipped && <p className="text-xs sm:text-sm text-orange-200 font-medium"><i className="fas fa-forward mr-1"></i>Вправу пропущено!</p>}
              </div>
              {isActive && (
                <div className="flex space-x-2">
                  {!isSkipped && ( 
                    <button
                      onClick={() => {
                        setShowLogForm(true);
                        setIsExpanded(true);
                        
                        if (exercise.sessionLoggedSets && exercise.sessionLoggedSets.length > 0) {
                          const loadedSets = exercise.sessionLoggedSets.map(set => {
                            const loadedSet = {
                              repsAchieved: set.repsAchieved ?? null,
                              weightUsed: set.weightUsed ?? null,
                              completed: set.completed ?? false,
                              weightContext: set.weightContext || getAutomaticWeightContext(exercise.weightType),
                            };
                            return loadedSet;
                          });
                          setLoggedSetsData(loadedSets);
                          setNumSets(exercise.sessionLoggedSets.length);
                        } else {
                          const initialSets = parseInt(exercise.sets.toString()) || 3;
                          const initialLoggedSets = Array(initialSets).fill(null).map(() => ({
                            repsAchieved: null,
                            weightUsed: exercise.weightType === 'bodyweight' ? 0 : null,
                            completed: false,
                            weightContext: getAutomaticWeightContext(exercise.weightType),
                          }));
                          setLoggedSetsData(initialLoggedSets);
                          setNumSets(initialSets);
                        }
                        setTimeout(() => {
                          const modal = document.querySelector('[class*="fixed inset-0"]');
                          if (modal) {
                            const modalContent = modal.querySelector('[class*="overflow-y-auto"]');
                            if (modalContent) {
                              modalContent.scrollTop = 0;
                            }
                          }
                        }, 100);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out flex items-center justify-center text-xs sm:text-sm"
                    >
                      <i className="fas fa-edit mr-2"></i>Редагувати
                    </button>
                  )}
                  {isSkipped && ( 
                    <button
                      onClick={() => {
                        setIsSkipped(false);
                        setIsCompleted(false);
                        if (onUndoSkipExercise) {
                          onUndoSkipExercise();
                        }
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out flex items-center justify-center text-xs sm:text-sm"
                    >
                      <i className="fas fa-undo mr-2"></i>Скасувати пропуск
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {showLogForm && !isSkipped && isActive && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={() => setShowLogForm(false)}>
          <div className="bg-gray-700 p-4 sm:p-5 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg sm:text-xl font-semibold text-fitness-gold-300 mb-3">{UI_TEXT.logExercise}: {exercise.name}</h3>
            <p className="text-xs sm:text-sm text-gray-300 mb-1">План: {exercise.sets} підходів по {exercise.targetReps ?? exercise.reps} повторень.</p>
            {exercise.targetWeight !== null && exercise.targetWeight !== undefined && <p className="text-xs sm:text-sm text-gray-300 mb-2">Цільова вага: {exercise.targetWeight} кг.</p>}
            
            {correctedWeightType === 'bodyweight' ? (
              <div className="bg-green-900/30 border border-green-500/30 rounded-md p-2 mb-3">
                <p className="text-xs text-green-200 flex items-start">
                  <i className="fas fa-check-circle mr-2 mt-0.5"></i>
                  <span>Використовується ваша власна вага тіла (вводити не потрібно)</span>
                </p>
              </div>
            ) : correctedWeightType !== 'none' && (
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-md p-2 mb-3">
                <p className="text-xs text-blue-200 flex items-start">
                  <i className="fas fa-info-circle mr-2 mt-0.5"></i>
                  <span>
                    {(() => {
                      switch (correctedWeightType) {
                        case 'total':
                          return 'Вказуйте загальну вагу (штанга + диски або весь блок тренажера)';
                        case 'single':
                          return 'Вказуйте вагу одного снаряда (тримаєте два - вводите вагу одного)';
                        default:
                          return '';
                      }
                    })()}
                  </span>
                </p>
              </div>
            )}
            
            <form onSubmit={handleLogFormSubmit} className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs sm:text-sm font-medium text-yellow-300">Кількість підходів: {numSets}</p>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleQuickFill}
                    className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
                    title="Швидко заповнити всі підходи"
                  >
                    <i className="fas fa-magic"></i>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSet}
                    disabled={numSets <= 1}
                    className="px-2 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-xs sm:text-sm disabled:bg-gray-500 disabled:cursor-not-allowed"
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
              {Array.from({ length: numSets }).map((_, setIndex) => {
                return (
                <div key={`${exercise.id}-set-${setIndex}`} className="p-2 bg-gray-600/70 rounded-md">
                  <p className="text-xs font-medium text-yellow-300 mb-2">Підхід {setIndex + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`reps-${setIndex}`} className="block text-xs text-fitness-gold-200 mb-1">{UI_TEXT.repsAchieved}</label>
                      <input
                        type="number"
                        id={`reps-${setIndex}`}
                        min="0"
                        placeholder={typeof (exercise.targetReps || exercise.reps) === 'string'
                          ? (exercise.targetReps || exercise.reps).toString().split('-')[0]
                          : (exercise.targetReps || exercise.reps)?.toString()}
                        value={loggedSetsData[setIndex]?.repsAchieved ?? ''}
                        onChange={(e) => handleSetDataChange(setIndex, 'repsAchieved', e.target.value)}
                        className="w-full p-2.5 bg-gray-500 border border-gray-400 rounded-md text-gray-100 text-sm"
                        required
                      />
                    </div>
                    {correctedWeightType !== 'none' && (
                      <>
                        <div>
                          <label htmlFor={`weight-${setIndex}`} className="block text-xs text-fitness-gold-200 mb-1">
                            {getWeightLabel(correctedWeightType)}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              id={`weight-${setIndex}`}
                              min="0"
                              step="0.5"
                              placeholder={correctedWeightType === 'bodyweight' ? 'Авто' : ''}
                              value={loggedSetsData[setIndex]?.weightUsed ?? (correctedWeightType === 'bodyweight' ? 0 : '')}
                              onChange={(e) => handleSetDataChange(setIndex, 'weightUsed', e.target.value)}
                              className={`w-full p-2.5 pr-16 border border-gray-400 rounded-md text-sm ${
                                correctedWeightType === 'bodyweight' 
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                  : 'bg-gray-500 text-gray-100'
                              }`}
                              required={correctedWeightType !== 'bodyweight'}
                              disabled={correctedWeightType === 'bodyweight'}
                              onFocus={() => setFocusedWeightInput(setIndex)}
                              onBlur={() => setFocusedWeightInput(null)}
                            />
                            <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-[10px] sm:text-xs text-gray-400 pointer-events-none font-medium transition-opacity duration-200 ${
                              (loggedSetsData[setIndex]?.weightUsed !== null && 
                               loggedSetsData[setIndex]?.weightUsed !== undefined && 
                               loggedSetsData[setIndex]?.weightUsed !== 0) || 
                              focusedWeightInput === setIndex ? 'opacity-0' : 'opacity-60'
                            }`}>
                              {getWeightDisplayHint(correctedWeightType, exercise.name)}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-600">
                <button
                  type="button"
                  onClick={() => setShowLogForm(false)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  {UI_TEXT.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
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