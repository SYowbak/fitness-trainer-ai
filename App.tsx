import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, DailyWorkoutPlan, WorkoutLog, LoggedExercise, LoggedSetWithAchieved } from './types';
import { UI_TEXT, GEMINI_MODEL_TEXT, formatTime } from './constants';
import Navbar from './components/Navbar';
import UserProfileForm from './components/UserProfileForm';
import WorkoutDisplay from './components/WorkoutDisplay';
import ProgressView from './components/ProgressView';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import TrainerChat from './components/TrainerChat';
import { generateWorkoutPlan as apiGenerateWorkoutPlan, generateAdaptiveWorkout, generateWellnessRecommendations } from './services/geminiService';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { useUserData } from './hooks/useUserData';
import { deleteUser } from 'firebase/auth';
import { db } from './config/firebase';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { analyzeWorkout, getExerciseVariations, analyzeProgressTrends } from './services/workoutAnalysisService';
import { useWorkoutSync } from './hooks/useWorkoutSync';
import WellnessCheckModal from './components/WellnessCheckModal';
import WellnessRecommendations from './components/WellnessRecommendations';
import { WellnessCheck, AdaptiveWorkoutPlan, WellnessRecommendation } from './types';

type View = 'profile' | 'workout' | 'progress' | 'chat';

