import React, { useState, useEffect } from 'react';
import { DailyWorkoutPlan, UserProfile, Exercise as ExerciseType, LoggedSet } from '../types';
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
  onLogExercise: (exerciseIndex: number, loggedSets: LoggedSet[], success: boolean) => void;
  workoutTimerDisplay: string;
  isApiKeyMissing: boolean;
  onSaveWorkoutPlan: (plan: DailyWorkoutPlan[]) => void;
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

  return (
    <div className="space-y-6">
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
        {exercisesToDisplay.map((exercise, index) => (
                <ExerciseCard
            key={index}
                  exercise={exercise}
            isActive={activeDay !== null}
            onLogExercise={(loggedSets, success) => {
              const updatedExercises = [...exercisesToDisplay];
              updatedExercises[index] = {
                ...exercise,
                isCompletedDuringSession: true,
                sessionLoggedSets: loggedSets,
                sessionSuccess: success
              };
              onLogExercise(index, loggedSets, success);
            }}
                />
              ))}
            </div>
    </div>
  );
};

export default WorkoutDisplay;