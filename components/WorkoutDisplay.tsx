import React, { useState } from 'react';
import { DailyWorkoutPlan, UserProfile, Exercise as ExerciseType, LoggedSet } from '../types';
import { UI_TEXT, getUkrainianGoal, getUkrainianBodyType, getUkrainianGender, getUkrainianMuscleGroup } from '../constants';
import ExerciseCard from './ExerciseCard';
import Spinner from './Spinner';

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
}) => {
  const [selectedDayForView, setSelectedDayForView] = useState<number | null>(
    workoutPlan && workoutPlan.length > 0 ? workoutPlan[0].day : null
  );

  if (isLoading && (!workoutPlan || workoutPlan.length === 0) && activeDay === null) {
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

  if (!workoutPlan || workoutPlan.length === 0) {
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

  const currentDayPlan = activeDay !== null ? workoutPlan.find(p => p.day === activeDay) : (selectedDayForView !== null ? workoutPlan.find(p => p.day === selectedDayForView) : null);
  const exercisesToDisplay = activeDay !== null ? sessionExercises : (currentDayPlan ? currentDayPlan.exercises : []);

  const allSessionExercisesLogged = activeDay !== null && sessionExercises.every(ex => ex.isCompletedDuringSession || (ex.sessionLoggedSets && ex.sessionLoggedSets.length === 0 && ex.sessionSuccess !== undefined) );


  return (
    <div className="space-y-4 sm:space-y-6">
      {activeDay === null && (
        <div className="p-3 sm:p-4 bg-gray-800/70 rounded-xl shadow-xl backdrop-blur-sm">
          <label htmlFor="day-select" className="block text-md sm:text-lg font-semibold text-purple-300 mb-2 sm:mb-3">{UI_TEXT.selectDayToView}</label>
          <div className="flex flex-wrap gap-2">
            {workoutPlan.map(dayPlan => (
              <button
                key={dayPlan.day}
                onClick={() => setSelectedDayForView(dayPlan.day)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium text-xs sm:text-sm transition-colors ${selectedDayForView === dayPlan.day ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
              >
                {UI_TEXT.day} {dayPlan.day}
              </button>
            ))}
          </div>
        </div>
      )}

      {(activeDay !== null || currentDayPlan) && (
        <div className="p-3 sm:p-4 md:p-6 bg-gray-800/80 rounded-xl shadow-2xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-700">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-1 sm:mb-0">
                <i className={`fas ${activeDay !== null ? 'fa-running' : 'fa-calendar-check'} mr-2 sm:mr-3`}></i>
                {activeDay !== null ? `${UI_TEXT.currentWorkout} - ${UI_TEXT.day} ${activeDay}` : `${UI_TEXT.workoutPlanTitle} - ${UI_TEXT.day} ${currentDayPlan?.day}`}
              </h2>
              {activeDay !== null && (
                <p className="text-md sm:text-lg text-yellow-400 font-semibold">
                  <i className="fas fa-stopwatch mr-2"></i>{UI_TEXT.workoutDuration} {workoutTimerDisplay}
                </p>
              )}
            </div>
            {activeDay === null && currentDayPlan && userProfile && (
              <button
                onClick={() => onStartWorkout(currentDayPlan.day)}
                disabled={isLoading || isApiKeyMissing}
                className={`bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 flex items-center text-xs sm:text-sm mt-2 sm:mt-0 ${isLoading || isApiKeyMissing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fas fa-play mr-2"></i>{UI_TEXT.startWorkout}
              </button>
            )}
            {activeDay !== null && (
              <button
                onClick={() => {
                  if (allSessionExercisesLogged || confirm(UI_TEXT.confirmEndWorkout)) {
                    onEndWorkout();
                  }
                }}
                className={`bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 flex items-center text-xs sm:text-sm mt-2 sm:mt-0`}
              >
                <i className="fas fa-stop-circle mr-2"></i>{UI_TEXT.endWorkout}
              </button>
            )}
          </div>
          
          {userProfile && currentDayPlan && (
            <div className="mb-4 sm:mb-6 p-3 bg-gray-700/60 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 text-xs sm:text-sm">
              <p><strong className="text-purple-300">Ім'я:</strong> {userProfile.name || "Не вказано"}</p>
              <p><strong className="text-purple-300">Стать:</strong> {getUkrainianGender(userProfile.gender)}</p>
              <p><strong className="text-purple-300">Статура:</strong> {getUkrainianBodyType(userProfile.bodyType)}</p>
              {userProfile.goal && <p><strong className="text-purple-300">Ціль:</strong> {getUkrainianGoal(userProfile.goal)}</p>}
              {userProfile.trainingFrequency && <p><strong className="text-purple-300">Частота:</strong> {userProfile.trainingFrequency} разів на тиждень</p>}
              {userProfile.targetMuscleGroups && userProfile.targetMuscleGroups.length > 0 && (
                <p>
                  <strong className="text-purple-300">Акцент на групи м'язів:</strong>{' '}
                  {userProfile.targetMuscleGroups.map(group => getUkrainianMuscleGroup(group)).join(', ')}
                </p>
              )}
            </div>
          )}

          {currentDayPlan?.warmup && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gray-600/50 rounded-md">
              <h4 className="text-sm sm:text-base font-semibold text-pink-400 mb-1"><i className="fas fa-fire mr-2"></i>{UI_TEXT.warmup}</h4>
              <p className="text-gray-300 whitespace-pre-line text-xs sm:text-sm">{currentDayPlan.warmup}</p>
            </div>
          )}

          {currentDayPlan?.notes && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-sky-700/30 rounded-md border border-sky-600">
              <h4 className="text-sm sm:text-base font-semibold text-sky-300 mb-1"><i className="fas fa-info-circle mr-2"></i>{UI_TEXT.notes}</h4>
              <p className="text-gray-300 whitespace-pre-line text-xs sm:text-sm">{currentDayPlan.notes}</p>
            </div>
          )}
          
          <h4 className="text-md sm:text-lg font-semibold text-pink-400 my-2 sm:my-3"><i className="fas fa-tasks mr-2"></i>{UI_TEXT.exercises}</h4>
          {exercisesToDisplay.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {exercisesToDisplay.map((exercise, exIndex) => (
                <ExerciseCard
                  key={exercise.name + '-' + exIndex + '-' + (exercise.isCompletedDuringSession ? 'c' : 'nc')} // Add completion to key to force re-render if needed
                  exercise={exercise}
                  exerciseIndex={exIndex}
                  isActiveWorkout={activeDay !== null}
                  onLogExercise={onLogExercise}
                  isCompleted={exercise.isCompletedDuringSession || false}
                />
              ))}
            </div>
          ) : (
             <p className="text-gray-400 text-center py-3 sm:py-4 text-sm">Немає вправ для відображення для цього дня.</p>
          )}
          
          {allSessionExercisesLogged && activeDay !== null && (
             <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-green-700/30 rounded-md text-center">
                <p className="text-green-300 font-semibold text-md sm:text-lg"><i className="fas fa-check-circle mr-2"></i>{UI_TEXT.allExercisesCompleted}</p>
                <p className="text-gray-300 text-xs sm:text-sm">Натисніть "{UI_TEXT.endWorkout}" щоб зберегти ваш прогрес.</p>
             </div>
          )}

          {currentDayPlan?.cooldown && (
            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-600 p-2 sm:p-3 bg-gray-600/50 rounded-md">
              <h4 className="text-sm sm:text-base font-semibold text-pink-400 mb-1"><i className="fas fa-snowflake mr-2"></i>{UI_TEXT.cooldown}</h4>
              <p className="text-gray-300 whitespace-pre-line text-xs sm:text-sm">{currentDayPlan.cooldown}</p>
            </div>
          )}
          
          {activeDay === null && userProfile && !isApiKeyMissing && (
            <div className="mt-6 sm:mt-8 flex justify-center sm:justify-end">
               <button
                  onClick={onGenerateNewPlan}
                  disabled={isLoading}
                  className={`bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 flex items-center text-xs sm:text-sm ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Оновлення...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sync-alt mr-2"></i>{UI_TEXT.generateWorkout}
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      )}
       {!activeDay && !currentDayPlan && workoutPlan && workoutPlan.length > 0 && selectedDayForView === null && (
         <p className="text-center text-gray-400 mt-6 sm:mt-8 text-sm">{UI_TEXT.selectDayToView} щоб побачити деталі або почати тренування.</p>
       )}
    </div>
  );
};

export default WorkoutDisplay;