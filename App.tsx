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
import { collection, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { analyzeWorkout, getExerciseVariations, analyzeProgressTrends } from './services/workoutAnalysisService';
import { useWorkoutSync } from './hooks/useWorkoutSync';
import WellnessCheckModal from './components/WellnessCheckModal';
import WellnessRecommendations from './components/WellnessRecommendations';
import { WellnessCheck, AdaptiveWorkoutPlan, WellnessRecommendation } from './types';
import WorkoutCompleteModal from './components/WorkoutCompleteModal';
import AddExerciseModal from './components/AddExerciseModal';

type View = 'profile' | 'workout' | 'progress';

const App: React.FC = () => {
  const { user, loading, logout, setUser } = useAuth();
  const { workoutPlan, saveWorkoutPlan, profile: firestoreProfile, workoutLogs: firestoreWorkoutLogs, saveProfile, saveWorkoutLog } = useUserData();
  const { session, startWorkout, updateExercise, addCustomExercise, endWorkout, updateTimer, updateWellnessCheck, updateAdaptiveWorkoutPlan, updateWellnessRecommendations } = useWorkoutSync(user?.uid || '');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('workout');
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [exerciseRecommendations, setExerciseRecommendations] = useState<any[]>([]);
  const [exerciseVariations, setExerciseVariations] = useState<Map<string, any[]>>(new Map());
  const [progressTrends, setProgressTrends] = useState<any>(null);
  const [wellnessCheckModalOpen, setWellnessCheckModalOpen] = useState<boolean>(false);
  const [wellnessRecommendationsModalOpen, setWellnessRecommendationsModalOpen] = useState<boolean>(false);
  const [wellnessRecommendations, setWellnessRecommendations] = useState<WellnessRecommendation[]>([]);
  const [adaptiveWorkoutPlan, setAdaptiveWorkoutPlan] = useState<AdaptiveWorkoutPlan | null>(null);
  const [pendingWorkoutDay, setPendingWorkoutDay] = useState<number | null>(null);
  const [isTrainerChatOpen, setIsTrainerChatOpen] = useState(false);
  const [hasInitializedView, setHasInitializedView] = useState(false);
  const [isWorkoutCompleteModalOpen, setIsWorkoutCompleteModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingLogId, setAnalyzingLogId] = useState<string | null>(null);
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);

  // Виділення обмежень здоров'я з нотаток самопочуття
  const extractConstraintsFromNotes = useCallback((notes?: string): string[] => {
    if (!notes) return [];
    const text = notes.toLowerCase();
    const keywords: { key: RegExp; label: string }[] = [
      { key: /колін|коліно|коліна/, label: 'коліно' },
      { key: /спин|поперек|хребт/, label: 'спина' },
      { key: /плеч|дельт/, label: 'плече' },
      { key: /лік(оть|ті)/, label: 'лікоть' },
      { key: /зап\'?яст|кисть/, label: "зап'ястя" },
      { key: /щиколот|гомілк|голеностоп/, label: 'щиколотка' },
      { key: /ахіл|ахілл/, label: 'ахіллове сухожилля' },
      { key: /шия|ший/, label: 'шия' },
      { key: /таз|кульш|стегн/, label: 'таз/стегно' },
      { key: /травм|розтяг|надрив|запаленн|біль|болить/, label: 'біль/травма' }
    ];
    const found = new Set<string>();
    for (const { key, label } of keywords) {
      if (key.test(text)) found.add(label);
    }
    // Якщо нічого не знайдено, спробуємо короткий конспект з перших слів
    if (found.size === 0) {
      const summary = notes.trim().split(/\s+/).slice(0, 5).join(' ');
      if (summary) found.add(summary);
    }
    return Array.from(found).slice(0, 5);
  }, []);

  useEffect(() => {
    if (typeof import.meta.env === 'undefined' || !import.meta.env.VITE_API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  // Скидаємо стан ініціалізації при виході користувача
  useEffect(() => {
    if (!user) {
      setHasInitializedView(false);
    }
  }, [user]);

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

  // Автоматичний вибір початкової вкладки на основі наявності плану тренувань (тільки при початковому завантаженні)
  useEffect(() => {
    // Безпечна перевірка наявності плану тренувань
    const hasWorkoutPlan = currentWorkoutPlan && Array.isArray(currentWorkoutPlan) && currentWorkoutPlan.length > 0;
    
    // Перевіряємо тільки якщо користувач авторизований, це перше завантаження і ще не було ініціалізації
    if (user && !hasInitializedView) {
      if (hasWorkoutPlan && currentView === 'profile') {
        // Якщо є план тренувань і зараз відображається профіль, переключаємося на тренування
        setCurrentView('workout');
      } else if (!hasWorkoutPlan && currentView !== 'profile') {
        // Якщо немає плану тренувань і зараз не профіль, переключаємося на профіль
        setCurrentView('profile');
      }
      setHasInitializedView(true);
    }
  }, [user, currentWorkoutPlan, hasInitializedView]);

  // Оновлюємо таймер на основі сесії з useWorkoutSync
  useEffect(() => {
    let timerInterval: number | null = null;
    if (user && session.startTime && session.activeDay !== null) {
      const startTime = session.startTime;
      timerInterval = window.setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime = Math.floor((currentTime - startTime) / 1000);
        updateTimer(elapsedTime);
      }, 1000);
    } else if (user) {
      updateTimer(0); // Скидаємо таймер, якщо тренування не активне
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [user, session.startTime, session.activeDay, updateTimer]);

  // Аналізуємо прогрес при зміні логів тренувань
  useEffect(() => {
    if (workoutLogs && workoutLogs.length > 0) {
      const trends = analyzeProgressTrends(workoutLogs);
      setProgressTrends(trends);
    }
  }, [workoutLogs]);

  // Отримуємо варіації вправ для поточного плану
  const loadExerciseVariations = useCallback(async () => {
    if (!userProfile || !currentWorkoutPlan || !workoutLogs || !workoutLogs.length) return;

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

  const handleLogSingleExercise = useCallback((exerciseIndex: number, loggedSets: LoggedSetWithAchieved[], success: boolean) => {
    updateExercise(exerciseIndex, loggedSets, success);
  }, [updateExercise]);

  const handleSkipExercise = useCallback((exerciseIndex: number) => {
    updateExercise(exerciseIndex, [], false, true); // Позначаємо як пропущену, без логування, isSkipped = true
  }, [updateExercise]);
  
  const handleEndWorkout = useCallback(async () => {
    // Додаємо більше логів для відстеження
    console.log('[handleEndWorkout] Початок. Сесія:', session);
    console.log('[handleEndWorkout] user:', user);
    console.log('[handleEndWorkout] userProfile:', userProfile);

    if (session.activeDay === null || !currentWorkoutPlan || !Array.isArray(currentWorkoutPlan) || !session.startTime || !userProfile || !user) {
      console.error("[handleEndWorkout] Відсутні необхідні дані для завершення тренування");
      alert("Помилка: Не вдалося завершити тренування. Перевірте, чи ви авторизовані.");
      return;
    }

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

    endWorkout();
    setAdaptiveWorkoutPlan(null);
    setWellnessRecommendations([]);
    setWellnessRecommendationsModalOpen(false);
    
    // Створюємо ОБ'ЄКТ логу, але без ID
    let workoutLog: WorkoutLog = {
      userId: user.uid,
      date: new Date(),
      duration: Math.floor((Date.now() - session.startTime) / 1000),
      dayCompleted: session.activeDay ?? null,
      workoutDuration: formatTime(Math.floor((Date.now() - session.startTime) / 1000)) ?? null,
      loggedExercises: loggedExercisesForSession,
      wellnessCheck: session.wellnessCheck ?? null,
      adaptiveWorkoutPlan: session.adaptiveWorkoutPlan ? {
        ...session.adaptiveWorkoutPlan,
        adaptations: session.adaptiveWorkoutPlan.adaptations || []
      } : null,
      wellnessRecommendations: session.wellnessRecommendations ?? null,
      wasAdaptiveWorkout: !!session.adaptiveWorkoutPlan,
    };

    try {
      // 1. Зберігаємо базовий лог і отримуємо його з ID
      console.log('[App.tsx] Зберігаємо базовий лог (без рекомендацій)');
      const savedLog = await saveWorkoutLog(workoutLog);
      setWorkoutLogs(prev => [savedLog, ...prev]);

      // 2. Аналізуємо тренування
      console.log('[App.tsx] Починаємо аналіз тренування...');
      const analysisResult = await analyzeWorkout(
        userProfile,
        currentWorkoutPlan.find(p => p.day === session.activeDay)!,
        savedLog,
        workoutLogs
      );
      
      // 3. Оновлюємо лог з рекомендаціями
      if (analysisResult.recommendation) {
        console.log('[App.tsx] Аналіз успішний, оновлюємо лог з рекомендаціями.');
        const finalLog = { ...savedLog, recommendation: analysisResult.recommendation };
        const updatedLog = await saveWorkoutLog(finalLog);
        setWorkoutLogs(prev => prev.map(l => (l.id === updatedLog.id ? updatedLog : l)));
      } else {
        console.log('[App.tsx] Аналіз завершено, але рекомендацій немає.');
      }

      // Оновлюємо план тренувань, якщо потрібно
      if (analysisResult?.updatedPlan) {
        const planIndex = currentWorkoutPlan.findIndex(p => p.day === analysisResult.updatedPlan.day);
        if (planIndex !== -1) {
          const newWorkoutPlan = [...currentWorkoutPlan];
          newWorkoutPlan[planIndex] = analysisResult.updatedPlan;
          setCurrentWorkoutPlan(newWorkoutPlan);
          await saveWorkoutPlan(newWorkoutPlan);
        }
      }

      setExerciseRecommendations(analysisResult.dailyRecommendations || []);
      setIsWorkoutCompleteModalOpen(true); // Відкриваємо модальне вікно
    } catch (analysisError) {
      console.error("[handleEndWorkout] Помилка під час аналізу тренування:", analysisError);
      setError("Не вдалося проаналізувати тренування");
    }
    
    setCurrentView('progress');
  }, [session, currentWorkoutPlan, userProfile, endWorkout, saveWorkoutLog, saveWorkoutPlan, workoutLogs, user]);

  // Обробка вибору варіації вправи
  const handleSelectVariation = useCallback(async (exerciseName: string, variation: any) => {
    if (!currentWorkoutPlan || !Array.isArray(currentWorkoutPlan)) return;

    const newWorkoutPlan = currentWorkoutPlan.map(dayPlan => ({
      ...dayPlan,
      exercises: dayPlan.exercises.map(exercise => 
        exercise.name === exerciseName ? { ...variation, id: exercise.id } : exercise
      )
    }));

    setCurrentWorkoutPlan(newWorkoutPlan);
    await saveWorkoutPlan(newWorkoutPlan);
    
    // Після вибору прибираємо варіації для цієї вправи з мапи, щоб не клікатись повторно
    setExerciseVariations(prev => {
      const newMap = new Map(prev);
      newMap.delete(exerciseName);
      return newMap;
    });
  }, [currentWorkoutPlan, saveWorkoutPlan]);

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

  const handleAnalyzeWorkoutFromLog = useCallback(async (logToAnalyze: WorkoutLog) => {
    if (!userProfile || !currentWorkoutPlan || !logToAnalyze.id) return;
    setIsAnalyzing(true);
    setAnalyzingLogId(logToAnalyze.id);
    try {
      const currentDayPlan = currentWorkoutPlan.find(p => p.day === logToAnalyze.dayCompleted);
      if (!currentDayPlan) {
        setError('Не вдалося знайти план тренування для аналізу');
        return;
      }

      const analysis = await analyzeWorkout(
        userProfile,
        currentDayPlan,
        logToAnalyze,
        workoutLogs.filter(log => log.id !== logToAnalyze.id)
      );
      console.log('Workout analysis:', analysis);
      // Тут можна додати логіку для оновлення плану тренувань
    } catch (error) {
      console.error("Помилка при повторному аналізі:", error);
      setError("Не вдалося проаналізувати тренування. Спробуйте ще раз.");
    } finally {
      setIsAnalyzing(false);
      setAnalyzingLogId(null);
    }
  }, [userProfile, currentWorkoutPlan, workoutLogs, saveWorkoutLog]);

  const handleDeleteLog = async (logToDelete: WorkoutLog) => {
    if (!user || !logToDelete.id) {
      setError("Не вдалося видалити лог: користувач не знайдений або ID логу відсутній.");
      return;
    }

    if (window.confirm("Ви впевнені, що хочете видалити цей запис тренування? Цю дію не можна буде скасувати.")) {
      try {
        const logRef = doc(db, 'workoutLogs', logToDelete.id);
        await deleteDoc(logRef);
        setWorkoutLogs(prevLogs => prevLogs.filter(log => log.id !== logToDelete.id));
      } catch (error) {
        console.error("Error deleting workout log: ", error);
        setError("Помилка при видаленні логу тренування.");
      }
    }
  };

  // Обробка перевірки самопочуття
  const handleWellnessCheckSubmit = useCallback(async (wellnessCheck: WellnessCheck) => {
    if (!userProfile || !currentWorkoutPlan || pendingWorkoutDay === null) {
      setError('Не вдалося знайти профіль користувача, план тренувань або день.');
      setWellnessCheckModalOpen(false);
      return;
    }


    setWellnessCheckModalOpen(false);
    setIsLoading(true);

    try {
      // Оновлюємо профіль з обмеженнями здоров'я (пам'ять травм) при наявності нотаток
      if (userProfile && wellnessCheck.notes) {
        const newConstraints = extractConstraintsFromNotes(wellnessCheck.notes);
        if (newConstraints.length > 0) {
          const merged = Array.from(new Set([...(userProfile.healthConstraints || []), ...newConstraints]));
          const updatedProfile = { ...userProfile, healthConstraints: merged };
          await saveProfile(updatedProfile);
          setUserProfile(updatedProfile);
        }
      }

      // Генеруємо адаптивний план тренування
      const adaptivePlan = await generateAdaptiveWorkout(
        userProfile!,
        currentWorkoutPlan.find(d => d.day === pendingWorkoutDay) || currentWorkoutPlan[0],
        wellnessCheck,
        workoutLogs
      );
      setAdaptiveWorkoutPlan(adaptivePlan);

      // Генеруємо рекомендації по самопочуттю НЕБЛОКУЮЧЕ (у фоні)
      (async () => {
        try {
          const recs = await generateWellnessRecommendations(
            userProfile,
            wellnessCheck,
            workoutLogs
          );
          setWellnessRecommendations(recs);
          setWellnessRecommendationsModalOpen(true);
          await updateWellnessRecommendations(recs);
        } catch (e) {
          console.error('Помилка генерації рекомендацій самопочуття (фон):', e);
        }
      })();

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
      // Оновлення wellnessRecommendations відбудеться після фонового отримання
      
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
              workoutPlan={adaptiveWorkoutPlan ? [adaptiveWorkoutPlan] : (currentWorkoutPlan || null)}
              onStartWorkout={handleStartWorkoutWithWellnessCheck}
              onLogExercise={handleLogSingleExercise}
              onSkipExercise={handleSkipExercise}
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
              adaptiveWorkoutPlan={session.adaptiveWorkoutPlan ? {
                ...session.adaptiveWorkoutPlan,
                adaptations: session.adaptiveWorkoutPlan.adaptations || []
              } : null}
              onAddExerciseClick={() => setIsAddExerciseOpen(true)}
            />
          </div>
        );
      case 'progress':
        return (
          <div className="container mx-auto px-4 py-8">
            <ProgressView
              workoutLogs={workoutLogs}
              userProfile={userProfile}
              onAnalyzeWorkout={handleAnalyzeWorkoutFromLog}
              onDeleteLog={handleDeleteLog}
              isAnalyzing={isAnalyzing}
              analyzingLogId={analyzingLogId}
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
          {(userProfile || isLoading || session.activeDay !== null) &&  // Показуємо навігацію якщо є профіль, завантаження або активне тренування
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
        {/* Плаваюча кнопка чату (видима на всіх вкладках крім профілю) */}
        {currentView !== 'profile' && (
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsTrainerChatOpen(false)}
            />
            {/* Chat container */}
            <div className="relative w-full max-w-md sm:max-w-lg h-[80vh] sm:h-[70vh] bg-gray-900 border border-purple-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex justify-between items-center p-3 sm:p-4 border-b border-purple-700 bg-purple-900/80 rounded-t-xl">
                <span className="text-lg font-semibold text-purple-200"><i className="fas fa-robot mr-2"></i>Чат з тренером</span>
                <button onClick={() => setIsTrainerChatOpen(false)} className="text-gray-400 hover:text-white text-xl transition-colors" aria-label="Закрити чат">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <TrainerChat
                  userProfile={userProfile!}
                  lastWorkoutLog={workoutLogs && workoutLogs.length > 0 ? workoutLogs[0] : null}
                  previousWorkoutLogs={workoutLogs && workoutLogs.length > 1 ? workoutLogs.slice(1) : []}
                />
              </div>
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

      <WorkoutCompleteModal
        isOpen={isWorkoutCompleteModalOpen}
        onClose={() => {
          setIsWorkoutCompleteModalOpen(false);
          setCurrentView('progress');
        }}
      />

      <AddExerciseModal
        isOpen={isAddExerciseOpen}
        onClose={() => setIsAddExerciseOpen(false)}
        onAdd={async (exercise) => {
          await addCustomExercise(exercise);
          setIsAddExerciseOpen(false);
          // Запитати користувача: чи зберегти вправу до плану дня на майбутнє
          if (currentWorkoutPlan && session.activeDay !== null) {
            const shouldPersist = window.confirm('Зберегти цю вправу до плану на цей день для майбутніх тренувань?');
            if (shouldPersist) {
              const newPlan = currentWorkoutPlan.map((day) => {
                if (day.day !== session.activeDay) return day;
                // Уникаємо дублювання за назвою
                const exists = day.exercises.some((ex) => ex.name === exercise.name);
                return exists ? day : { ...day, exercises: [...day.exercises, exercise] };
              });
              setCurrentWorkoutPlan(newPlan);
              await saveWorkoutPlan(newPlan);
            }
          }
        }}
      />
    </div>
  );
};

export default App;