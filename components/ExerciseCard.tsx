import React, { useState, useEffect } from 'react';
import { Exercise, LoggedSetWithAchieved } from '../types';
import { UI_TEXT, formatTime } from '../constants';

interface ExerciseCardProps {
  exercise: Exercise;
  exerciseIndex: number;
  isActiveWorkout: boolean;
  onLogExercise: (exerciseIndex: number, loggedSets: LoggedSetWithAchieved[], success: boolean) => void;
  isCompleted: boolean;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, exerciseIndex, isActiveWorkout, onLogExercise, isCompleted }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  
  const numSets = typeof exercise.sets === 'string' 
    ? (parseInt(exercise.sets.split('-')[0], 10) || 3) 
    : (typeof exercise.sets === 'number' ? exercise.sets : 3);
  const [loggedSetsData, setLoggedSetsData] = useState<LoggedSetWithAchieved[]>(() => Array(numSets).fill({ repsAchieved: undefined, weightUsed: undefined }));
  const [allSetsSuccessful, setAllSetsSuccessful] = useState<boolean>(true);

  const [restTimer, setRestTimer] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isResting && restStartTime !== null) {
      const totalRestDuration = typeof exercise.rest === 'string' 
        ? (exercise.rest.includes('секунд') ? parseInt(exercise.rest.split(' ')[0], 10) : parseInt(exercise.rest, 10)) || 60
        : (typeof exercise.rest === 'number' ? exercise.rest : 60);

      const calculateTime = () => {
        const elapsed = Math.floor((Date.now() - restStartTime!) / 1000);
        const remaining = totalRestDuration - elapsed;
        
        setRestTimer(Math.max(0, remaining));

        if (remaining <= 0) {
          setIsResting(false);
          setRestStartTime(null);
          alert(`Відпочинок для "${exercise.name}" завершено!`);
        } else {
           // Оновлюємо таймер щосекунди, поки відпочинок триває
           const interval = window.requestAnimationFrame(calculateTime);
           return () => window.cancelAnimationFrame(interval);
        }
      };
      
      // Запускаємо перше оновлення і плануємо наступні
      calculateTime();

    } else if (!isResting && restStartTime !== null) {
      // Якщо відпочинок був активний, але його зупинили (час вийшов)
      setIsResting(false);
      // Optional: Play a sound or show notification
      setRestStartTime(null);
    }
    
    // Залежності: isResting, restStartTime, exercise.rest (для тривалості)
    // Date.now() не є залежністю, бо воно змінюється постійно
    // setRestTimer, setIsResting, setRestStartTime - React гарантує стабільність
  }, [isResting, restStartTime, exercise.rest, exercise.name]); // Додаємо exercise.name для сповіщення
  
  // Reset form when exercise changes or completion status changes
  useEffect(() => {
     setLoggedSetsData(Array(numSets).fill({ repsAchieved: undefined, weightUsed: undefined }));
     setAllSetsSuccessful(true);
     setShowLogForm(false); // Close log form if it was open for a previous interaction
  }, [exercise, numSets, isCompleted]);


  const handleStartRest = () => {
    const restStr = exercise.rest ?? '60';
    
    if (typeof restStr === 'string') {
      if (restStr.includes('секунд')) {
        // The value is no longer needed here, as we use restStartTime
      } else {
        // The value is no longer needed here
      }
    } else if (typeof restStr === 'number') {
      // The value is no longer needed here
    }
    
    // setRestTimer(restSeconds || 60); // Більше не встановлюємо початковий візуальний таймер тут
    setRestStartTime(Date.now()); // Фіксуємо час початку відпочинку
    setIsResting(true);
  };

  const handleSetDataChange = (setIndex: number, field: keyof LoggedSetWithAchieved, value: string) => {
    const newLoggedSetsData = [...loggedSetsData];
    newLoggedSetsData[setIndex] = { ...newLoggedSetsData[setIndex], [field]: value ? parseFloat(value) : undefined };
    setLoggedSetsData(newLoggedSetsData);
  };
  
  const handleLogFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validSets = loggedSetsData.filter(s => s.repsAchieved !== undefined && s.repsAchieved !== null && s.weightUsed !== undefined && s.weightUsed !== null) as LoggedSetWithAchieved[];
    
    if (validSets.length === 0) {
        if (!confirm("Ви не ввели дані для жодного підходу. Залогувати вправу як пропущену (без зарахування прогресу)?")) {
          return; 
        }
        // Log as "attempted but no valid sets" - success will be based on allSetsSuccessful if user still wants to log it.
         onLogExercise(exerciseIndex, [], allSetsSuccessful); // Pass empty array, but respect success flag
    } else {
        onLogExercise(exerciseIndex, validSets, allSetsSuccessful);
    }
    setShowLogForm(false);
    // setIsExpanded(false); // Keep expanded to see completion status
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
          </div>

          {isActiveWorkout && !isCompleted && (
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
                onClick={() => setShowLogForm(true)}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-md shadow-sm transition duration-300 ease-in-out flex items-center justify-center text-xs sm:text-sm"
              >
                <i className="fas fa-check-square mr-2"></i>{UI_TEXT.markAsDone}
              </button>
            </div>
          )}
          {isCompleted && <p className="mt-2 text-xs sm:text-sm text-green-200 font-medium"><i className="fas fa-check-double mr-1"></i>Вправу успішно залоговано!</p>}
        </div>
      )}

      {showLogForm && !isCompleted && isActiveWorkout && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-3 z-[100]" onClick={() => setShowLogForm(false)}>
          <div className="bg-gray-700 p-3 sm:p-5 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg sm:text-xl font-semibold text-purple-300 mb-3">{UI_TEXT.logExercise}: {exercise.name}</h3>
            <p className="text-xs sm:text-sm text-gray-300 mb-1">План: {exercise.sets} підходів по {exercise.targetReps ?? exercise.reps} повторень.</p>
            {exercise.targetWeight !== null && exercise.targetWeight !== undefined && <p className="text-xs sm:text-sm text-gray-300 mb-2">Цільова вага: {exercise.targetWeight} кг.</p>}
            
            <form onSubmit={handleLogFormSubmit} className="space-y-3">
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
                    <div>
                      <label htmlFor={`weight-${setIndex}`} className="block text-xs text-purple-200 mb-1">{UI_TEXT.weightUsed}</label>
                      <input 
                        type="number" 
                        id={`weight-${setIndex}`}
                        min="0"
                        step="0.5"
                        placeholder={exercise.targetWeight?.toString() ?? ''}
                        value={loggedSetsData[setIndex]?.weightUsed ?? ''}
                        onChange={(e) => handleSetDataChange(setIndex, 'weightUsed', e.target.value)}
                        className="w-full p-2 bg-gray-500 border border-gray-400 rounded-md text-gray-100 text-xs sm:text-sm"
                        required
                      />
                    </div>
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

export default ExerciseCard;