import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, DailyWorkoutPlan, WorkoutLog, LoggedExercise, LoggedSetWithAchieved, ExerciseRecommendation, Exercise } from './types';
import { UI_TEXT, GEMINI_MODEL_TEXT, formatTime } from './constants';
import Navbar from './components/Navbar';
import UserProfileForm from './components/UserProfileForm';
import WorkoutDisplay from './components/WorkoutDisplay';
import ProgressView from './components/ProgressView';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import TrainerChat from './components/TrainerChat';
import QuotaStatus from './components/QuotaStatus';
import OfflineIndicator from './components/OfflineIndicator';
import { generateWorkoutPlan as apiGenerateWorkoutPlan, generateWellnessRecommendations } from './services/geminiService';
import { generateNewAdaptiveWorkout } from './services/newAdaptiveWorkout';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { useUserData } from './hooks/useUserData';
import { deleteUser } from 'firebase/auth';
import { db } from './config/firebase';
import { collection, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { analyzeWorkout, getExerciseVariations, analyzeProgressTrends } from './services/workoutAnalysisService';
import { addBaseRecommendations, validateWorkoutSafety } from './services/injuryValidationService';
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
  const { session, startWorkout, updateExercise, addCustomExercise, endWorkout, updateTimer, updateWellnessCheck, updateAdaptiveWorkoutPlan, updateWellnessRecommendations, updateExerciseOrder } = useWorkoutSync(user?.uid || '');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('workout');
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [exerciseRecommendations, setExerciseRecommendations] = useState<ExerciseRecommendation[]>([]);
  const [exerciseVariations, setExerciseVariations] = useState<Map<string, Exercise[]>>(new Map());
  const [progressTrends, setProgressTrends] = useState<{
    overallProgress: 'improving' | 'plateau' | 'declining';
    strengthProgress: number;
    enduranceProgress: number;
    consistencyScore: number;
  } | null>(null);
  const [wellnessCheckModalOpen, setWellnessCheckModalOpen] = useState<boolean>(false);
  
  // Debug wellness modal state changes
  useEffect(() => {
  }, [wellnessCheckModalOpen]);
  const [wellnessRecommendationsModalOpen, setWellnessRecommendationsModalOpen] = useState<boolean>(false);
  const [wellnessRecommendations, setWellnessRecommendations] = useState<WellnessRecommendation[]>([]);
  const [adaptiveWorkoutPlan, setAdaptiveWorkoutPlan] = useState<AdaptiveWorkoutPlan | null>(null);
  const [pendingWorkoutDay, setPendingWorkoutDay] = useState<number | null>(null);
  const [isTrainerChatOpen, setIsTrainerChatOpen] = useState(false);
  const [hasInitializedView, setHasInitializedView] = useState(false);
  const [isWorkoutCompleteModalOpen, setIsWorkoutCompleteModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingLogId, setAnalyzingLogId] = useState<string | null>(null);
  const [isProcessingWellness, setIsProcessingWellness] = useState(false);
  const [wellnessProcessingStep, setWellnessProcessingStep] = useState<string>('');
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
    if (typeof (import.meta as any).env === 'undefined' || !(import.meta as any).env.VITE_API_KEY) {
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

  // Оновлення профілю БЕЗ генерації плану (тільки збереження)
  const handleProfileUpdate = useCallback(async (profile: UserProfile) => {
    console.log('🔵 [App.handleProfileUpdate] Оновлення профілю (тільки збереження):', profile.healthProfile?.conditions?.length || 0, 'умов');
    
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
      console.log('🔄 [App.handleProfileUpdate] Зберігаємо профіль');
      await saveProfile(profileToSave);
      console.log('✅ [App.handleProfileUpdate] Профіль успішно збережено');
    } catch (e: any) {
      console.error("❌ [App.handleProfileUpdate] Помилка при оновленні профілю:", e);
      setError(e.message || 'Помилка при оновленні профілю');
    } finally {
      setIsLoading(false);
    }
  }, [apiKeyMissing, saveProfile]);

  // Адаптація існуючого плану під проблеми здоров'я
  const handleAdaptExistingPlan = useCallback(async (profile: UserProfile) => {
    console.log('🔄 [App.handleAdaptExistingPlan] Адаптація існуючого плану під проблеми здоров\'я:', profile.healthProfile?.conditions?.length || 0, 'умов');
    
    if (apiKeyMissing) {
      setError(UI_TEXT.apiKeyMissing);
      return;
    }
    
    if (!currentWorkoutPlan || currentWorkoutPlan.length === 0) {
      setError("Немає існуючого плану для адаптації. Спочатку створіть план тренувань.");
      return;
    }
    
    // Перевіряємо чи є активне тренування
    if (session.activeDay !== null) {
      if(!confirm("У вас є активне тренування. Адаптація плану завершить його без збереження. Продовжити?")) return;
      endWorkout(); // Завершуємо активну сесію Firebase
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const profileToSave: UserProfile = {
        ...profile,
        targetMuscleGroups: profile.targetMuscleGroups || [],
      };
      
      // Оновлюємо статус адаптації плану
      const activeConditions = profileToSave.healthProfile?.conditions?.filter(c => c.isActive) || [];
      const updatedProfileWithStatus = {
        ...profileToSave,
        healthProfile: {
          ...profileToSave.healthProfile,
          conditions: profileToSave.healthProfile?.conditions || [],
          currentLimitations: profileToSave.healthProfile?.currentLimitations || [],
          recoveryProgress: profileToSave.healthProfile?.recoveryProgress || {},
          systemMemory: profileToSave.healthProfile?.systemMemory || { rememberedFacts: [], adaptationHistory: [] },
          planAdaptationStatus: {
            lastAdaptedDate: new Date(),
            adaptedConditions: activeConditions.map(c => c.condition),
            needsReAdaptation: false
          }
        }
      };
      
      // Спочатку зберігаємо оновлений профіль зі статусом адаптації
      console.log('🔄 [App.handleAdaptExistingPlan] Зберігаємо оновлений профіль зі статусом адаптації');
      await saveProfile(updatedProfileWithStatus);
      
      // Потім генеруємо новий план з урахуванням проблем здоров'я
      console.log('🏋️ [App.handleAdaptExistingPlan] Генеруємо адаптований план');
      const adaptedPlan = await apiGenerateWorkoutPlan(updatedProfileWithStatus, GEMINI_MODEL_TEXT);
      await saveWorkoutPlan(adaptedPlan);
      
      console.log('✅ [App.handleAdaptExistingPlan] План успішно адаптовано');
      setCurrentView('workout'); // Переходимо до плану тренувань
    } catch (e: any) {
      console.error("❌ [App.handleAdaptExistingPlan] Помилка при адаптації плану:", e);
      setError(e.message || 'Помилка при адаптації плану');
    } finally {
      setIsLoading(false);
    }
  }, [apiKeyMissing, saveProfile, saveWorkoutPlan, currentWorkoutPlan, session.activeDay, endWorkout]);

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

  const handleUndoSkipExercise = useCallback((exerciseIndex: number) => {
    updateExercise(exerciseIndex, [], false, false); // Скасовуємо пропуск, isSkipped = false
  }, [updateExercise]);
  
  const handleEndWorkout = useCallback(async () => {
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
      setAdaptiveWorkoutPlan(null); // Очищаємо адаптивний план
      alert("Тренування завершено, але жодної вправи не було залоговано.");
      return;
    }

    endWorkout();
    setAdaptiveWorkoutPlan(null); // Очищаємо адаптивний план
    setWellnessRecommendations([]);
    setWellnessRecommendationsModalOpen(false);
    
    // Створюємо ОБ'ЄКТ логу, але без ID
    let workoutLog: WorkoutLog = {
      userId: user.uid,
      date: new Date(),
      duration: Math.floor((Date.now() - session.startTime) / 1000),
      dayCompleted: session.activeDay,
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
      const savedLog = await saveWorkoutLog(workoutLog);
      setWorkoutLogs(prev => [savedLog, ...prev]);

      const analysisResult = await analyzeWorkout(
        userProfile,
        currentWorkoutPlan.find(p => p.day === session.activeDay)!,
        savedLog,
        workoutLogs
      );
      
      if (analysisResult.recommendation) {
        const finalLog = { ...savedLog, recommendation: analysisResult.recommendation };
        const updatedLog = await saveWorkoutLog(finalLog);
        setWorkoutLogs(prev => prev.map(l => (l.id === updatedLog.id ? updatedLog : l)));
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
      
      // Примусово завантажуємо повний план тренувань з Firestore
      const fullPlan = await saveWorkoutPlan(null, true); // `true` для примусового завантаження
      if (fullPlan) {
        setCurrentWorkoutPlan(fullPlan);
      }
      
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

  // Handler for reordering exercises during active workout
  const handleReorderExercises = useCallback((newExercises: Exercise[]) => {
    if (session.activeDay !== null) {
      // Update session exercises order immediately for UI responsiveness
      updateExerciseOrder(newExercises);
    }
  }, [session.activeDay, updateExerciseOrder]);

  // Handler for saving exercise order permanently
  const handleSaveExerciseOrder = useCallback(async (dayNumber: number, exercises: Exercise[]) => {
    if (!currentWorkoutPlan) return;
    
    try {
      const updatedPlan = currentWorkoutPlan.map(dayPlan => 
        dayPlan.day === dayNumber 
          ? { ...dayPlan, exercises }
          : dayPlan
      );
      
      await saveWorkoutPlan(updatedPlan);
      setCurrentWorkoutPlan(updatedPlan);
    } catch (error) {
      console.error('Error saving exercise order:', error);
      setError('Не вдалося зберегти новий порядок вправ');
    }
  }, [currentWorkoutPlan, saveWorkoutPlan]);

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

      const analysisResult = await analyzeWorkout(
        userProfile,
        currentDayPlan,
        logToAnalyze,
        workoutLogs.filter(log => log.id !== logToAnalyze.id)
      );
      
      // Update the workout log with the analysis result
      if (analysisResult.recommendation) {
        const updatedLog = { ...logToAnalyze, recommendation: analysisResult.recommendation };
        const savedLog = await saveWorkoutLog(updatedLog);
        setWorkoutLogs(prev => prev.map(l => (l.id === savedLog.id ? savedLog : l)));
      }
      
      // Also update the exercise recommendations in the UI
      setExerciseRecommendations(analysisResult.dailyRecommendations || []);
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
    setIsProcessingWellness(true);
    setWellnessProcessingStep('Аналізуємо ваше самопочуття...');

    try {
      // Оновлюємо профіль з обмеженнями здоров'я (пам'ять травм) при наявності нотаток
      if (userProfile && wellnessCheck.notes) {
        setWellnessProcessingStep('Оновлюємо профіль здоров\'я...');
        const newConstraints = extractConstraintsFromNotes(wellnessCheck.notes);
        if (newConstraints.length > 0) {
          const merged = Array.from(new Set([...(userProfile.healthConstraints || []), ...newConstraints]));
          const updatedProfile = { ...userProfile, healthConstraints: merged };
          await saveProfile(updatedProfile);
          setUserProfile(updatedProfile);
        }
      }
      // Генеруємо адаптивний план тренування
      setWellnessProcessingStep('Адаптуємо план тренування...');
      const adaptiveWorkout = await generateNewAdaptiveWorkout(
        userProfile!,
        currentWorkoutPlan.find(d => d.day === pendingWorkoutDay) || currentWorkoutPlan[0],
        wellnessCheck,
        workoutLogs
      );
      
      if (!adaptiveWorkout) {
        throw new Error('Не вдалося згенерувати адаптивний план');
      }
      
      setAdaptiveWorkoutPlan(adaptiveWorkout);

      // Generate wellness recommendations in background (OPTIONAL - skip if quota issues)
      setWellnessProcessingStep('Готуємо рекомендації...');
      (async () => {
        try {
          // Check quota before making another API call
          const { quotaManager } = await import('./utils/apiQuotaManager');
          
          if (!quotaManager.canMakeRequest()) {
            console.warn('⚠️ [APP] Skipping wellness recommendations due to quota limits');
            setWellnessRecommendations([]);
            return;
          }
          
          const recs = await generateWellnessRecommendations(
            userProfile,
            wellnessCheck,
            workoutLogs
          );
          setWellnessRecommendations(recs);
          
          // Show modal only if there are recommendations
          if (recs.length > 0) {
            setWellnessRecommendationsModalOpen(true);
          }
          
          await updateWellnessRecommendations(recs);
        } catch (e: any) {
          console.error('❌ [APP] Помилка генерації рекомендацій самопочуття (фон):', e);
          if (e.message && e.message.includes('429')) {
            console.log('⚠️ [APP] Quota exceeded during wellness recommendations - continuing without them');
          }
          // Set empty array in case of error
          setWellnessRecommendations([]);
        }
      })();

      // Оновлюємо план тренувань з адаптивним планом
      setWellnessProcessingStep('Зберігаємо план...');
      const updatedPlan = currentWorkoutPlan.map(dayPlan => 
        dayPlan.day === adaptiveWorkout.day ? adaptiveWorkout : dayPlan
      );
      setCurrentWorkoutPlan(updatedPlan);
      await saveWorkoutPlan(updatedPlan);

      // АВТОМАТИЧНО СТАРТУЄМО ТРЕНУВАННЯ
      setWellnessProcessingStep('Запускаємо тренування...');
      await startWorkout(adaptiveWorkout.day, adaptiveWorkout.exercises);
      
      // ОНОВЛЮЄМО LIVE-СЕСІЮ з wellnessCheck, adaptiveWorkoutPlan та wellnessRecommendations
      await updateWellnessCheck(wellnessCheck);
      await updateAdaptiveWorkoutPlan(adaptiveWorkout);
      // Оновлення wellnessRecommendations відбудеться після фонового отримання
      
      setPendingWorkoutDay(null);
    } catch (error: any) {
      console.error('❌ [APP] Error in handleWellnessCheckSubmit:', error);
      
      // Handle different types of errors with specific messages
      if (error.message) {
        // Handle quota errors
        if (error.message.includes('ліміт запитів') || 
            error.message.includes('quota') || 
            error.message.includes('429') ||
            error.message.includes('rate limit')) {
          setError('Перевищено ліміт AI запитів. Спробуйте ще раз через 1-2 хвилини.');
        } 
        // Handle service unavailable errors
        else if (error.message.includes('service unavailable') || 
                 error.message.includes('503') || 
                 error.message.includes('overloaded')) {
          setError('Сервіс AI тимчасово недоступний. Спробуйте ще раз через кілька хвилин.');
        }
        // Handle API key errors
        else if (error.message.includes('API_KEY') || 
                 error.message.includes('API key') || 
                 error.message.includes('authentication')) {
          setError('Помилка API ключа. Перевірте налаштування API ключа.');
        }
        // Handle parsing errors
        else if (error.message.includes('JSON') || 
                 error.message.includes('parse') || 
                 error.message.includes('розпізнати')) {
          setError('Помилка обробки відповіді від AI. Спробуйте ще раз.');
        }
        // Handle general AI errors
        else if (error.message.includes('AI') || 
                 error.message.includes('адаптація') || 
                 error.message.includes('адаптивний')) {
          setError('Помилка AI адаптації: ' + error.message + '. Спробуйте ще раз через кілька секунд.');
        }
        // Handle all other errors
        else {
          setError('Помилка: ' + error.message + '. Спробуйте ще раз.');
        }
      } else {
        // Усі інші помилки - лише AI адаптація дозволена
        setError('Помилка AI адаптації: Невідома помилка. Повторіть через кілька секунд для отримання адаптивного плану.');
      }
      
      setPendingWorkoutDay(null);
    } finally {
      setIsLoading(false);
      setIsProcessingWellness(false);
      setWellnessProcessingStep('');
    }
  }, [userProfile, currentWorkoutPlan, workoutLogs, saveWorkoutPlan, pendingWorkoutDay, startWorkout, updateWellnessCheck, updateAdaptiveWorkoutPlan, updateWellnessRecommendations]);

  const handleWellnessCheckSkip = useCallback(async () => {
    if (pendingWorkoutDay === null || !currentWorkoutPlan) {
      setError('Не вдалося почати тренування. Спробуйте ще раз.');
      setWellnessCheckModalOpen(false);
      return;
    }

    const dayPlan = currentWorkoutPlan.find(d => d.day === pendingWorkoutDay);
    if (!dayPlan) {
      setError(`Не знайдено план для дня ${pendingWorkoutDay}.`);
      setWellnessCheckModalOpen(false);
      return;
    }

    setWellnessCheckModalOpen(false);
    setIsLoading(true);

    try {
      await startWorkout(dayPlan.day, dayPlan.exercises);
      setPendingWorkoutDay(null);
    } catch (error: any) {
      console.error('Error starting workout without wellness check:', error);
      setError('Помилка при запуску тренування: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [pendingWorkoutDay, currentWorkoutPlan, startWorkout]);

  const renderView = () => {
    if (!user) {
      return <AuthForm />;
    }

    if (isLoading) {
      return (
        <Spinner 
          message={isProcessingWellness ? "Обробляємо ваше самопочуття..." : "Завантаження..."}
          showTimer={isProcessingWellness}
          processingStep={wellnessProcessingStep}
        />
      );
    }

    switch (currentView) {
      case 'profile':
        return (
          <div className="container mx-auto px-4 py-8">
            <div className="space-y-6">
              <UserProfileForm
                existingProfile={userProfile}
                onSave={handleProfileSave}
                onUpdateProfile={handleProfileUpdate}
                onAdaptExistingPlan={handleAdaptExistingPlan}
                hasExistingPlan={!!(currentWorkoutPlan && currentWorkoutPlan.length > 0)}
                apiKeyMissing={apiKeyMissing}
                isLoading={isLoading}
                onLogout={logout}
                onDeleteAccount={handleDeleteAccount}
              />
              {user && (
                <div className="max-w-4xl mx-auto px-4">
                  <QuotaStatus 
                    className="" 
                    showDetailed={true}
                  />
                </div>
              )}
            </div>
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
              onUndoSkipExercise={handleUndoSkipExercise} // Додаємо новий пропс
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
              onAddExerciseClick={() => setIsAddExerciseOpen(true)}
              onReorderExercises={handleReorderExercises}
              onSaveExerciseOrder={handleSaveExerciseOrder}
            />
          </div>
        );
      case 'progress':
        return (
          <div className="container mx-auto px-4 py-8">
            <ProgressView
              workoutLogs={workoutLogs}
              onAnalyzeWorkout={handleAnalyzeWorkoutFromLog}
              onDeleteLog={handleDeleteLog}
              isAnalyzing={isAnalyzing}
              analyzingLogId={analyzingLogId}
              exerciseRecommendations={exerciseRecommendations}
              progressTrends={progressTrends}
              onGenerateNewPlan={handleGenerateNewPlan}
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
      <OfflineIndicator />
      <header className="bg-gray-800/70 backdrop-blur-md shadow-lg p-3 sm:p-4 sticky top-0 z-50">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center space-x-4 mb-2 sm:mb-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              <i className="fas fa-dumbbell mr-2"></i>{UI_TEXT.appName}
            </h1>
            {user && <QuotaStatus className="" />}
          </div>
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
        {/* Плаваюча кнопка чату (видима лише авторизованим користувачам на всіх вкладках крім профілю) */}
        {user && currentView !== 'profile' && (
          <button
            className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg p-4 flex items-center justify-center text-2xl transition-colors"
            style={{ boxShadow: '0 4px 24px rgba(80,0,120,0.25)' }}
            onClick={() => setIsTrainerChatOpen(true)}
            aria-label="Відкрити чат з тренером"
          >
            <i className="fas fa-comments"></i>
          </button>
        )}
        {/* Overlay чат з тренером (доступний лише авторизованим користувачам) */}
        {user && isTrainerChatOpen && (
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
                  currentWorkoutPlan={currentWorkoutPlan}
                  activeDay={session.activeDay}
                  onWorkoutPlanModified={async (modifiedPlan) => {
                    if (!currentWorkoutPlan) return;
                    
                    // Update the current workout plan
                    const updatedPlan = currentWorkoutPlan.map(day => 
                      day.day === modifiedPlan.day ? modifiedPlan : day
                    );
                    
                    setCurrentWorkoutPlan(updatedPlan);
                    await saveWorkoutPlan(updatedPlan);
                    
                    // If currently in an active workout, update session exercises
                    if (session.activeDay === modifiedPlan.day) {
                      updateExerciseOrder(modifiedPlan.exercises);
                    }
                  }}
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