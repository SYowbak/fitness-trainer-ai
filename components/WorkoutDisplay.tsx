import React, { useState, useEffect } from 'react';
import { DailyWorkoutPlan, UserProfile, Exercise as ExerciseType, LoggedSetWithAchieved, WellnessCheck, AdaptiveWorkoutPlan } from '../types';
import { UI_TEXT } from '../constants';
import ExerciseCard from './ExerciseCard';
import Spinner from './Spinner';
import WorkoutEditMode from './WorkoutEditMode';

interface WorkoutDisplayProps {
  userProfile: UserProfile | null;
  workoutPlan: DailyWorkoutPlan[] | null;
  onGenerateNewPlan: () => void;
  isLoading: boolean;
  activeDay: number | null;
  sessionExercises: ExerciseType[];
  onStartWorkout: (dayNumber: number) => void;
  onEndWorkout: () => void;
  onLogExercise: (exerciseIndex: number, loggedSets: LoggedSetWithAchieved[], success: boolean) => void;
  workoutTimerDisplay: string;
  isApiKeyMissing: boolean;
  onSaveWorkoutPlan: (plan: DailyWorkoutPlan[]) => void;
  exerciseRecommendations?: any[];
  exerciseVariations?: Map<string, any[]>;
  onSelectVariation?: (exerciseName: string, variation: any) => void;
  progressTrends?: any;
  wellnessCheck?: WellnessCheck | null;
  adaptiveWorkoutPlan?: AdaptiveWorkoutPlan | null;
}

