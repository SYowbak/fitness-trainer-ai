import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, DailyWorkoutPlan, WorkoutLog, Exercise, LoggedExercise, LoggedSetWithAchieved } from './types';
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
import { db } from './config/firebase';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { analyzeWorkout } from './services/workoutAnalysisService';
import { useWorkoutSync } from './hooks/useWorkoutSync';

type View = 'profile' | 'workout' | 'progress';

const App: React.FC = () => {
  const { user, loading, logout, setUser } = useAuth();
  const { workoutPlan, saveWorkoutPlan, loading: userDataLoading, profile: firestoreProfile, workoutLogs: firestoreWorkoutLogs, saveProfile, saveWorkoutLog } = useUserData();
  const { session, startWorkout, updateExercise, endWorkout, updateTimer } = useWorkoutSync(user?.uid || '');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('profile');
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

  const [isAnalyzingWorkout, setIsAnalyzingWorkout] = useState<boolean>(false);

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
  }, [firestoreProfile, firestoreWorkoutLogs]);

  // Оновлюємо таймер на основі сесії з useWorkoutSync
  useEffect(() => {
    let timerInterval: number | null = null;
    if (session.startTime && session.activeDay !== null) {
      const startTime = session.startTime;
      timerInterval = window.setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime = Math.floor((currentTime - startTime) / 1000);
        updateTimer(elapsedTime);
      }, 1000);
    } else {
      updateTimer(0); // Скидаємо таймер, якщо тренування не активне
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [session.startTime, session.activeDay, updateTimer]);

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
      // setActiveWorkoutDay(null); // Це вже не потрібно, оскільки useWorkoutSync керує activeDay
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
      if (session.activeDay !== null) { // Використовуємо session.activeDay
         if(!confirm("У вас є активне тренування. Створення нового плану завершить його без збереження. Продовжити?")) return;
         endWorkout(); // Завершуємо активну сесію Firebase
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
  }, [userProfile, apiKeyMissing, session.activeDay, endWorkout, saveWorkoutPlan]);

  const handleStartWorkout = useCallback(async (dayNumber: number) => {
    console.log("handleStartWorkout викликано для дня:", dayNumber);
    if (!currentWorkoutPlan || !Array.isArray(currentWorkoutPlan)) {
      console.log("currentWorkoutPlan відсутній або не є масивом.");
      return;
    }
    const planForDay = currentWorkoutPlan.find(d => d.day === dayNumber);
    if (planForDay && planForDay.exercises && Array.isArray(planForDay.exercises)) {
      console.log("Знайдено план для дня:", dayNumber, "з вправами:", planForDay.exercises);
      try {
        await startWorkout(dayNumber, planForDay.exercises);
        console.log("startWorkout успішно викликано.");
      } catch (e: any) {
        console.error("Помилка при початку тренування (handleStartWorkout):", e);
        setError(e.message || "Помилка при початку тренування.");
      }
    } else {
      console.log("План для дня не знайдено або вправи відсутні/не є масивом.", planForDay);
    }
  }, [currentWorkoutPlan, startWorkout]);

  const handleLogSingleExercise = useCallback((exerciseIndex: number, loggedSets: LoggedSetWithAchieved[], success: boolean) => {
    updateExercise(exerciseIndex, loggedSets, success);
  }, [updateExercise]);
  
  const handleEndWorkout = useCallback(async () => {
    if (session.activeDay === null || !currentWorkoutPlan || !Array.isArray(currentWorkoutPlan) || !session.startTime || !userProfile) return;

    const currentDayPlan = currentWorkoutPlan.find(p => p.day === session.activeDay);
    if (!currentDayPlan) {
      console.error("Could not find current day's plan.");
      alert("Помилка: Не вдалося знайти план тренування для аналізу.");
      return;
    }

    const loggedExercisesForSession: LoggedExercise[] = session.sessionExercises
      .filter(ex => ex.isCompletedDuringSession)
      .map((ex) => ({
        exerciseName: ex.name,
        originalSets: ex.sets,
        originalReps: ex.reps,
        targetWeightAtLogging: ex.targetWeight || null,
        loggedSets: ex.sessionLoggedSets || [],
        completedSuccessfully: ex.sessionSuccess ?? false,
        notes: ex.notes ?? null,
      }));

    if (loggedExercisesForSession.length === 0) {
      endWorkout();
      alert("Тренування завершено, але жодної вправи не було залоговано.");
      return;
    }
    
    const newLog: WorkoutLog = {
      id: new Date().toISOString(),
      userId: userProfile?.uid || 'anonymous',
      date: new Date(),
      duration: Math.floor((Date.now() - session.startTime) / 1000),
      dayCompleted: session.activeDay ?? null,
      workoutDuration: formatTime(Math.floor((Date.now() - session.startTime) / 1000)) ?? null,
      loggedExercises: loggedExercisesForSession,
    };

    try {
      await saveWorkoutLog(newLog);
      setWorkoutLogs(prev => [...prev, newLog]);
      alert(UI_TEXT.workoutLogged);
    } catch (e: any) {
      console.error("Error saving workout log:", e);
      setError(e.message || "Помилка при збереженні логу тренування.");
      return;
    }

    endWorkout();
    
    // --- Start Workout Analysis ---
    setIsAnalyzingWorkout(true);
    try {
      const analysisResult = await analyzeWorkout(
        userProfile,
        currentDayPlan,
        newLog,
        workoutLogs
      );
      if (analysisResult?.updatedPlan) {
        const planIndex = currentWorkoutPlan.findIndex(p => p.day === analysisResult.updatedPlan.day);
        if (planIndex !== -1) {
          const newWorkoutPlan = [...currentWorkoutPlan];
          newWorkoutPlan[planIndex] = analysisResult.updatedPlan;
          setCurrentWorkoutPlan(newWorkoutPlan);
          await saveWorkoutPlan(newWorkoutPlan);
        } else {
          console.error("Analyzed plan day not found in current workout plan.", analysisResult.updatedPlan);
        }
      }
      setCurrentView('progress');
    } catch (e: any) {
      console.error("Error analyzing workout:", e);
      setError(e.message || "Помилка при аналізі тренування.");
      setCurrentView('progress');
    } finally {
      setIsAnalyzingWorkout(false);
    }
  }, [session, currentWorkoutPlan, userProfile, endWorkout, saveWorkoutLog, saveWorkoutPlan, workoutLogs]);

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    try {
      // Видаляємо дані з Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteDoc(doc(db, 'workoutPlans', user.uid));
      
      // Видаляємо всі логи тренувань користувача
      const logsQuery = query(collection(db, 'workoutLogs'), where('userId', '==', user.uid));
      const logsSnapshot = await getDocs(logsQuery);
      const deletePromises = logsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Видаляємо користувача
      await deleteUser(user);
      
      setUser(null);
      setCurrentView('profile');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Помилка при видаленні акаунту. Спробуйте ще раз.');
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
    // Враховуємо активну сесію з useWorkoutSync для відображення Spinner або WorkoutDisplay
    if (isLoading && currentView !== 'profile' && session.activeDay === null) return <Spinner message={UI_TEXT.generatingWorkout} />;
    if (userDataLoading && session.activeDay === null) {
        return <Spinner message={UI_TEXT.loadingUserData} />;
    }
    if (isAnalyzingWorkout) {
        return <Spinner message="Аналізуємо тренування..." />;
    }
    // Якщо є активна сесія тренування, одразу відображаємо WorkoutDisplay
    if (session.activeDay !== null) {
      console.log("Рендеринг WorkoutDisplay з пропсами:", {
        userProfile: userProfile, // Перевіряємо userProfile
        workoutPlan: currentWorkoutPlan, // Перевіряємо currentWorkoutPlan
        session: session // Перевіряємо весь об'єкт сесії
      });
      return <WorkoutDisplay 
                userProfile={userProfile}
                workoutPlan={currentWorkoutPlan}
                onGenerateNewPlan={handleGenerateNewPlan}
                isLoading={isLoading || (apiKeyMissing && !userProfile) || isAnalyzingWorkout}
                activeDay={session.activeDay}
                sessionExercises={session.sessionExercises}
                onStartWorkout={handleStartWorkout}
                onEndWorkout={handleEndWorkout}
                onLogExercise={handleLogSingleExercise}
                workoutTimerDisplay={formatTime(session.workoutTimer)}
                isApiKeyMissing={apiKeyMissing}
                onSaveWorkoutPlan={handleSaveWorkoutPlan}
              />;
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
                activeDay={session.activeDay} // Використовуємо session.activeDay
                sessionExercises={session.sessionExercises} // Використовуємо session.sessionExercises
                onStartWorkout={handleStartWorkout}
                onEndWorkout={handleEndWorkout}
                onLogExercise={handleLogSingleExercise}
                workoutTimerDisplay={formatTime(session.workoutTimer)} // Використовуємо session.workoutTimer
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
        return <WorkoutDisplay 
                  userProfile={userProfile}
                  workoutPlan={currentWorkoutPlan} 
                  onGenerateNewPlan={handleGenerateNewPlan}
                  isLoading={isLoading || (apiKeyMissing && !userProfile) || isAnalyzingWorkout}
                  activeDay={session.activeDay} // Використовуємо session.activeDay
                  sessionExercises={session.sessionExercises} // Використовуємо session.sessionExercises
                  onStartWorkout={handleStartWorkout}
                  onEndWorkout={handleEndWorkout}
                  onLogExercise={handleLogSingleExercise}
                  workoutTimerDisplay={formatTime(session.workoutTimer)} // Використовуємо session.workoutTimer
                  isApiKeyMissing={apiKeyMissing}
                  onSaveWorkoutPlan={handleSaveWorkoutPlan}
                />;
      case 'progress':
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
          {(userProfile || currentView !== 'profile' || isLoading || session.activeDay !== null) &&  // Використовуємо session.activeDay
            <Navbar currentView={currentView} onViewChange={(v) => {
              if (session.activeDay !== null && v !== 'workout') { // Використовуємо session.activeDay
                if(!confirm(UI_TEXT.confirmEndWorkout + " Перехід на іншу вкладку завершить його без збереження логів.")) return;
                endWorkout(); // Завершуємо активну сесію Firebase
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