const App: React.FC = () => {
  const { user, loading, logout, setUser } = useAuth();
  const { workoutPlan, saveWorkoutPlan, profile: firestoreProfile, workoutLogs: firestoreWorkoutLogs, saveProfile, saveWorkoutLog } = useUserData();
  const { session, startWorkout, updateExercise, endWorkout, updateTimer, updateWellnessCheck, updateAdaptiveWorkoutPlan, updateWellnessRecommendations } = useWorkoutSync(user?.uid || '');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('profile');
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [exerciseRecommendations, setExerciseRecommendations] = useState<any[]>([]);
  const [exerciseVariations, setExerciseVariations] = useState<Map<string, any[]>>(new Map());
  const [progressTrends, setProgressTrends] = useState<any>(null);
  const [wellnessCheckModalOpen, setWellnessCheckModalOpen] = useState<boolean>(false);
  const [wellnessRecommendationsModalOpen, setWellnessRecommendationsModalOpen] = useState<boolean>(false);
  const [currentWellnessCheck, setCurrentWellnessCheck] = useState<WellnessCheck | null>(null);
  const [wellnessRecommendations, setWellnessRecommendations] = useState<WellnessRecommendation[]>([]);
  const [adaptiveWorkoutPlan, setAdaptiveWorkoutPlan] = useState<AdaptiveWorkoutPlan | null>(null);
  const [pendingWorkoutDay, setPendingWorkoutDay] = useState<number | null>(null);
  const [isTrainerChatOpen, setIsTrainerChatOpen] = useState(false);

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

  // Аналізуємо прогрес при зміні логів тренувань
  useEffect(() => {
    if (workoutLogs.length > 0) {
      const trends = analyzeProgressTrends(workoutLogs);
      setProgressTrends(trends);
    }
  }, [workoutLogs]);

  // Отримуємо варіації вправ для поточного плану
  const loadExerciseVariations = useCallback(async () => {
    if (!userProfile || !currentWorkoutPlan || !workoutLogs.length) return;

    const variationsMap = new Map<string, any[]>();
    
    for (const dayPlan of currentWorkoutPlan) {
      for (const exercise of dayPlan.exercises) {
        try {
          const variations = await getExerciseVariations(
            userProfile,
            exercise,
            workoutLogs,
            'general' // Можна покращити визначення цільової групи м'язів
          );
          if (variations.length > 0) {
            variationsMap.set(exercise.name, variations);
          }
        } catch (error) {
          console.error(`Помилка при отриманні варіацій для ${exercise.name}:`, error);
        }
      }
    }
    
    setExerciseVariations(variationsMap);
  }, [userProfile, currentWorkoutPlan, workoutLogs]);

  useEffect(() => {
    loadExerciseVariations();
  }, [loadExerciseVariations]);

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

  const handleStartWorkoutWithWellnessCheck = useCallback(async (dayNumber: number) => {
    setPendingWorkoutDay(dayNumber);
    setWellnessCheckModalOpen(true);
  }, []);

  // Оновлений handleStartWorkout для роботи з адаптивними планами
  const handleStartWorkout = useCallback(async (dayNumber: number) => {
    console.log("handleStartWorkout викликано для дня:", dayNumber);
    
    // Якщо є адаптивний план, використовуємо його
    const planToUse = adaptiveWorkoutPlan || currentWorkoutPlan;
    
    if (!planToUse || !Array.isArray(planToUse)) {
      console.log("planToUse відсутній або не є масивом.");
      return;
    }

    const planForDay = planToUse.find(d => d.day === dayNumber);
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
  }, [adaptiveWorkoutPlan, currentWorkoutPlan, startWorkout]);

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
      // Використовуємо дані з live-сесії замість локального стану
      wellnessCheck: session.wellnessCheck ?? null,
      adaptiveWorkoutPlan: session.adaptiveWorkoutPlan ?? null,
      wellnessRecommendations: session.wellnessRecommendations ?? null,
      wasAdaptiveWorkout: !!session.adaptiveWorkoutPlan,
    };
    console.log('Зберігаємо workoutLog у Firestore:', newLog);

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
    
    // Очищаємо локальний стан wellness check та адаптацій після завершення тренування
    // (live-сесія автоматично очиститься через endWorkout)
    setCurrentWellnessCheck(null);
    setAdaptiveWorkoutPlan(null);
    setWellnessRecommendations([]);
    setWellnessRecommendationsModalOpen(false);
    
    // --- Start Workout Analysis ---
    try {
      const analysisResult = await analyzeWorkout(
        userProfile,
        currentDayPlan,
        newLog,
        workoutLogs
      );
      
      // Зберігаємо рекомендації для відображення
      setExerciseRecommendations(analysisResult.dailyRecommendations || []);
      
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
      
      // Показуємо детальні рекомендації
      if (analysisResult.recommendation) {
        alert(`Аналіз завершено!\n\nЗагальна рекомендація: ${analysisResult.recommendation.text}`);
      }
      
      setCurrentView('progress');
    } catch (e: any) {
      console.error("Error analyzing workout:", e);
      setError(e.message || "Помилка при аналізі тренування.");
      setCurrentView('progress');
    }
  }, [session, currentWorkoutPlan, userProfile, endWorkout, saveWorkoutLog, saveWorkoutPlan, workoutLogs]);

  // Обробка вибору варіації вправи
  const handleSelectVariation = useCallback((exerciseName: string, variation: any) => {
    if (!currentWorkoutPlan || !Array.isArray(currentWorkoutPlan)) return;

    const newWorkoutPlan = currentWorkoutPlan.map(dayPlan => ({
      ...dayPlan,
      exercises: dayPlan.exercises.map(exercise => 
        exercise.name === exerciseName ? { ...variation, id: exercise.id } : exercise
      )
    }));

    setCurrentWorkoutPlan(newWorkoutPlan);
    saveWorkoutPlan(newWorkoutPlan);
    
    // Оновлюємо варіації після зміни
    loadExerciseVariations();
  }, [currentWorkoutPlan, saveWorkoutPlan, loadExerciseVariations]);

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

  const handleAnalyzeWorkout = useCallback(async (workoutLog: WorkoutLog) => {
    if (!userProfile || !currentWorkoutPlan) {
      setError('Не вдалося знайти профіль користувача або план тренувань');
      return;
    }
    
    const currentDayPlan = currentWorkoutPlan.find(p => p.day === workoutLog.dayCompleted);
    if (!currentDayPlan) {
      setError('Не вдалося знайти план тренування для аналізу');
      return;
    }

    setIsLoading(true);
    try {
      const analysis = await analyzeWorkout(
        userProfile,
        currentDayPlan,
        workoutLog,
        workoutLogs.filter(log => log.id !== workoutLog.id)
      );
      console.log('Workout analysis:', analysis);
      // Тут можна додати логіку для оновлення плану тренувань
    } catch (error) {
      console.error('Error analyzing workout:', error);
      setError('Помилка при аналізі тренування');
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, currentWorkoutPlan, workoutLogs]);

  // Обробка перевірки самопочуття
  const handleWellnessCheckSubmit = useCallback(async (wellnessCheck: WellnessCheck) => {
    if (!userProfile || !currentWorkoutPlan || pendingWorkoutDay === null) {
      setError('Не вдалося знайти профіль користувача, план тренувань або день.');
      setWellnessCheckModalOpen(false);
      return;
    }

    setCurrentWellnessCheck(wellnessCheck);
    setWellnessCheckModalOpen(false);
    setIsLoading(true);

    try {
      // Генеруємо адаптивний план тренування
      const adaptivePlan = await generateAdaptiveWorkout(
        userProfile,
        currentWorkoutPlan.find(d => d.day === pendingWorkoutDay) || currentWorkoutPlan[0],
        wellnessCheck,
        workoutLogs
      );
      setAdaptiveWorkoutPlan(adaptivePlan);

      // Генеруємо рекомендації по самопочуттю
      const recommendations = await generateWellnessRecommendations(
        userProfile,
        wellnessCheck,
        workoutLogs
      );
      setWellnessRecommendations(recommendations);
      setWellnessRecommendationsModalOpen(true);

      // Оновлюємо план тренувань з адаптивним планом
      const updatedPlan = currentWorkoutPlan.map(dayPlan => 
        dayPlan.day === adaptivePlan.day ? adaptivePlan : dayPlan
      );
      setCurrentWorkoutPlan(updatedPlan);
      await saveWorkoutPlan(updatedPlan);

      // АВТОМАТИЧНО СТАРТУЄМО ТРЕНУВАННЯ
      await startWorkout(adaptivePlan.day, adaptivePlan.exercises);
      
      // ОНОВЛЮЄМО LIVE-СЕСІЮ з wellnessCheck, adaptiveWorkoutPlan та wellnessRecommendations
      await updateWellnessCheck(wellnessCheck);
      await updateAdaptiveWorkoutPlan(adaptivePlan);
      await updateWellnessRecommendations(recommendations);
      
      setPendingWorkoutDay(null);
    } catch (error: any) {
      console.error('Error generating adaptive workout:', error);
      setError(error.message || 'Помилка при адаптації тренування');
      setPendingWorkoutDay(null);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, currentWorkoutPlan, workoutLogs, saveWorkoutPlan, pendingWorkoutDay, startWorkout, updateWellnessCheck, updateAdaptiveWorkoutPlan, updateWellnessRecommendations]);

  const handleWellnessCheckSkip = useCallback(() => {
    setWellnessCheckModalOpen(false);
    if (pendingWorkoutDay !== null && currentWorkoutPlan) {
      // Стартуємо тренування з оригінальним планом без адаптації
      const planForDay = currentWorkoutPlan.find(d => d.day === pendingWorkoutDay);
      if (planForDay) {
        startWorkout(planForDay.day, planForDay.exercises);
      }
      setPendingWorkoutDay(null);
    }
  }, [pendingWorkoutDay, currentWorkoutPlan, startWorkout]);

  // Додаємо функцію для видалення логів за датою
  const handleDeleteLogsByDate = useCallback(async (dateStr: string) => {
    if (!user || !user.uid) return;
    try {
      // 1. Знайти всі логи користувача
      const logsQuery = query(collection(db, 'workoutLogs'), where('userId', '==', user.uid));
      const logsSnapshot = await getDocs(logsQuery);
      // 2. Відфільтрувати по даті (тільки день/місяць/рік)
      const logsToDelete = logsSnapshot.docs.filter(docSnap => {
        const data = docSnap.data();
        let logDate = '';
        if (data.date && typeof data.date === 'object' && 'seconds' in data.date) {
          logDate = new Date(data.date.seconds * 1000).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
        } else if (data.date instanceof Date) {
          logDate = data.date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
          logDate = 'Невідома дата';
        }
        return logDate === dateStr;
      });
      // 3. Видалити з Firestore
      await Promise.all(logsToDelete.map(docSnap => deleteDoc(doc(db, 'workoutLogs', docSnap.id))));
      // 4. Оновити локальний стан
      setWorkoutLogs(prev => prev.filter(log => {
        let logDate = '';
        if (log.date && typeof log.date === 'object' && 'seconds' in log.date) {
          logDate = new Date(log.date.seconds * 1000).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
        } else if (log.date instanceof Date) {
          logDate = log.date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
          logDate = 'Невідома дата';
        }
        return logDate !== dateStr;
      }));
    } catch (error) {
      console.error('Помилка при видаленні логів за датою:', error);
      setError('Не вдалося видалити логи за цю дату. Спробуйте ще раз.');
    }
  }, [user]);

  const renderView = () => {
    if (!user) {
      return <AuthForm />;
    }

    if (isLoading) {
      return <Spinner />;
    }

    switch (currentView) {
      case 'profile':
        return (
          <div className="container mx-auto px-4 py-8">
            <UserProfileForm
              existingProfile={userProfile}
              onSave={handleProfileSave}
              apiKeyMissing={apiKeyMissing}
              isLoading={isLoading}
              onLogout={logout}
              onDeleteAccount={handleDeleteAccount}
            />
          </div>
        );
      case 'workout':
        return (
          <div className="container mx-auto px-4 py-8">
            <WorkoutDisplay
              workoutPlan={adaptiveWorkoutPlan ? [adaptiveWorkoutPlan] : currentWorkoutPlan}
              onStartWorkout={handleStartWorkoutWithWellnessCheck}
              onLogExercise={handleLogSingleExercise}
              onEndWorkout={handleEndWorkout}
              userProfile={userProfile}
              onGenerateNewPlan={handleGenerateNewPlan}
              isLoading={isLoading}
              activeDay={session.activeDay}
              sessionExercises={session.sessionExercises}
              workoutTimerDisplay={formatTime(session.workoutTimer)}
              isApiKeyMissing={apiKeyMissing}
              onSaveWorkoutPlan={handleSaveWorkoutPlan}
              exerciseRecommendations={exerciseRecommendations}
              exerciseVariations={exerciseVariations}
              onSelectVariation={handleSelectVariation}
              progressTrends={progressTrends}
              wellnessCheck={session.wellnessCheck}
              adaptiveWorkoutPlan={session.adaptiveWorkoutPlan}
            />
          </div>
        );
      case 'progress':
        return (
          <div className="container mx-auto px-4 py-8">
            <ProgressView
              workoutLogs={workoutLogs}
              userProfile={userProfile}
              onAnalyzeWorkout={handleAnalyzeWorkout}
              onDeleteLog={handleDeleteLogsByDate}
            />
          </div>
        );
      case 'chat':
        return (
          <div className="container mx-auto px-4 py-8">
            <TrainerChat
              userProfile={userProfile!}
              lastWorkoutLog={workoutLogs[0] || null}
              previousWorkoutLogs={workoutLogs.slice(1)}
            />
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-xl text-purple-400">Завантаження автентифікації...</div>;
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
        {/* Плаваюча кнопка чату (видима лише на вкладках тренування і прогрес) */}
        {(currentView === 'workout' || currentView === 'progress') && (
          <button
            className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg p-4 flex items-center justify-center text-2xl transition-colors"
            style={{ boxShadow: '0 4px 24px rgba(80,0,120,0.25)' }}
            onClick={() => setIsTrainerChatOpen(true)}
            aria-label="Відкрити чат з тренером"
          >
            <i className="fas fa-comments"></i>
          </button>
        )}
        {/* Overlay чат з тренером */}
        {isTrainerChatOpen && (
          <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-md sm:max-w-lg bg-gray-900 border border-purple-700 rounded-xl shadow-2xl flex flex-col" style={{ minHeight: '60vh', maxHeight: '80vh' }}>
            <div className="flex justify-between items-center p-3 border-b border-purple-700 bg-purple-900/80 rounded-t-xl">
              <span className="text-lg font-semibold text-purple-200"><i className="fas fa-robot mr-2"></i>Чат з тренером</span>
              <button onClick={() => setIsTrainerChatOpen(false)} className="text-gray-400 hover:text-white text-xl" aria-label="Закрити чат">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <TrainerChat
                userProfile={userProfile!}
                lastWorkoutLog={workoutLogs[0] || null}
                previousWorkoutLogs={workoutLogs.slice(1)}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-gray-800/50 text-center p-3 sm:p-4 text-xs sm:text-sm text-gray-400 mt-auto">
        © {new Date().getFullYear()} {UI_TEXT.appName}. Усі права захищено.
      </footer>

      {/* Модальні вікна */}
      <WellnessCheckModal
        isOpen={wellnessCheckModalOpen}
        onClose={() => setWellnessCheckModalOpen(false)}
        onSubmit={handleWellnessCheckSubmit}
        onSkip={handleWellnessCheckSkip}
      />

      {wellnessRecommendationsModalOpen && (
        <WellnessRecommendations
          recommendations={wellnessRecommendations}
          onClose={() => setWellnessRecommendationsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;