const WorkoutDisplay: React.FC<WorkoutDisplayProps> = ({
  userProfile,
  workoutPlan,
  onGenerateNewPlan,
  isLoading,
  activeDay,
  sessionExercises,
  onStartWorkout,
  onEndWorkout,
  onLogExercise,
  workoutTimerDisplay,
  isApiKeyMissing,
  onSaveWorkoutPlan,
  exerciseRecommendations = [],
  exerciseVariations = new Map(),
  onSelectVariation,
  progressTrends,
  wellnessCheck,
  adaptiveWorkoutPlan
}) => {
  const [selectedDayForView, setSelectedDayForView] = useState<number | null>(
    workoutPlan && workoutPlan.length > 0 ? workoutPlan[0].day : null
  );
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const isWorkoutPlanValid = workoutPlan && Array.isArray(workoutPlan);

  useEffect(() => {
    // The analysis logic has been moved to the workout completion flow (e.g., in the parent component)
    // This useEffect is no longer needed for triggering analysis on day selection.
  }, []); // Empty dependency array, runs only once on mount, but the analysis logic is removed.

  if (isLoading && (!isWorkoutPlanValid || workoutPlan.length === 0) && activeDay === null) {
    return <Spinner message={UI_TEXT.generatingWorkout} />;
  }
  
  if (isApiKeyMissing && !userProfile && !workoutPlan) {
    return (
       <div className="text-center p-6 sm:p-8 bg-gray-800/80 rounded-lg shadow-xl mt-6 sm:mt-10 backdrop-blur-sm">
        <i className="fas fa-exclamation-triangle text-4xl sm:text-5xl text-red-400 mb-4 sm:mb-6"></i>
        <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-red-300">{UI_TEXT.apiKeyMissing}</h2>
        <p className="text-gray-400 text-sm sm:text-base">{UI_TEXT.getStarted}</p>
      </div>
    );
  }

  if (!isWorkoutPlanValid || workoutPlan.length === 0) {
    return (
      <div className="text-center p-6 sm:p-8 bg-gray-800/80 rounded-lg shadow-xl mt-6 sm:mt-10 backdrop-blur-sm">
        <i className="fas fa-exclamation-circle text-4xl sm:text-5xl text-yellow-400 mb-4 sm:mb-6"></i>
        <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-purple-300">{UI_TEXT.noWorkoutPlan}</h2>
        {userProfile && !isLoading && (
          <button
            onClick={onGenerateNewPlan}
            disabled={isApiKeyMissing}
            className={`font-bold py-2.5 px-5 sm:py-3 sm:px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 flex items-center mx-auto text-sm sm:text-base ${isApiKeyMissing ? 'bg-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
          >
            <i className="fas fa-magic mr-2"></i>{UI_TEXT.generateWorkout}
          </button>
        )}
        {isLoading && <Spinner message={UI_TEXT.generatingWorkout} />}
        {!userProfile && !isLoading && !isApiKeyMissing && (
          <p className="text-gray-400 text-sm sm:text-base">{UI_TEXT.getStarted}</p>
        )}
      </div>
    );
  }

  if (isEditMode && userProfile) {
    return (
      <WorkoutEditMode
        userProfile={userProfile}
        workoutPlan={workoutPlan}
        onSavePlan={(plan) => {
          onSaveWorkoutPlan(plan);
          setIsEditMode(false);
        }}
        onCancel={() => setIsEditMode(false)}
      />
    );
  }

  const currentDayPlan = activeDay !== null 
    ? (isWorkoutPlanValid ? workoutPlan.find(p => p.day === activeDay) : null) 
    : (selectedDayForView !== null && isWorkoutPlanValid ? workoutPlan.find(p => p.day === selectedDayForView) : null);

  const exercisesToDisplay = activeDay !== null 
    ? sessionExercises 
    : currentDayPlan?.exercises || [];

  // Відображення трендів прогресу
  const renderProgressTrends = () => {
    if (!progressTrends) return null;

    const getTrendIcon = (progress: string) => {
      switch (progress) {
        case 'improving': return 'fas fa-arrow-up text-green-400';
        case 'plateau': return 'fas fa-minus text-yellow-400';
        case 'declining': return 'fas fa-arrow-down text-red-400';
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
      <div className="mb-6 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-300 mb-3">
          <i className="fas fa-chart-line mr-2"></i>
          Аналіз прогресу
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl mb-1">
              <i className={getTrendIcon(progressTrends.overallProgress)}></i>
            </div>
            <p className="text-sm text-gray-300">Загальний тренд</p>
            <p className="text-xs text-gray-400">{getTrendText(progressTrends.overallProgress)}</p>
          </div>
          <div className="text-center">
            <div className="text-2xl text-blue-400 mb-1">
              <i className="fas fa-dumbbell"></i>
            </div>
            <p className="text-sm text-gray-300">Середня вага</p>
            <p className="text-xs text-gray-400">{Math.round(progressTrends.strengthProgress)} кг</p>
          </div>
          <div className="text-center">
            <div className="text-2xl text-green-400 mb-1">
              <i className="fas fa-running"></i>
            </div>
            <p className="text-sm text-gray-300">Середні повторення</p>
            <p className="text-xs text-gray-400">{Math.round(progressTrends.enduranceProgress)}</p>
          </div>
          <div className="text-center">
            <div className="text-2xl text-purple-400 mb-1">
              <i className="fas fa-calendar-check"></i>
            </div>
            <p className="text-sm text-gray-300">Консистентність</p>
            <p className="text-xs text-gray-400">{Math.round(progressTrends.consistencyScore)}%</p>
          </div>
        </div>
      </div>
    );
  };

  // Відображення інформації про адаптивне тренування
  const renderAdaptiveWorkoutInfo = () => {
    if (!adaptiveWorkoutPlan || !wellnessCheck) return null;

    const getIntensityText = (intensity: string) => {
      switch (intensity) {
        case 'reduced': return UI_TEXT.intensityReduced;
        case 'maintained': return UI_TEXT.intensityMaintained;
        case 'increased': return UI_TEXT.intensityIncreased;
        default: return 'Інтенсивність адаптована';
      }
    };

    const getFocusText = (focus: string) => {
      switch (focus) {
        case 'recovery': return UI_TEXT.focusRecovery;
        case 'maintenance': return UI_TEXT.focusMaintenance;
        case 'performance': return UI_TEXT.focusPerformance;
        default: return 'Фокус адаптований';
      }
    };

    return (
      <div className="mb-6 p-4 bg-green-900/30 border border-green-500/30 rounded-lg">
        <div className="flex items-start space-x-3">
          <i className="fas fa-heart text-green-400 mt-1"></i>
          <div className="flex-1">
            <h3 className="text-green-300 font-semibold mb-2">
              <i className="fas fa-magic mr-2"></i>
              {UI_TEXT.adaptiveWorkout}
            </h3>
            <p className="text-green-200 text-sm mb-3">
              {UI_TEXT.workoutAdapted}
            </p>
            
            {adaptiveWorkoutPlan.overallAdaptation && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-green-300 font-medium">Інтенсивність:</p>
                  <p className="text-green-200">{getIntensityText(adaptiveWorkoutPlan.overallAdaptation.intensity)}</p>
                </div>
                <div>
                  <p className="text-green-300 font-medium">Фокус:</p>
                  <p className="text-green-200">{getFocusText(adaptiveWorkoutPlan.overallAdaptation.focus)}</p>
                </div>
                <div>
                  <p className="text-green-300 font-medium">Причина:</p>
                  <p className="text-green-200 text-xs">{adaptiveWorkoutPlan.overallAdaptation.reason}</p>
                </div>
              </div>
            )}

            {/* Адаптації вправ */}
            {adaptiveWorkoutPlan.adaptations && adaptiveWorkoutPlan.adaptations.length > 0 && (
              <div className="mt-4">
                <h4 className="text-green-300 font-medium mb-2">Адаптації вправ:</h4>
                <div className="space-y-2">
                  {adaptiveWorkoutPlan.adaptations.map((adaptation, index) => (
                    <div key={index} className="text-xs text-green-200 bg-green-900/20 p-2 rounded">
                      <p><strong>{adaptation.exerciseName}:</strong> {adaptation.adaptationReason}</p>
                      <p className="text-green-300">
                        {adaptation.originalSets}×{adaptation.originalReps} → {adaptation.adaptedSets}×{adaptation.adaptedReps}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Відображення інформації про самопочуття
  const renderWellnessInfo = () => {
    if (!wellnessCheck) return null;

    const getEnergyIcon = (level: string) => {
      switch (level) {
        case 'very_low': return 'fas fa-battery-empty text-red-400';
        case 'low': return 'fas fa-battery-quarter text-orange-400';
        case 'normal': return 'fas fa-battery-half text-yellow-400';
        case 'high': return 'fas fa-battery-three-quarters text-green-400';
        case 'very_high': return 'fas fa-battery-full text-green-500';
        default: return 'fas fa-battery-half text-gray-400';
      }
    };

    // Додаємо функції для перекладу значень
    const getEnergyText = (level: string) => {
      switch (level) {
        case 'very_low': return UI_TEXT.veryLow;
        case 'low': return UI_TEXT.low;
        case 'normal': return UI_TEXT.normal;
        case 'high': return UI_TEXT.high;
        case 'very_high': return UI_TEXT.veryHigh;
        default: return UI_TEXT.normal;
      }
    };
    const getSleepText = (quality: string) => {
      switch (quality) {
        case 'poor': return UI_TEXT.poor;
        case 'fair': return UI_TEXT.fair;
        case 'good': return UI_TEXT.good;
        case 'excellent': return UI_TEXT.excellent;
        default: return UI_TEXT.good;
      }
    };

    return (
      <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg">
        <div className="flex items-start space-x-3">
          <i className="fas fa-user-check text-blue-400 mt-1"></i>
          <div className="flex-1">
            <h3 className="text-blue-300 font-semibold mb-2">
              <i className="fas fa-heart mr-2"></i>
              Ваше самопочуття
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <i className={`${getEnergyIcon(wellnessCheck.energyLevel)} text-2xl mb-1`}></i>
                <p className="text-blue-300 font-medium">Енергія</p>
                <p className="text-blue-200 text-xs">{getEnergyText(wellnessCheck.energyLevel)}</p>
              </div>
              <div className="text-center">
                <i className="fas fa-bed text-blue-400 text-2xl mb-1"></i>
                <p className="text-blue-300 font-medium">Сон</p>
                <p className="text-blue-200 text-xs">{getSleepText(wellnessCheck.sleepQuality)}</p>
              </div>
              <div className="text-center">
                <i className="fas fa-fire text-orange-400 text-2xl mb-1"></i>
                <p className="text-blue-300 font-medium">Мотивація</p>
                <p className="text-blue-200 text-xs">{wellnessCheck.motivation}/10</p>
              </div>
              <div className="text-center">
                <i className="fas fa-tired text-red-400 text-2xl mb-1"></i>
                <p className="text-blue-300 font-medium">Втома</p>
                <p className="text-blue-200 text-xs">{wellnessCheck.fatigue}/10</p>
              </div>
            </div>

            {wellnessCheck.notes && (
              <div className="mt-3 p-2 bg-blue-900/20 rounded">
                <p className="text-blue-200 text-xs">
                  <strong>Нотатки:</strong> {wellnessCheck.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getAdaptedExercise = (exercise: any) => {
    if (!adaptiveWorkoutPlan || !adaptiveWorkoutPlan.adaptations) return exercise;
    const adaptation = adaptiveWorkoutPlan.adaptations.find((a: any) => a.exerciseName === exercise.name);
    if (!adaptation) return exercise;
    return {
      ...exercise,
      sets: adaptation.adaptedSets || exercise.sets,
      reps: adaptation.adaptedReps || exercise.reps,
    };
  };

  return (
    <div className="space-y-6">
      {/* Відображення трендів прогресу */}
      {progressTrends && renderProgressTrends()}

      {/* Відображення інформації про самопочуття */}
      {renderWellnessInfo()}

      {/* Відображення інформації про адаптивне тренування */}
      {renderAdaptiveWorkoutInfo()}

      {activeDay === null ? (
        <div className="mb-6 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-4 w-full max-w-full overflow-hidden">
          <div className="flex-none md:flex-grow flex flex-wrap gap-2 justify-center md:justify-start">
            {workoutPlan.map(day => (
              <button
                key={day.day}
                onClick={() => setSelectedDayForView(day.day)}
                className={
                  `px-4 py-2 rounded transition-colors text-sm sm:text-base ` +
                  (selectedDayForView === day.day
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                }
              >
                {UI_TEXT.day} {day.day}
              </button>
            ))}
          </div>
          <div className="flex flex-col space-y-2 mt-auto w-full md:flex-row md:space-y-0 md:space-x-2 md:w-auto md:justify-start flex-shrink-0 min-w-0">
            {!isApiKeyMissing && (
              <button
                onClick={() => setIsEditMode(true)}
                className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <i className="fas fa-edit mr-2"></i>
                {UI_TEXT.editWorkoutPlan}
              </button>
            )}
              <button
              onClick={() => selectedDayForView !== null && onStartWorkout(selectedDayForView)}
              disabled={selectedDayForView === null}
              className={`w-full md:w-auto px-4 py-2 rounded transition-colors ${
                selectedDayForView === null
                  ? 'bg-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
              >
              {UI_TEXT.startWorkout}
              </button>
          </div>
            </div>
      ) : (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-purple-300">
            <i className="fas fa-dumbbell mr-2"></i>
            {UI_TEXT.activeWorkoutDay} {activeDay}
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-yellow-400">
              <i className="fas fa-stopwatch mr-2"></i>
              {workoutTimerDisplay}
            </span>
            <button
              onClick={onEndWorkout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              {UI_TEXT.endWorkout}
            </button>
            </div>
            </div>
          )}
          
      <div className="space-y-4">
        {exercisesToDisplay.map((exercise, index) => {
          const variations = exerciseVariations.get(exercise.name) || [];
          const adaptedExercise = getAdaptedExercise(exercise);
          
          return (
            <ExerciseCard
              key={adaptedExercise.id}
              exercise={adaptedExercise}
              isActive={activeDay !== null}
              onLogExercise={(loggedSets, success) => {
                const updatedExercises = [...exercisesToDisplay];
                updatedExercises[index] = {
                  ...adaptedExercise,
                  isCompletedDuringSession: true,
                  sessionLoggedSets: loggedSets,
                  sessionSuccess: success
                };
                onLogExercise(index, loggedSets, success);
              }}
              recommendations={exerciseRecommendations}
              variations={variations}
              onSelectVariation={async (variation) => {
                await onSelectVariation?.(exercise.name, variation);
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default WorkoutDisplay;