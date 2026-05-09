import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import UpdateNotification from './components/UpdateNotification';
import SystemStatusBar from './components/SystemStatusBar';
import { saveOfflineData, getOfflineData, addToOfflineQueue, isOnline, syncOfflineQueue, getOfflineQueue, clearStaleOfflineData, checkLocalStorageHealth } from './utils/offlineUtils';
import { generateWorkoutPlan as apiGenerateWorkoutPlan, generateWellnessRecommendations } from './services/geminiService';
import { generateNewAdaptiveWorkout } from './services/newAdaptiveWorkout';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { useUserData } from './hooks/useUserData';
import { deleteUser } from 'firebase/auth';
import { db } from './config/firebase';
import { collection, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { getExerciseVariations, analyzeProgressTrends } from './services/workoutAnalysisService';
import { addBaseRecommendations, validateWorkoutSafety } from './services/injuryValidationService';
import { backgroundAnalysisService } from './services/backgroundWorkoutAnalysis';
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
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const { session, startWorkout, updateExercise, addCustomExercise, endWorkout, updateTimer, updateWellnessCheck, updateAdaptiveWorkoutPlan, updateWellnessRecommendations, updateExerciseOrder, updateExerciseRecommendations } = useWorkoutSync(user?.uid || '', workoutLogs);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentWorkoutPlan, setCurrentWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
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
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
  const [isWorkoutCompleteModalOpen, setIsWorkoutCompleteModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingLogId, setAnalyzingLogId] = useState<string | null>(null);
  const [isProcessingWellness, setIsProcessingWellness] = useState(false);
  const [wellnessProcessingStep, setWellnessProcessingStep] = useState<string>('');
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);

  // Ref для відстеження чи вже виконана синхронізація при запуску
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    // Завжди синхронізуємо exerciseRecommendations з session.exerciseRecommendations
    // Це гарантує, що рекомендації з аналізу завжди використовуються, навіть після перезавантаження
    if (session.exerciseRecommendations) {
      setExerciseRecommendations(session.exerciseRecommendations);
      return;
    }

    if (session.activeDay !== null) {
      const restored = backgroundAnalysisService.getRecommendationsForDay(workoutLogs, session.activeDay);
      if (restored.length > 0) {
        setExerciseRecommendations(restored);
        updateExerciseRecommendations(restored);
        return;
      }
    }

    if ((session.exerciseRecommendations?.length ?? 0) === 0) {
      setExerciseRecommendations([]);
    }
  }, [session.exerciseRecommendations, session.activeDay, workoutLogs, updateExerciseRecommendations]);

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
    
    // Очищуємо застарілі дані та перевіряємо здоров'я localStorage при запуску
    clearStaleOfflineData();
    if (!checkLocalStorageHealth()) {
      console.warn('⚠️ localStorage може мати проблеми - рекомендується очистити кеш браузера');
    }
  }, []);

  // Скидаємо стан ініціалізації при виході користувача
  useEffect(() => {
    if (!user) {
      setHasInitializedView(false);
      hasSyncedRef.current = false; // Скидаємо синхронізацію при виході
    }
  }, [user]);

  useEffect(() => {
    if (workoutPlan) {
      setCurrentWorkoutPlan(workoutPlan);
    } else {
      setCurrentWorkoutPlan(null);
    }
  }, [workoutPlan]);

  // Розумна синхронізація: Firebase має пріоритет, localStorage тільки для офлайн
  useEffect(() => {
    if (user) {
      // Онлайн режим: Firebase має пріоритет
      if (isOnline()) {
        // Оновлюємо UI тільки якщо дані з Firebase відрізняються
        if (JSON.stringify(firestoreProfile) !== JSON.stringify(userProfile)) {
          console.log('🔄 Оновлюємо профіль з Firebase');
          setUserProfile(firestoreProfile);
        }
        
        if (JSON.stringify(firestoreWorkoutLogs) !== JSON.stringify(workoutLogs)) {
          console.log('🔄 Оновлюємо логи з Firebase');
          setWorkoutLogs(firestoreWorkoutLogs);
        }
        
        // Зберігаємо в localStorage тільки якщо є нові дані
        if (firestoreProfile || firestoreWorkoutLogs.length > 0) {
          saveOfflineData({
            userProfile: firestoreProfile,
            workoutLogs: firestoreWorkoutLogs,
            workoutPlan: currentWorkoutPlan || []
          });
        }
      }
      // Офлайн режим: використовуємо localStorage тільки якщо немає даних в стані
      else if (!userProfile && !workoutLogs.length) {
        const offlineData = getOfflineData();
        if (offlineData.userProfile || offlineData.workoutLogs.length > 0) {
          console.log('📵 Завантажуємо дані з офлайн кешу (тільки якщо немає поточних)');
          setUserProfile(offlineData.userProfile);
          setWorkoutLogs(offlineData.workoutLogs);
          if (offlineData.workoutPlan && offlineData.workoutPlan.length > 0) {
            setCurrentWorkoutPlan(offlineData.workoutPlan);
          }
        }
      }
    }
  }, [user, firestoreProfile, firestoreWorkoutLogs, currentWorkoutPlan]);

  // Функція синхронізації офлайн даних (використовується при запуску та відновленні мережі)
  const syncOfflineData = useCallback(async () => {
    if (!user || !userProfile || !currentWorkoutPlan) return;
    if (!isOnline()) return;

    const queue = getOfflineQueue();
    if (queue.length > 0) {
      console.log(`🔄 Синхронізуємо ${queue.length} офлайн дій`);
      
      try {
        await syncOfflineQueue({
          saveWorkoutLog: async (data) => {
            const savedLog = await saveWorkoutLog(data);
            setWorkoutLogs(prev => prev.map(log => {
              if (log.id?.startsWith('offline_')) {
                // Порівнюємо дати (враховуючи різні формати)
                const logDate = log.date instanceof Date ? log.date : new Date((log.date as any).seconds * 1000);
                const dataDate = data.date instanceof Date ? data.date : new Date((data.date as any).seconds * 1000);
                return logDate.getTime() === dataDate.getTime() ? savedLog : log;
              }
              return log;
            }));
          },
          saveProfile: async (data) => {
            await saveProfile(data);
          },
          saveWorkoutPlan: async (data) => {
            await saveWorkoutPlan(data);
          }
        });
        
        console.log('✅ Офлайн синхронізація завершена успішно');
      } catch (error) {
        console.error('❌ Помилка синхронізації офлайн даних:', error);
        // Не очищуємо чергу при помилці - спробуємо пізніше
      }
    }

    // Повторюємо невдалі аналізи
    console.log('🔄 Перевіряємо невдалі аналізи для повторення');
    try {
      await backgroundAnalysisService.retryFailedAnalyses(
        workoutLogs,
        userProfile,
        currentWorkoutPlan,
        saveWorkoutLog
      );
      console.log('✅ Повторення невдалих аналізів завершено');
    } catch (error) {
      console.error('❌ Помилка повторення аналізів:', error);
    }
  }, [user, userProfile, currentWorkoutPlan, workoutLogs, saveWorkoutLog, saveProfile, saveWorkoutPlan]);

  // Синхронізація при запуску додатку (якщо є мережа)
  useEffect(() => {
    if (user && userProfile && currentWorkoutPlan && isOnline() && !hasSyncedRef.current) {
      console.log('🚀 Додаток запущено - перевіряємо офлайн чергу');
      hasSyncedRef.current = true;
      // Невелика затримка щоб Firebase встиг ініціалізуватися
      const timer = setTimeout(() => {
        syncOfflineData();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, currentWorkoutPlan, syncOfflineData]);

  // Синхронізація при відновленні мережі
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🌐 Мережа відновлена - запускаємо синхронізацію');
      await syncOfflineData();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncOfflineData]);

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

  // Відстеження стану мережі
  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Розумне авто-оновлення Service Worker: автоматично аплайтиме оновлення
  // якщо немає активної сесії (session.activeDay === null). Інакше — показує банер.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let mounted = true;

    navigator.serviceWorker.ready.then((registration) => {
      if (!mounted) return;

      const tryApplyUpdate = async () => {
        try {
          // Якщо є waiting worker та немає активного тренування — застосовуємо оновлення
          if (registration.waiting && session.activeDay === null) {
            console.log('🔄 [SW] Auto-applying update (no active session)');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            // Невелика затримка, щоб воркер встиг перейти в активний стан
            setTimeout(() => window.location.reload(), 300);
          }
        } catch (e) {
          console.warn('⚠️ [SW] Не вдалося автоматично застосувати оновлення:', e);
        }
      };

      // Якщо вже є waiting worker (встановлено раніше), спробуємо застосувати відразу
      tryApplyUpdate();

      const onUpdateFound = () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Якщо немає активної сесії — аплайтимо одразу, інакше дамо банеру показатись
            if (session.activeDay === null) {
              tryApplyUpdate();
            } else {
              console.log('🔔 [SW] Оновлення доступне, але є активна сесія — показано банер');
              // Banner logic is handled by existing UpdateNotification component
            }
          }
        });
      };

      registration.addEventListener('updatefound', onUpdateFound);

      return () => {
        mounted = false;
        try {
          registration.removeEventListener('updatefound', onUpdateFound);
        } catch {}
      };
    }).catch((err) => {
      console.warn('⚠️ [SW] Помилка при доступі до service worker ready:', err);
    });
  }, [session.activeDay]);

  // Функція для оновлення додатку
  const handleAppUpdate = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        // Повідомляємо Service Worker про готовність до оновлення
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        
        // Перезавантажуємо сторінку для застосування оновлення
        window.location.reload();
      });
    }
  }, []);

  // Firebase таймер: тільки онлайн для синхронізації між пристроями
  useEffect(() => {
    let timerInterval: number | null = null;
    
    if (user && session.startTime && session.activeDay !== null && navigator.onLine) {
      const startTime = session.startTime;
      timerInterval = window.setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime = Math.floor((currentTime - startTime) / 1000);
        updateTimer(elapsedTime);
      }, 1000);
    }
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [user, session.startTime, session.activeDay, updateTimer]);

  // Аналізуємо прогрес при зміні логів тренувань
  useEffect(() => {
    if (workoutLogs && workoutLogs.length > 0) {
      const trends = analyzeProgressTrends(workoutLogs);
      setProgressTrends(trends);
    }
  }, [workoutLogs]);



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

  // Функція для застосування рекомендацій ШІ до плану тренування
  const applyAIRecommendationsToPlan = useCallback((
    exercises: Exercise[],
    recommendations: ExerciseRecommendation[]
  ): Exercise[] => {
    if (recommendations.length === 0) {
      return exercises;
    }

    // Створюємо мапу рекомендацій для швидкого пошуку
    const recommendationsMap = new Map<string, ExerciseRecommendation>();
    recommendations.forEach(rec => {
      recommendationsMap.set(rec.exerciseName.toLowerCase(), rec);
    });

    // Оновлюємо вправи з рекомендаціями
    return exercises.map(exercise => {
      const recommendation = recommendationsMap.get(exercise.name.toLowerCase());
      
      if (recommendation && recommendation.suggestedWeight !== undefined && recommendation.suggestedWeight !== null) {
        console.log(`🎯 [applyAIRecommendations] Оновлюємо ${exercise.name}: targetWeight ${exercise.targetWeight} → ${recommendation.suggestedWeight}кг`);
        return {
          ...exercise,
          targetWeight: recommendation.suggestedWeight
        };
      }
      
      return exercise;
    });
  }, []);

  const handleStartWorkoutWithWellnessCheck = useCallback(async (dayNumber: number) => {
    // Завантажуємо рекомендації для цього дня з попередніх аналізів
    console.log('🔍 [handleStartWorkout] Завантажуємо рекомендації для дня', dayNumber);
    const dayRecommendations = backgroundAnalysisService.getRecommendationsForDay(workoutLogs, dayNumber);
    
    if (dayRecommendations.length > 0) {
      console.log('✅ [handleStartWorkout] Знайдено рекомендації:', dayRecommendations.length);
      setExerciseRecommendations(dayRecommendations);
      updateExerciseRecommendations(dayRecommendations);
    } else {
      console.log('ℹ️ [handleStartWorkout] Рекомендації для дня не знайдено');
      setExerciseRecommendations([]);
      updateExerciseRecommendations([]);
    }
    
    setPendingWorkoutDay(dayNumber);
    setWellnessCheckModalOpen(true);
  }, [workoutLogs]);

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
      // Якщо онлайн - зберігаємо в Firebase та запускаємо фоновий аналіз
      if (isOnline()) {
        const savedLog = await saveWorkoutLog(workoutLog);
        setWorkoutLogs(prev => [savedLog, ...prev]);

        console.log('🔄 [handleEndWorkout] Запускаємо фоновий аналіз тренування');
        
        // Запускаємо фоновий аналіз (не блокує UI)
        backgroundAnalysisService.queueWorkoutForAnalysis(
          savedLog,
          userProfile,
          currentWorkoutPlan.find(p => p.day === session.activeDay)!,
          workoutLogs,
          saveWorkoutLog
        ).catch(error => {
          console.error('❌ [handleEndWorkout] Помилка фонового аналізу:', error);
        });

        // НЕ очищуємо рекомендації - залишаємо поточні до отримання нових з аналізу
      } 
      // Якщо офлайн - зберігаємо локально і додаємо в чергу синхронізації
      else {
        console.log('📵 Офлайн режим - зберігаємо тренування локально');
        
        // Створюємо тимчасовий ID для офлайн логу
        const offlineLog = {
          ...workoutLog,
          id: `offline_${Date.now()}`,
          isOffline: true,
          analysisStatus: 'pending' as const // Позначаємо що потрібен аналіз
        };
        
        // Додаємо до локального стану
        setWorkoutLogs(prev => [offlineLog, ...prev]);
        
        // Зберігаємо в офлайн чергу для синхронізації
        addToOfflineQueue({
          type: 'save_workout_log',
          data: workoutLog,
          timestamp: Date.now()
        });
        
        // Оновлюємо офлайн дані
        const offlineData = getOfflineData();
        saveOfflineData({
          ...offlineData,
          workoutLogs: [offlineLog, ...offlineData.workoutLogs]
        });
      }
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

  // Фонове завантаження варіацій вправ при старті тренування
  const loadExerciseVariations = useCallback(async (dayExercises: Exercise[]) => {
    if (!userProfile || workoutLogs.length < 3) return;

    console.log('🔄 [APP] Loading exercise variations for', dayExercises.length, 'exercises');
    
    // Очищаємо попередні варіації
    setExerciseVariations(new Map());

    // Перевіряємо кожну вправу на необхідність варіації (в фоні, без блокування)
    for (const exercise of dayExercises) {
      try {
        const variations = await getExerciseVariations(
          userProfile,
          exercise,
          workoutLogs,
          exercise.name
        );
        
        if (variations.length > 0) {
          console.log(`✅ [APP] Got ${variations.length} variations for "${exercise.name}"`);
          setExerciseVariations(prev => {
            const newMap = new Map(prev);
            newMap.set(exercise.name, variations);
            return newMap;
          });
        }
      } catch (error) {
        console.warn(`⚠️ [APP] Failed to load variations for "${exercise.name}":`, error);
      }
    }
  }, [userProfile, workoutLogs]);

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

  // Обробник для зміни порядку вправ під час активного тренування
  const handleReorderExercises = useCallback((newExercises: Exercise[]) => {
    if (session.activeDay !== null) {
      // Update session exercises order immediately for UI responsiveness
      updateExerciseOrder(newExercises);
    }
  }, [session.activeDay, updateExerciseOrder]);

  // Обробник для постійного збереження порядку вправ
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
    
    console.log('🔄 [handleAnalyzeWorkoutFromLog] Запускаємо переаналіз тренування:', logToAnalyze.id);
    
    try {
      const currentDayPlan = currentWorkoutPlan.find(p => p.day === logToAnalyze.dayCompleted);
      if (!currentDayPlan) {
        setError('Не вдалося знайти план тренування для аналізу');
        return;
      }

      // Використовуємо той самий фоновий аналіз, що і після завершення тренування
      console.log('🧠 [handleAnalyzeWorkoutFromLog] Запускаємо фоновий аналіз (як після завершення тренування)');
      
      await backgroundAnalysisService.queueWorkoutForAnalysis(
        logToAnalyze,
        userProfile,
        currentDayPlan,
        workoutLogs.filter(log => log.id !== logToAnalyze.id),
        saveWorkoutLog
      );

      console.log('✅ [handleAnalyzeWorkoutFromLog] Фоновий аналіз запущено успішно');
      
      // Очищуємо стан аналізу одразу після запуску (фоновий процес)
      setIsAnalyzing(false);
      setAnalyzingLogId(null);
      
    } catch (error) {
      console.error("Помилка при повторному аналізі:", error);
      setError("Не вдалося проаналізувати тренування. Спробуйте ще раз.");
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
      
  let adaptiveWorkout: AdaptiveWorkoutPlan | null = null;
      
      // Перевіряємо чи є мережа для AI генерації
      if (isOnline()) {
        try {
          adaptiveWorkout = await generateNewAdaptiveWorkout(
            userProfile!,
            currentWorkoutPlan.find(d => d.day === pendingWorkoutDay) || currentWorkoutPlan[0],
            wellnessCheck,
            workoutLogs
          );
        } catch (error) {
          console.warn('⚠️ [APP] AI generation failed, using offline fallback:', error);
          adaptiveWorkout = null;
        }
      }
      
      // Офлайн fallback - використовуємо оригінальний план
      if (!adaptiveWorkout) {
        console.log('📵 [APP] Using offline fallback - original workout plan');
        const originalDay = currentWorkoutPlan.find(d => d.day === pendingWorkoutDay) || currentWorkoutPlan[0];
        adaptiveWorkout = {
          ...originalDay,
          originalPlan: originalDay, // Додаємо обов'язкове поле
          exercises: originalDay.exercises.map(ex => ({
            ...ex,
            notes: wellnessCheck.notes ? `Самопочуття: ${wellnessCheck.notes}` : ex.notes
          }))
        };
      }
      
      setAdaptiveWorkoutPlan(adaptiveWorkout);

      // Generate wellness recommendations in background (OPTIONAL - skip if quota issues or offline)
      setWellnessProcessingStep('Готуємо рекомендації...');
      (async () => {
        try {
          // Skip if offline
          if (!isOnline()) {
            console.log('📵 [APP] Skipping wellness recommendations - offline mode');
            setWellnessRecommendations([]);
            return;
          }
          
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

      // Застосовуємо рекомендації ШІ до адаптивного плану перед стартом
      const recommendations = exerciseRecommendations.length > 0 
        ? exerciseRecommendations 
        : backgroundAnalysisService.getRecommendationsForDay(workoutLogs, adaptiveWorkout.day);
      
      if (recommendations.length > 0) {
        console.log('🎯 [handleWellnessCheckSubmit] Застосовуємо рекомендації ШІ до плану');
        adaptiveWorkout = {
          ...adaptiveWorkout,
          exercises: applyAIRecommendationsToPlan(adaptiveWorkout.exercises, recommendations)
        };
      }

      // Оновлюємо план тренувань з адаптивним планом
      setWellnessProcessingStep('Зберігаємо план...');
      const updatedPlan = currentWorkoutPlan.map(dayPlan => 
        dayPlan.day === adaptiveWorkout!.day ? adaptiveWorkout! : dayPlan
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
      
      // Фонове завантаження варіацій вправ (не блокує UI)
      loadExerciseVariations(adaptiveWorkout.exercises).catch(err => 
        console.warn('⚠️ [APP] Background variation loading failed:', err)
      );
      
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
  }, [userProfile, currentWorkoutPlan, workoutLogs, saveWorkoutPlan, pendingWorkoutDay, startWorkout, updateWellnessCheck, updateAdaptiveWorkoutPlan, updateWellnessRecommendations, exerciseRecommendations, applyAIRecommendationsToPlan, loadExerciseVariations]);

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
      // Застосовуємо рекомендації ШІ до плану перед стартом
      const recommendations = exerciseRecommendations.length > 0 
        ? exerciseRecommendations 
        : backgroundAnalysisService.getRecommendationsForDay(workoutLogs, dayPlan.day);
      
      let exercisesToStart = dayPlan.exercises;
      if (recommendations.length > 0) {
        console.log('🎯 [handleWellnessCheckSkip] Застосовуємо рекомендації ШІ до плану');
        exercisesToStart = applyAIRecommendationsToPlan(dayPlan.exercises, recommendations);
        
        // Оновлюємо план в currentWorkoutPlan для збереження змін
        const updatedPlan = currentWorkoutPlan.map(plan => 
          plan.day === dayPlan.day 
            ? { ...plan, exercises: exercisesToStart }
            : plan
        );
        setCurrentWorkoutPlan(updatedPlan);
        await saveWorkoutPlan(updatedPlan);
      }
      
      await startWorkout(dayPlan.day, exercisesToStart);
      
      // Фонове завантаження варіацій вправ (не блокує UI)
      loadExerciseVariations(exercisesToStart).catch(err => 
        console.warn('⚠️ [APP] Background variation loading failed:', err)
      );
      setPendingWorkoutDay(null);
    } catch (error: any) {
      console.error('Error starting workout without wellness check:', error);
      setError('Помилка при запуску тренування: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [pendingWorkoutDay, currentWorkoutPlan, startWorkout, exerciseRecommendations, workoutLogs, applyAIRecommendationsToPlan, saveWorkoutPlan, loadExerciseVariations]);

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
    return <div className="flex items-center justify-center min-h-screen bg-black text-xl text-readable accent-glow">Завантаження автентифікації...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-black-glow">
      {/* Офлайн повідомлення */}
      {!isNetworkOnline && (
        <div className="bg-black text-white px-2 py-1 text-center text-sm">
          <div className="flex items-center justify-center space-x-2">
            <i className="fas fa-wifi-slash text-gold"></i>
            <span>Офлайн режим</span>
          </div>
        </div>
      )}
      
      <header className="header-animated p-3 sm:p-4 sticky top-0 z-50 border-b border-fitness-gold-600/30">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center space-x-4 mb-2 sm:mb-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center">
              <i className="fas fa-dumbbell mr-2 icon-glow"></i>
              <span className="title-shimmer">{UI_TEXT.appName}</span>
            </h1>
            {user && <QuotaStatus className="" />}
            {/* Системна панель статусу в шапці */}
            <SystemStatusBar isNetworkOnline={isNetworkOnline} />
          </div>
          {(userProfile || isLoading || session.activeDay !== null) &&  // Показуємо навігацію якщо є профіль, завантаження або активне тренування
            <Navbar currentView={currentView} onViewChange={(v) => {
              // Дозволяємо переключення на "Прогрес" під час тренування без завершення
              if (session.activeDay !== null && v !== 'workout' && v !== 'progress') {
                if(!confirm(UI_TEXT.confirmEndWorkout + " Перехід на іншу вкладку завершить його без збереження логів.")) return;
                endWorkout(); // Завершуємо активну сесію Firebase
              }
              setCurrentView(v);
            }} />
          }
        </div>
      </header>

      <main className="flex-grow container mx-auto p-3 sm:p-4 md:p-6 content-glow">
        {error && !isLoading && <ErrorMessage message={error} onClear={() => setError(null)} />}
         {renderView()}
        {/* Плаваюча кнопка чату (видима лише авторизованим користувачам на всіх вкладках крім профілю) */}
        {user && currentView !== 'profile' && (
          <button
            className="btn-primary fixed bottom-6 right-6 z-50 rounded-full p-4 flex items-center justify-center text-2xl accent-glow"
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
            <div className="card relative w-full max-w-md sm:max-w-lg h-[80vh] sm:h-[70vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center p-3 sm:p-4 border-b border-fitness-gold-600/30 bg-gradient-gold-dark rounded-t-xl">
                <span className="text-lg font-semibold text-readable"><i className="fas fa-robot mr-2 text-fitness-gold-400 accent-glow"></i>Чат з тренером</span>
                <button onClick={() => setIsTrainerChatOpen(false)} className="text-fitness-gold-400 hover:text-fitness-gold-200 text-xl transition-colors interactive-glow" aria-label="Закрити чат">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <TrainerChat
                  userProfile={userProfile!}
                  currentWorkoutPlan={currentWorkoutPlan}
                  activeDay={session.activeDay}
                  onWorkoutPlanModified={async (modifiedPlan) => {
                      // If we don't have a current plan yet, initialize with the modified plan
                      if (!currentWorkoutPlan || !Array.isArray(currentWorkoutPlan) || currentWorkoutPlan.length === 0) {
                        const initialPlan = [modifiedPlan];
                        setCurrentWorkoutPlan(initialPlan);
                        await saveWorkoutPlan(initialPlan);
                        if (session.activeDay === modifiedPlan.day) {
                          updateExerciseOrder(modifiedPlan.exercises);
                        }
                        return;
                      }

                      // Update the current workout plan (replace the matching day or append if missing)
                      let found = false;
                      const updatedPlan = currentWorkoutPlan.map(day => {
                        if (day.day === modifiedPlan.day) {
                          found = true;
                          return modifiedPlan;
                        }
                        return day;
                      });

                      if (!found) updatedPlan.push(modifiedPlan);

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

      <footer className="bg-fitness-dark-800/60 backdrop-blur-sm text-center p-3 sm:p-4 text-xs sm:text-sm text-muted mt-auto border-t border-fitness-gold-600/30 interactive-glow">
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

      {/* Компонент для повідомлень про оновлення додатку */}
      <UpdateNotification onUpdate={handleAppUpdate} />
      
      {/* Старі компоненти тепер інтегровані в SystemStatusBar */}
    </div>
  );
};

export default App;