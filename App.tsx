import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, DailyWorkoutPlan, WorkoutLog, Exercise, LoggedExercise, LoggedSet } from './types';
import { UI_TEXT, GEMINI_MODEL_TEXT, formatTime } from './constants';
import Navbar from './components/Navbar';
import UserProfileForm from './components/UserProfileForm';
import WorkoutDisplay from './components/WorkoutDisplay';
import ProgressView from './components/ProgressView';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { generateWorkoutPlan as apiGenerateWorkoutPlan } from './services/geminiService';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { useUserData } from './hooks/useUserData';
import { deleteUser } from 'firebase/auth';
import { auth } from './config/firebase';
import { analyzeWorkout } from './services/workoutAnalysisService';

// Import Firestore functions
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config/firebase';

type View = 'profile' | 'workout' | 'progress';

const App: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const { workoutPlan, saveWorkoutPlan, loading: userDataLoading, profile: firestoreProfile, workoutLogs: firestoreWorkoutLogs, saveProfile, saveWorkoutLog } = useUserData();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>(localStorage.getItem('currentView') as View || 'profile');
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

  // Active Workout Session State - Attempt to load synchronously from localStorage
  const getInitialActiveWorkoutState = () => {
    try {
      const savedState = localStorage.getItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
      console.log('localStorage savedState (sync):', savedState);
      if (!savedState) {
        console.log('No saved state found in localStorage (sync).');
        return { activeDay: null, sessionExercises: [], workoutStartTime: null };
      }

      const savedObject = JSON.parse(savedState);
      console.log('Parsed saved state (sync):', savedObject);
      const { activeDay, exercises, startTime, timestamp, isWorkoutCompleted } = savedObject;

      // Перевіряємо чи є всі необхідні поля
      if (!activeDay || !exercises || !startTime || !timestamp || isWorkoutCompleted === undefined) {
        console.warn('Incomplete or invalid saved state in localStorage (sync). Removing.', savedObject);
        localStorage.removeItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
        return { activeDay: null, sessionExercises: [], workoutStartTime: null };
      }

      // Якщо тренування було завершене, видаляємо стан
      if (isWorkoutCompleted) {
        console.log('Saved state indicates workout was completed (sync). Removing from localStorage.');
        localStorage.removeItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
        return { activeDay: null, sessionExercises: [], workoutStartTime: null };
      }

      // Перевіряємо чи не закінчився термін дії
      if (Date.now() - timestamp > ACTIVE_WORKOUT_EXPIRATION_TIME) {
        console.log('Saved state expired (sync). Removing from localStorage.');
        localStorage.removeItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
        return { activeDay: null, sessionExercises: [], workoutStartTime: null };
      }

      // Перевіряємо структуру даних
      if (
        typeof activeDay === 'number' &&
        Array.isArray(exercises) &&
        exercises.every((ex: any) => typeof ex.name === 'string') && // Проста перевірка структури вправи
        typeof startTime === 'number'
      ) {
        console.log('Loading valid saved state (sync).', { activeDay, exercises, startTime });
        return {
          activeDay: activeDay as number,
          sessionExercises: exercises as Exercise[],
          workoutStartTime: startTime as number,
        };
      } else {
        console.warn('Invalid structure in saved state (sync). Removing.', savedObject);
        localStorage.removeItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
        return { activeDay: null, sessionExercises: [], workoutStartTime: null };
      }
    } catch (e) {
      console.error('Error loading active workout state from localStorage (sync):', e);
      localStorage.removeItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
      return { activeDay: null, sessionExercises: [], workoutStartTime: null };
    }
  };

  const initialActiveWorkoutState = getInitialActiveWorkoutState();

  const [activeWorkoutDay, setActiveWorkoutDay] = useState<number | null>(initialActiveWorkoutState.activeDay); // Day number
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>(initialActiveWorkoutState.sessionExercises);
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(initialActiveWorkoutState.workoutStartTime);
  const [workoutTimer, setWorkoutTimer] = useState<number>(0);
  const [isAnalyzingWorkout, setIsAnalyzingWorkout] = useState<boolean>(false);

  const ACTIVE_WORKOUT_LOCAL_STORAGE_KEY = 'active_workout_local_state';
  const ACTIVE_WORKOUT_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 години у мілісекундах.

  useEffect(() => {
    if (typeof import.meta.env === 'undefined' || !import.meta.env.VITE_API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  useEffect(() => {
    if (workoutPlan) {
      setCurrentWorkoutPlan(workoutPlan);
    } else {
      setCurrentWorkoutPlan(null);
    }
  }, [workoutPlan]);

  // Синхронізація профілю та логів з useUserData (Firestore)
  useEffect(() => {
    setUserProfile(firestoreProfile);
    setWorkoutLogs(firestoreWorkoutLogs);
    // Важливо: Цей хук не повинен скидати стан активного тренування (activeWorkoutDay, sessionExercises, workoutStartTime)
    // Стан активного тренування завантажується окремо з localStorage.
  }, [firestoreProfile, firestoreWorkoutLogs]);

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

  // Save active workout state to localStorage whenever it changes
  useEffect(() => {
    console.log('Checking if active workout state needs saving...', { activeWorkoutDay, workoutStartTime, sessionExercisesLength: sessionExercises.length });
    if (activeWorkoutDay !== null && workoutStartTime !== null) {
      const stateToSave = {
        activeDay: activeWorkoutDay,
        exercises: sessionExercises,
        startTime: workoutStartTime,
        timestamp: Date.now(),
        isWorkoutCompleted: false
      };
      console.log('Saving active workout state to localStorage:', stateToSave);
      try {
        localStorage.setItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        console.log('Active workout state saved successfully.');
      } catch (e) {
        console.error('Error saving active workout state to localStorage:', e);
      }
    } else {
        console.log('Active workout state is null, not saving.');
    }
  }, [activeWorkoutDay, workoutStartTime, sessionExercises]); // Додано sessionExercises в залежності

  const handleProfileSave = useCallback(async (profile: UserProfile) => {
    if (apiKeyMissing) {
      setError(UI_TEXT.apiKeyMissing);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const profileToSave: UserProfile = {
        ...profile,
        targetMuscleGroups: profile.targetMuscleGroups || [],
      };
      await saveProfile(profileToSave); // Зберігаємо в Firestore через useUserData
      const plan = await apiGenerateWorkoutPlan(profileToSave, GEMINI_MODEL_TEXT);
      await saveWorkoutPlan(plan);
      setActiveWorkoutDay(null); 
      setCurrentView('workout');
    } catch (e: any) {
      console.error("Error generating workout plan:", e);
      setError(e.message || UI_TEXT.errorOccurred);
    } finally {
      setIsLoading(false);
    }
  }, [apiKeyMissing, saveWorkoutPlan, saveProfile]);

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
        await saveWorkoutPlan(plan);
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
  }, [userProfile, apiKeyMissing, activeWorkoutDay, saveWorkoutPlan]);

  const handleStartWorkout = useCallback((dayNumber: number) => {
    if (!currentWorkoutPlan || !Array.isArray(currentWorkoutPlan)) return;
    const planForDay = currentWorkoutPlan.find(d => d.day === dayNumber);
    if (planForDay && planForDay.exercises && Array.isArray(planForDay.exercises)) {
      setSessionExercises(planForDay.exercises.map(ex => ({
        ...ex,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: undefined,
        recommendation: ex.recommendation,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
      })));
      setActiveWorkoutDay(dayNumber);
      setWorkoutStartTime(Date.now());
      setWorkoutTimer(0);
      setCurrentView('workout'); 
    }
  }, [currentWorkoutPlan]);

  const handleLogSingleExercise = useCallback((exerciseIndex: number, loggedSets: LoggedSet[], success: boolean) => {
    console.log('handleLogSingleExercise called:', { exerciseIndex, loggedSets, success });
    setSessionExercises(prev =>
      prev.map((ex, idx) =>
        idx === exerciseIndex
          ? { ...ex, sessionLoggedSets: loggedSets, sessionSuccess: success, isCompletedDuringSession: true }
          : ex
      )
    );
    console.log('sessionExercises state after update attempt:', sessionExercises);
  }, []);
  
  const handleEndWorkout = useCallback(async () => {
    if (activeWorkoutDay === null || !currentWorkoutPlan || !Array.isArray(currentWorkoutPlan) || !workoutStartTime || !userProfile) return;

    console.log('handleEndWorkout called. sessionExercises:', sessionExercises);

    // Find the current day's plan before clearing active workout state
    const currentDayPlan = currentWorkoutPlan.find(p => p.day === activeWorkoutDay);
    if (!currentDayPlan) {
        console.error("Could not find current day's plan.");
        alert("Помилка: Не вдалося знайти план тренування для аналізу.");
        return;
    }

    // Map sessionExercises to the new LoggedExercise structure
    const loggedExercisesForSession: LoggedExercise[] = sessionExercises
      .filter(ex => ex.isCompletedDuringSession)
      .map((ex) => ({
        exerciseName: ex.name,
        originalSets: ex.sets,
        originalReps: ex.reps,
        targetWeightAtLogging: ex.targetWeight || null,
        loggedSets: ex.sessionLoggedSets || [],
        completedSuccessfully: ex.sessionSuccess ?? false,
        notes: ex.notes,
      }));

    if (loggedExercisesForSession.length === 0) {
      // Clear active workout state and local storage first
      setActiveWorkoutDay(null);
      setWorkoutStartTime(null);
      setSessionExercises([]);
      try {
        localStorage.removeItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
      } catch (e) {
        console.error("Error removing workout state from local storage", e);
      }
      alert("Тренування завершено, але жодної вправи не було залоговано.");
      return;
    }
    
    const newLog: WorkoutLog = {
      id: new Date().toISOString(),
      userId: userProfile?.uid || 'anonymous',
      date: new Date(),
      duration: Math.floor((Date.now() - workoutStartTime) / 1000),
      dayCompleted: activeWorkoutDay,
      workoutDuration: formatTime(Math.floor((Date.now() - workoutStartTime) / 1000)),
      loggedExercises: loggedExercisesForSession,
    };

    // Declare updatedLogs here to be accessible after the try block
    let updatedLogs: WorkoutLog[];

    // Save the new log first
    try {
        await saveWorkoutLog(newLog);
        updatedLogs = [...workoutLogs, newLog]; // Assign to the declared variable
        setWorkoutLogs(updatedLogs);
        alert(UI_TEXT.workoutLogged);
        console.log('Workout log saved successfully. New logs state:', updatedLogs);
    } catch (e: any) {
        console.error("Error saving workout log:", e);
        setError(e.message || "Помилка при збереженні логу тренування.");
        // Decide if you want to proceed with analysis if saving log failed
        return; // Exit if log saving failed
    }

    // Clear active workout state and local storage AFTER saving log
    setActiveWorkoutDay(null);
    setWorkoutStartTime(null);
    setSessionExercises([]);
    try {
      localStorage.removeItem(ACTIVE_WORKOUT_LOCAL_STORAGE_KEY);
    } catch (e) {
        console.error("Error removing workout state from local storage after saving log", e);
    }
    
    // --- Start Workout Analysis ---
    console.log('Starting workout analysis...');
    setIsAnalyzingWorkout(true); // Set analysis loading state
    try {
        // Find the latest log again from the potentially updated logs state
        const latestLog = updatedLogs.find((log: WorkoutLog) => log.id === newLog.id) || null; // Explicitly type log

        // We pass all workoutLogs for broader context for the AI, including the new one
        const analysisResult = await analyzeWorkout(
          userProfile, // Ensure userProfile is passed
          currentDayPlan, // Pass the plan for the day that was just completed
          latestLog, // Pass the newly created log as the latest
          updatedLogs.filter((log: WorkoutLog) => log.id !== newLog.id) // Pass all other logs, Explicitly type log
        );
        console.log('Analysis completed. Result:', analysisResult);
        // Додаємо детальне логування вмісту updatedPlan.exercises
        if (analysisResult?.updatedPlan?.exercises) {
            console.log('Analyzed plan exercises with recommendations:', analysisResult.updatedPlan.exercises);
        }
        
        // Update the main workout plan state with the analyzed plan
        if (analysisResult?.updatedPlan) {
            const planIndex = currentWorkoutPlan.findIndex(p => p.day === analysisResult.updatedPlan.day);
            if (planIndex !== -1) {
                const newWorkoutPlan = [...currentWorkoutPlan];
                newWorkoutPlan[planIndex] = analysisResult.updatedPlan;
                setCurrentWorkoutPlan(newWorkoutPlan);
                // Save the updated plan to Firestore
                await saveWorkoutPlan(newWorkoutPlan);
                console.log('Workout plan updated and saved:', newWorkoutPlan);
            } else {
                console.error("Analyzed plan day not found in current workout plan.", analysisResult.updatedPlan);
            }
        }

        // No need to store the overall recommendation text here, as we focus on per-exercise ones.
        // The navigation happens after analysis
        console.log('Attempting to navigate to progress view.');
        setCurrentView('progress'); // Navigate to progress view

    } catch (e: any) {
        console.error("Error during workout analysis:", e);
        setError(e.message || "Помилка при аналізі тренування.");
        // Still navigate to progress even if analysis failed, maybe show an error there
        console.log('Error during analysis, navigating to progress view anyway.');
        setCurrentView('progress');
    } finally {
        setIsAnalyzingWorkout(false); // Reset analysis loading state
        console.log('Workout analysis finished (finally block). isAnalyzingWorkout set to false.');
    }

  }, [activeWorkoutDay, sessionExercises, currentWorkoutPlan, workoutStartTime, userProfile, workoutLogs, saveWorkoutLog, saveWorkoutPlan]);

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!window.confirm('Ви впевнені, що хочете видалити свій акаунт? Цю дію не можна скасувати!')) return;
    try {
      // Очищення даних з локального сховища (залишаємо для надійності, хоча вже не використовуємо активно)
      localStorage.removeItem('fitnessAiAppUserProfile_v1');
      localStorage.removeItem('fitnessAiAppWorkoutPlan_v1');
      localStorage.removeItem('fitnessAiAppWorkoutLogs_v1');
      
      // --- Видалення даних користувача з Firestore ---
      if (user && user.uid) {
         const userId = user.uid;
         console.log(`Видалення даних користувача ${userId} з Firestore`);

         // 1. Видалення документа профілю
         try {
            const userProfileRef = doc(db, "users", userId);
            await deleteDoc(userProfileRef);
            console.log(`Профіль користувача ${userId} видалено з Firestore`);
         } catch (profileError: any) {
            console.error(`Помилка при видаленні профілю користувача ${userId}:`, profileError);
            // Продовжуємо видаляти інші дані, навіть якщо профіль не видалився
         }

         // 2. Видалення документа плану тренувань
         try {
            const workoutPlanRef = doc(db, "workoutPlans", userId);
            await deleteDoc(workoutPlanRef);
            console.log(`План тренувань користувача ${userId} видалено з Firestore`);
         } catch (planError: any) {
            console.error(`Помилка при видаленні плану тренувань користувача ${userId}:`, planError);
            // Продовжуємо видаляти інші дані, навіть якщо план не видалився
         }

         // 3. Видалення логів тренувань (це колекція, потрібно видалити кожен документ)
         try {
            const workoutLogsCollectionRef = collection(db, "workoutLogs");
            const q = query(workoutLogsCollectionRef, where("userId", "==", userId));
            const querySnapshot = await getDocs(q);

            const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
            await Promise.all(deletePromises);
            console.log(`Логи тренувань користувача ${userId} видалено з Firestore`);
         } catch (logsError: any) {
            console.error(`Помилка при видаленні логів тренувань користувача ${userId}:`, logsError);
            // Продовжуємо, навіть якщо логи не видалилися
         }

      }
      // --- Кінець видалення даних користувача з Firestore ---
      
      await deleteUser(auth.currentUser!);
      alert('Акаунт успішно видалено.');
      // Після видалення акаунта, стан додатка буде скинуто через логіку в useAuth
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert('Для видалення акаунта потрібно повторно увійти. Вийдіть і увійдіть знову, потім спробуйте ще раз.');
      } else {
        alert('Помилка при видаленні акаунта: ' + error.message);
      }
    }
  };

  const handleSaveWorkoutPlan = useCallback(async (plan: DailyWorkoutPlan[]) => {
    try {
      await saveWorkoutPlan(plan);
      setCurrentWorkoutPlan(plan);
    } catch (e: any) {
      console.error("Error saving edited workout plan:", e);
      setError(e.message || UI_TEXT.errorOccurred);
    }
  }, [saveWorkoutPlan]);

  const renderView = () => {
    if (isLoading && currentView !== 'profile' && activeWorkoutDay === null) return <Spinner message={UI_TEXT.generatingWorkout} />;
    
    if (userDataLoading && activeWorkoutDay === null) {
        return <Spinner message={UI_TEXT.loadingUserData} />;
    }

    // Add spinner for workout analysis
    if (isAnalyzingWorkout) {
        return <Spinner message="Аналізуємо тренування..." />;
    }

    if (!firestoreProfile) {
      return <UserProfileForm 
                existingProfile={userProfile} 
                onSave={handleProfileSave} 
                apiKeyMissing={apiKeyMissing} 
                isLoading={isLoading}
                onLogout={logout}
                onDeleteAccount={handleDeleteAccount}
              />;
    }

    if (firestoreProfile && !workoutPlan) {
        return <WorkoutDisplay 
                userProfile={firestoreProfile}
                workoutPlan={null}
                onGenerateNewPlan={handleGenerateNewPlan}
                isLoading={isLoading || (apiKeyMissing && !userProfile)}
                activeDay={activeWorkoutDay}
                sessionExercises={sessionExercises}
                onStartWorkout={handleStartWorkout}
                onEndWorkout={handleEndWorkout}
                onLogExercise={handleLogSingleExercise}
                workoutTimerDisplay={formatTime(workoutTimer)}
                isApiKeyMissing={apiKeyMissing}
                onSaveWorkoutPlan={handleSaveWorkoutPlan}
              />;
    }
    
    switch (currentView) {
      case 'profile':
        return <UserProfileForm 
                  existingProfile={userProfile} 
                  onSave={handleProfileSave} 
                  apiKeyMissing={apiKeyMissing} 
                  isLoading={isLoading}
                  onLogout={logout}
                  onDeleteAccount={handleDeleteAccount}
                />;
      case 'workout':
        console.log('Rendering WorkoutDisplay. isLoading:', isLoading, 'userDataLoading:', userDataLoading, 'isAnalyzingWorkout:', isAnalyzingWorkout);
        return <WorkoutDisplay 
                  userProfile={userProfile}
                  workoutPlan={currentWorkoutPlan} 
                  onGenerateNewPlan={handleGenerateNewPlan}
                  isLoading={isLoading || (apiKeyMissing && !userProfile) || isAnalyzingWorkout}
                  activeDay={activeWorkoutDay}
                  sessionExercises={sessionExercises}
                  onStartWorkout={handleStartWorkout}
                  onEndWorkout={handleEndWorkout}
                  onLogExercise={handleLogSingleExercise}
                  workoutTimerDisplay={formatTime(workoutTimer)}
                  isApiKeyMissing={apiKeyMissing}
                  onSaveWorkoutPlan={handleSaveWorkoutPlan}
                />;
      case 'progress':
        console.log('Rendering ProgressView. workoutLogs:', workoutLogs);
        return <ProgressView 
                  workoutLogs={workoutLogs}
                  userProfile={userProfile}
                />;
      default:
        return <UserProfileForm 
                  existingProfile={userProfile} 
                  onSave={handleProfileSave} 
                  apiKeyMissing={apiKeyMissing} 
                  isLoading={isLoading}
                  onLogout={logout}
                  onDeleteAccount={handleDeleteAccount}
                />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-xl text-purple-400">Завантаження автентифікації...</div>;
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-slate-800 to-purple-900">
      <header className="bg-gray-800/70 backdrop-blur-md shadow-lg p-3 sm:p-4 sticky top-0 z-50">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2 sm:mb-0">
            <i className="fas fa-dumbbell mr-2"></i>{UI_TEXT.appName}
          </h1>
          {(userProfile || currentView !== 'profile' || isLoading || activeWorkoutDay !== null) && 
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
         {renderView()}
      </main>

      <footer className="bg-gray-800/50 text-center p-3 sm:p-4 text-xs sm:text-sm text-gray-400 mt-auto">
        © {new Date().getFullYear()} {UI_TEXT.appName}. Усі права захищено.
      </footer>
    </div>
  );
};

export default App;