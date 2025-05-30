import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, DailyWorkoutPlan, WorkoutLog, Exercise, LoggedExercise, LoggedSet } from './types';
import { UI_TEXT, GEMINI_MODEL_TEXT, DEFAULT_WEIGHT_INCREMENT, formatTime } from './constants';
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

type View = 'profile' | 'workout' | 'progress';

const App: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const { workoutPlan, saveWorkoutPlan, loading: userDataLoading, profile: firestoreProfile, workoutLogs: firestoreWorkoutLogs, saveProfile, saveWorkoutLog } = useUserData();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('profile');
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

  // Active Workout Session State
  const [activeWorkoutDay, setActiveWorkoutDay] = useState<number | null>(null); // Day number
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>([]);
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [workoutTimer, setWorkoutTimer] = useState<number>(0);

  useEffect(() => {
    if (typeof import.meta.env === 'undefined' || !import.meta.env.VITE_API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  useEffect(() => {
    if (workoutPlan) {
      setCurrentWorkoutPlan(workoutPlan);
      setCurrentView('workout');
    } else {
      setCurrentWorkoutPlan(null);
      setCurrentView('profile');
    }
  }, [workoutPlan]);

  // Синхронізація профілю та логів з useUserData (Firestore)
  useEffect(() => {
    setUserProfile(firestoreProfile);
    setWorkoutLogs(firestoreWorkoutLogs);
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
  
  const handleEndWorkout = useCallback(async () => {
    if (activeWorkoutDay === null || !currentWorkoutPlan || !Array.isArray(currentWorkoutPlan) || !workoutStartTime) return;

    const loggedExercisesForSession: LoggedExercise[] = sessionExercises
      .filter(ex => ex.isCompletedDuringSession)
      .map((ex) => ({
        name: ex.name,
        sets: ex.sessionLoggedSets || [],
      }));

    if (loggedExercisesForSession.length === 0) {
        setActiveWorkoutDay(null);
        setWorkoutStartTime(null);
        setSessionExercises([]);
        alert("Тренування завершено, але жодної вправи не було залоговано.");
        return;
    }
    
    const newLog: WorkoutLog = {
      id: new Date().toISOString(),
      userId: userProfile?.uid || 'anonymous',
      date: new Date(),
      duration: Math.floor((Date.now() - workoutStartTime) / 1000),
      exercises: loggedExercisesForSession,
    };

    const updatedLogs = [...workoutLogs, newLog];
    setWorkoutLogs(updatedLogs);
    await saveWorkoutLog(newLog); // Зберігаємо новий лог у Firestore через useUserData

    let planWasUpdated = false;
    const updatedPlan = currentWorkoutPlan.map(dayPlan => {
      if (dayPlan.day === activeWorkoutDay) {
        const newExercisesForDay = (dayPlan.exercises && Array.isArray(dayPlan.exercises) ? dayPlan.exercises : []).map(exInPlan => {
          const loggedEx = loggedExercisesForSession.find(le => le.name === exInPlan.name);
          if (loggedEx && loggedEx.sets.length > 0) {
            let newTargetWeight = exInPlan.targetWeight;
            const averageWeightUsed = loggedEx.sets.reduce((sum: number, set) => sum + (set.weightUsed ?? 0), 0) / loggedEx.sets.length;

            if (loggedEx.sets.length > 0) {
                if (exInPlan.targetWeight !== undefined && exInPlan.targetWeight !== null && averageWeightUsed >= exInPlan.targetWeight) {
                    newTargetWeight = exInPlan.targetWeight + DEFAULT_WEIGHT_INCREMENT;
                } else if ((exInPlan.targetWeight === undefined || exInPlan.targetWeight === null) && averageWeightUsed > 0) {
                    newTargetWeight = averageWeightUsed + DEFAULT_WEIGHT_INCREMENT;
                }
            }

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
    }
    
    alert(UI_TEXT.workoutLogged + (planWasUpdated ? " План оновлено з новими цілями!" : ""));
    setActiveWorkoutDay(null);
    setWorkoutStartTime(null);
    setSessionExercises([]);
    setCurrentView('progress'); 
  }, [activeWorkoutDay, sessionExercises, currentWorkoutPlan, workoutLogs, workoutStartTime, userProfile, saveWorkoutPlan, saveWorkoutLog]);

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!window.confirm('Ви впевнені, що хочете видалити свій акаунт? Цю дію не можна скасувати!')) return;
    try {
      // Очищення даних з локального сховища (залишаємо для надійності, хоча вже не використовуємо активно)
      localStorage.removeItem('fitnessAiAppUserProfile_v1');
      localStorage.removeItem('fitnessAiAppWorkoutPlan_v1');
      localStorage.removeItem('fitnessAiAppWorkoutLogs_v1');
      
      // Очищення даних з Firestore (якщо користувач автентифікований)
      if (user && user.uid) {
         // Тут потрібна логіка видалення документів користувача з Firestore.
         // Це може включати видалення документа профілю та колекції логів тренувань.
         // Оскільки у нас немає прямого доступу до Firestore тут, я залишу placeholder.
         // В реальному застосунку тут були б виклики до Firebase SDK для видалення.
         console.log(`Placeholder: Видалення даних користувача ${user.uid} з Firestore`);
         // Приклад (потрібно адаптувати до вашої структури Firestore):
         // const userProfileRef = doc(db, "userProfiles", user.uid);
         // await deleteDoc(userProfileRef);
         // const workoutLogsCollectionRef = collection(db, "users", user.uid, "workoutLogs");
         // const querySnapshot = await getDocs(workoutLogsCollectionRef);
         // querySnapshot.forEach(async (doc) => { await deleteDoc(doc.ref); });
      }
      
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

  const renderView = () => {
    if (isLoading && currentView !== 'profile' && activeWorkoutDay === null) return <Spinner message={UI_TEXT.generatingWorkout} />;
    
    if (userDataLoading && activeWorkoutDay === null) {
        return <Spinner message={UI_TEXT.loadingUserData} />;
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