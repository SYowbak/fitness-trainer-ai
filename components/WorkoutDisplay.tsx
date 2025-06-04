import React, { useState } from 'react';
import { DailyWorkoutPlan, UserProfile, Exercise as ExerciseType, LoggedSet } from '../types';
import { UI_TEXT, getUkrainianGoal, getUkrainianBodyType, getUkrainianGender, getUkrainianMuscleGroup } from '../constants';
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

  const currentDayPlan = activeDay !== null ? (isWorkoutPlanValid ? workoutPlan.find(p => p.day === activeDay) : null) : (selectedDayForView !== null && isWorkoutPlanValid ? workoutPlan.find(p => p.day === selectedDayForView) : null);
  const exercisesToDisplay = activeDay !== null ? sessionExercises : (currentDayPlan && currentDayPlan.exercises && Array.isArray(currentDayPlan.exercises) ? currentDayPlan.exercises : []);

  const allSessionExercisesLogged = activeDay !== null && sessionExercises.every(ex => ex.isCompletedDuringSession || (ex.sessionLoggedSets && ex.sessionLoggedSets.length === 0 && ex.sessionSuccess !== undefined) );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-purple-300">{UI_TEXT.workoutPlanTitle}</h2>
        <div className="space-x-2">
          {!isApiKeyMissing && (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <i className="fas fa-edit mr-2"></i>
              Редагувати план
            </button>
          )}
          <button
            onClick={onGenerateNewPlan}
            disabled={isApiKeyMissing}
            className={`px-4 py-2 rounded transition-colors ${
              isApiKeyMissing
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <i className="fas fa-magic mr-2"></i>
            {UI_TEXT.generateWorkout}
          </button>
        </div>
      </div>

      {activeDay === null ? (
        <div className="mb-6">
          <label className="block text-gray-300 mb-2">Виберіть день:</label>
          <select
            value={selectedDayForView || ''}
            onChange={(e) => setSelectedDayForView(Number(e.target.value))}
            className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
          >
            {workoutPlan.map(day => (
              <option key={day.day} value={day.day}>
                День {day.day}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex justify-between items-center mb-6">
          <div className="text-xl font-semibold text-purple-300">
            День {activeDay} - {workoutTimerDisplay}
          </div>
          <button
            onClick={onEndWorkout}
            disabled={!allSessionExercisesLogged}
            className={`px-4 py-2 rounded transition-colors ${
              allSessionExercisesLogged
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-500 cursor-not-allowed'
            }`}
          >
            Завершити тренування
          </button>
        </div>
      )}

      {currentDayPlan?.warmup && (
        <div className="p-4 bg-gray-700/50 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-300 mb-2">{UI_TEXT.warmup}</h3>
          <p className="text-gray-300">{currentDayPlan.warmup}</p>
        </div>
      )}

      <div className="space-y-4">
        {exercisesToDisplay.map((exercise, index) => (
          <ExerciseCard
            key={index}
            exercise={exercise}
            index={index}
            isActive={activeDay !== null}
            onLogExercise={onLogExercise}
          />
        ))}
      </div>

      {currentDayPlan?.cooldown && (
        <div className="p-4 bg-gray-700/50 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-300 mb-2">{UI_TEXT.cooldown}</h3>
          <p className="text-gray-300">{currentDayPlan.cooldown}</p>
        </div>
      )}

      {currentDayPlan?.notes && (
        <div className="p-4 bg-gray-700/50 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-300 mb-2">Примітки:</h3>
          <p className="text-gray-300">{currentDayPlan.notes}</p>
        </div>
      )}

      {activeDay === null && (
        <button
          onClick={() => onStartWorkout(selectedDayForView!)}
          className="w-full p-3 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          Почати тренування
        </button>
      )}
    </div>
  );
};

export default WorkoutDisplay;