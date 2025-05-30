import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, DailyWorkoutPlan, WorkoutLog, Exercise, LoggedExercise, LoggedSet } from './types';
import { UI_TEXT, GEMINI_MODEL_TEXT, DEFAULT_WEIGHT_INCREMENT, DEFAULT_WEIGHT_DECREMENT, formatTime } from './constants';
import Navbar from './components/Navbar';
import UserProfileForm from './components/UserProfileForm';
import WorkoutDisplay from './components/WorkoutDisplay';
import ProgressView from './components/ProgressView';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { loadUserProfile as storageLoadUserProfile, saveWorkoutPlan as storageSaveWorkoutPlan, loadWorkoutPlan as storageLoadWorkoutPlan, saveWorkoutLogs as storageSaveWorkoutLogs, loadWorkoutLogs as storageLoadWorkoutLogs } from './services/localStorageService';
import { generateWorkoutPlan as apiGenerateWorkoutPlan } from './services/geminiService';

type View = 'profile' | 'workout' | 'progress';

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('profile');
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

  // Active Workout Session State
  const [activeWorkoutDay, setActiveWorkoutDay] = useState<number | null>(null);
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>([]);
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [workoutTimer, setWorkoutTimer] = useState<number>(0);

  useEffect(() => {
    if (typeof import.meta.env === 'undefined' || !import.meta.env.VITE_API_KEY) {
      setApiKeyMissing(true);
    }
    const loadedProfile = storageLoadUserProfile();
    if (loadedProfile) {
      setUserProfile(loadedProfile);
      const loadedPlan = storageLoadWorkoutPlan();
      if (loadedPlan) {
        setCurrentWorkoutPlan(loadedPlan);
      }
      setCurrentView(loadedPlan ? 'workout' : 'profile');
    } else {
      setCurrentView('profile');
    }
    const loadedLogs = storageLoadWorkoutLogs();
    setWorkoutLogs(loadedLogs);
  }, []);

  useEffect(() => {
    let timerInterval: number | null = null;
    if (workoutStartTime && activeWorkoutDay !== null) {
      timerInterval = window.setInterval(() => {
        setWorkoutTimer(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
    } else {
      setWorkoutTimer(0); // Reset timer if workout not active
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [workoutStartTime, activeWorkoutDay]);


  const handleSaveProfile = async (profile: UserProfile) => {
    try {
      setIsLoading(true);
      const profileToSave = {
        ...profile,
        targetMuscleGroups: profile.targetMuscleGroups || [], // Ensure it's an empty array if undefined
      };
      localStorage.setItem('userProfile', JSON.stringify(profileToSave));
      setUserProfile(profileToSave);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateNewPlan = useCallback(async () => {
    if (apiKeyMissing) {
      setError(UI_TEXT.apiKeyMissing);
      return;
    }
    if (userProfile) {
      if (activeWorkoutDay !== null) {
         if(!confirm("У вас є активне тренування. Створення нового плану завершить його без збереження. Продовжити?")) return;
         setActiveWorkoutDay(null); 
         setWorkoutStartTime(null);
      }
      setIsLoading(true);
      setError(null);
      try {
        const plan = await apiGenerateWorkoutPlan(userProfile, GEMINI_MODEL_TEXT);
        setCurrentWorkoutPlan(plan);
        storageSaveWorkoutPlan(plan);
        setCurrentView('workout');
      } catch (e: any) {
        console.error("Error generating new workout plan:", e);
        setError(e.message || UI_TEXT.errorOccurred);
      } finally {
        setIsLoading(false);
      }
    } else {
      setCurrentView('profile');
      setError("Будь ласка, спочатку заповніть та збережіть профіль.");
    }
  }, [userProfile, apiKeyMissing, activeWorkoutDay]);

  const handleStartWorkout = useCallback((dayNumber: number) => {
    if (!currentWorkoutPlan) return;
    const planForDay = currentWorkoutPlan.find(d => d.day === dayNumber);
    if (planForDay) {
      setSessionExercises(planForDay.exercises.map(ex => ({ 
        ...ex, 
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: undefined,
      })));
      setActiveWorkoutDay(dayNumber);
      setWorkoutStartTime(Date.now());
      setWorkoutTimer(0);
      setCurrentView('workout'); 
    }
  }, [currentWorkoutPlan]);

  const handleLogSingleExercise = useCallback((exerciseIndex: number, loggedSets: LoggedSet[], success: boolean) => {
    setSessionExercises(prev =>
      prev.map((ex, idx) =>
        idx === exerciseIndex
          ? { ...ex, sessionLoggedSets: loggedSets, sessionSuccess: success, isCompletedDuringSession: true }
          : ex
      )
    );
  }, []);
  
  const handleEndWorkout = useCallback(() => {
    if (activeWorkoutDay === null || !currentWorkoutPlan || !workoutStartTime) return;

    const loggedExercisesForSession: LoggedExercise[] = sessionExercises
      .map((ex) => ({
        exerciseName: ex.name,
        originalSets: ex.sets,
        originalReps: ex.reps,
        targetWeightAtLogging: ex.targetWeight,
        loggedSets: ex.sessionLoggedSets || [],
        completedSuccessfully: ex.sessionSuccess === true,
      }));

    if (loggedExercisesForSession.length === 0) {
        setActiveWorkoutDay(null);
        setWorkoutStartTime(null);
        setSessionExercises([]);
        alert("Тренування завершено, але жодної вправи не було залоговано.");
        return;
    }
    
    const newLog: WorkoutLog = {
      date: new Date().toISOString(),
      dayCompleted: activeWorkoutDay,
      workoutDuration: formatTime(Math.floor((Date.now() - workoutStartTime) / 1000)),
      loggedExercises: loggedExercisesForSession,
    };

    const updatedLogs = [...workoutLogs, newLog];
    setWorkoutLogs(updatedLogs);
    storageSaveWorkoutLogs(updatedLogs);

    let planWasUpdated = false;
    const updatedPlan = currentWorkoutPlan.map(dayPlan => {
      if (dayPlan.day === activeWorkoutDay) {
        const newExercisesForDay = dayPlan.exercises.map(exInPlan => {
          const loggedEx = loggedExercisesForSession.find(le => le.exerciseName === exInPlan.name);
          if (loggedEx && loggedEx.loggedSets.length > 0) { // Only adjust if sets were logged
            let newTargetWeight = exInPlan.targetWeight;
            const averageWeightUsed = loggedEx.loggedSets.reduce((sum, set) => sum + set.weightUsed, 0) / loggedEx.loggedSets.length;

            if (loggedEx.completedSuccessfully) {
              newTargetWeight = (exInPlan.targetWeight || averageWeightUsed || 50) + DEFAULT_WEIGHT_INCREMENT;
            } else if (averageWeightUsed && (exInPlan.targetWeight && averageWeightUsed >= exInPlan.targetWeight )) {
               newTargetWeight = Math.max(0, (exInPlan.targetWeight || averageWeightUsed) - DEFAULT_WEIGHT_DECREMENT);
            }
            
            if ((exInPlan.targetWeight === undefined || exInPlan.targetWeight === null) && averageWeightUsed) {
                if (loggedEx.completedSuccessfully) {
                    newTargetWeight = averageWeightUsed + DEFAULT_WEIGHT_INCREMENT;
                } else {
                    newTargetWeight = averageWeightUsed; 
                }
            }
             // Ensure newTargetWeight is a number and positive or zero
            newTargetWeight = Math.max(0, parseFloat(newTargetWeight?.toFixed(1) || "0"));


            if (newTargetWeight !== exInPlan.targetWeight) {
                planWasUpdated = true;
                return { ...exInPlan, targetWeight: newTargetWeight };
            }
          }
          return exInPlan;
        });
        return { ...dayPlan, exercises: newExercisesForDay };
      }
      return dayPlan;
    });

    if (planWasUpdated) {
      setCurrentWorkoutPlan(updatedPlan);
      storageSaveWorkoutPlan(updatedPlan);
    }
    
    alert(UI_TEXT.workoutLogged + (planWasUpdated ? " План оновлено з новими цілями!" : ""));
    setActiveWorkoutDay(null);
    setWorkoutStartTime(null);
    setSessionExercises([]);
    setCurrentView('progress'); 
  }, [activeWorkoutDay, sessionExercises, currentWorkoutPlan, workoutLogs, workoutStartTime]);


  const renderView = () => {
    if (isLoading && currentView !== 'profile' && activeWorkoutDay === null) return <Spinner message={UI_TEXT.generatingWorkout} />;
    
    switch (currentView) {
      case 'profile':
        return <UserProfileForm 
                  existingProfile={userProfile} 
                  onSave={handleSaveProfile} 
                  apiKeyMissing={apiKeyMissing} 
                  isLoading={isLoading}
                />;
      case 'workout':
        return <WorkoutDisplay 
                  userProfile={userProfile}
                  workoutPlan={currentWorkoutPlan} 
                  onGenerateNewPlan={handleGenerateNewPlan}
                  isLoading={isLoading || (apiKeyMissing && !userProfile)}
                  activeDay={activeWorkoutDay}
                  sessionExercises={sessionExercises}
                  onStartWorkout={handleStartWorkout}
                  onEndWorkout={handleEndWorkout}
                  onLogExercise={handleLogSingleExercise}
                  workoutTimerDisplay={formatTime(workoutTimer)}
                  isApiKeyMissing={apiKeyMissing}
                />;
      case 'progress':
        return <ProgressView workoutLogs={workoutLogs} userProfile={userProfile} />;
      default:
        return <UserProfileForm existingProfile={userProfile} onSave={handleSaveProfile} apiKeyMissing={apiKeyMissing} isLoading={isLoading}/>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-slate-800 to-purple-900">
      <header className="bg-gray-800/70 backdrop-blur-md shadow-lg p-3 sm:p-4 sticky top-0 z-50">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2 sm:mb-0">
            <i className="fas fa-dumbbell mr-2"></i>{UI_TEXT.appName}
          </h1>
          { (userProfile || currentView !== 'profile' || isLoading || activeWorkoutDay !== null) && 
            <Navbar currentView={currentView} onViewChange={(v) => {
              if (activeWorkoutDay !== null && v !== 'workout') {
                if(!confirm(UI_TEXT.confirmEndWorkout + " Перехід на іншу вкладку завершить його без збереження логів.")) return;
                setActiveWorkoutDay(null);
                setWorkoutStartTime(null);
                setSessionExercises([]);
              }
              setCurrentView(v);
            }} />
          }
        </div>
      </header>

      <main className="flex-grow container mx-auto p-3 sm:p-4 md:p-6">
        {error && !isLoading && <ErrorMessage message={error} onClear={() => setError(null)} />}
        {!userProfile && !isLoading && currentView !== 'profile' && activeWorkoutDay === null && (
            <div className="text-center p-6 sm:p-8 bg-gray-800/80 rounded-lg shadow-xl mt-6 sm:mt-10">
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-purple-300">{UI_TEXT.welcomeMessage}</h2>
                <p className="mb-4 sm:mb-6 text-gray-300 text-sm sm:text-base">{UI_TEXT.getStarted}</p>
                <button 
                    onClick={() => setCurrentView('profile')}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-5 sm:py-3 sm:px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 text-sm sm:text-base"
                >
                    <i className="fas fa-user-plus mr-2"></i>Перейти до Створення Профілю
                </button>
            </div>
        )}
         {renderView()}
      </main>

      <footer className="bg-gray-800/50 text-center p-3 sm:p-4 text-xs sm:text-sm text-gray-400 mt-auto">
        © {new Date().getFullYear()} {UI_TEXT.appName}. Усі права захищено.
      </footer>
    </div>
  );
};

export default App;