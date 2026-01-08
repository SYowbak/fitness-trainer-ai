import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, remove, get } from 'firebase/database';
import { database } from '../config/firebase';
import { Exercise, LoggedSetWithAchieved, WellnessCheck, AdaptiveWorkoutPlan, WellnessRecommendation, WorkoutLog, ExerciseRecommendation } from '../types';
import { isOnline, saveOfflineData, getOfflineData } from '../utils/offlineUtils';
import { backgroundAnalysisService } from '../services/backgroundWorkoutAnalysis';

// Утиліта для очищення undefined значень для Firebase Realtime Database
function removeUndefined(obj: any): any {
  if (obj === undefined) {
    return null; // Firebase не дозволяє undefined, замінюємо на null
  } else if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        newObj[key] = removeUndefined(value);
      }
    }
    return newObj;
  }
  return obj;
}

interface WorkoutSession {
  activeDay: number | null;
  sessionExercises: Exercise[];
  startTime: number | null;
  workoutTimer: number;
  wellnessCheck?: WellnessCheck | null;
  adaptiveWorkoutPlan?: AdaptiveWorkoutPlan | null;
  wellnessRecommendations?: WellnessRecommendation[] | null;
  exerciseRecommendations?: ExerciseRecommendation[] | null;
}

export const useWorkoutSync = (userId: string, workoutLogs: WorkoutLog[] = []) => {
  const [session, setSession] = useState<WorkoutSession>({
    activeDay: null,
    sessionExercises: [],
    startTime: null,
    workoutTimer: 0,
    wellnessCheck: null,
    adaptiveWorkoutPlan: null,
    wellnessRecommendations: null,
    exerciseRecommendations: null
  });

  // Ref для відстеження останнього завантаженого дня (щоб не завантажувати рекомендації повторно)
  const lastLoadedDayRef = useRef<number | null>(null);

  // Підписуємось на зміни в базі даних
  useEffect(() => {
    if (!userId) {
      return;
    }

    // Функція для завантаження рекомендацій з останнього аналізу
    const loadRecommendations = (dayNumber: number): ExerciseRecommendation[] => {
      try {
        if (workoutLogs && workoutLogs.length > 0) {
          const recommendations = backgroundAnalysisService.getRecommendationsForDay(workoutLogs, dayNumber);
          return recommendations;
        }
      } catch (error) {
        console.error('❌ Помилка завантаження рекомендацій:', error);
      }
      return [];
    };

    // Завантажуємо офлайн сесію якщо є
    if (!isOnline()) {
      const offlineData = getOfflineData();
      if (offlineData.currentSession) {
        console.log('📵 Завантажуємо активну сесію з офлайн кешу');
        
        // Якщо є активне тренування, перераховуємо таймер на основі startTime
        if (offlineData.currentSession.startTime && offlineData.currentSession.activeDay !== null) {
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - offlineData.currentSession.startTime) / 1000);
          console.log('⏱️ [Timer] Відновлюємо таймер:', elapsedSeconds, 'секунд');

          // Перевіряємо чи є збережені рекомендації
          if ((!offlineData.currentSession.exerciseRecommendations || offlineData.currentSession.exerciseRecommendations.length === 0) && offlineData.workoutLogs) {
            const recommendations = backgroundAnalysisService.getRecommendationsForDay(
              offlineData.workoutLogs,
              offlineData.currentSession.activeDay
            );
            if (recommendations.length > 0) {
              console.log('✅ Відновлено рекомендації з офлайн кешу');
              offlineData.currentSession.exerciseRecommendations = recommendations;
              saveOfflineData(offlineData);
            }
          }
          
          const restoredSession = {
            ...offlineData.currentSession,
            workoutTimer: elapsedSeconds
          };
          
          setSession(restoredSession);
          
          // Оновлюємо офлайн кеш з новим часом
          saveOfflineData({
            ...offlineData,
            currentSession: restoredSession
          });
        } else {
          setSession(offlineData.currentSession);
        }
      }
    }
    const sessionRef = ref(database, `workoutSessions/${userId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      
      // Якщо офлайн - ігноруємо Firebase дані, щоб не перезаписати локальну сесію
      if (!isOnline()) {
        console.log('📵 [Firebase] Офлайн - ігноруємо Firebase дані');
        return;
      }
      
      if (data) {
        const cleanedData = removeUndefined(data);

        // Якщо є активний день, завантажуємо рекомендації з workoutLogs
        // Завантажуємо тільки якщо день змінився або workoutLogs оновилися
        let loadedRecommendations: ExerciseRecommendation[] | null = null;
        if (cleanedData.activeDay !== null && cleanedData.activeDay !== lastLoadedDayRef.current) {
          try {
            const recommendations = loadRecommendations(cleanedData.activeDay);
            if (recommendations.length > 0) {
              console.log('✅ Відновлено exercise recommendations з попереднього аналізу:', recommendations.length);
              loadedRecommendations = recommendations;
              lastLoadedDayRef.current = cleanedData.activeDay;
              // Не зберігаємо в Firebase тут, щоб уникнути циклічних оновлень та помилок доступу
              // Рекомендації будуть збережені через updateExerciseRecommendations, коли вони дійсно змінюються
            } else {
              console.log('ℹ️ Рекомендації для дня не знайдено в workoutLogs');
            }
          } catch (error) {
            console.error('❌ Помилка завантаження рекомендацій з workoutLogs:', error);
            // Продовжуємо з тими рекомендаціями, що є в Firebase
          }
        } else if (cleanedData.activeDay === null) {
          // Якщо активного дня немає, скидаємо посилання
          lastLoadedDayRef.current = null;
        }

        setSession(prevSession => {
          const newSessionExercises = cleanedData.sessionExercises ?? [];
          const oldSessionExercises = prevSession.sessionExercises ?? [];

          // Функція для глибокого порівняння LoggedSetWithAchieved масивів
          const areLoggedSetsEqual = (sets1: LoggedSetWithAchieved[] | null | undefined, sets2: LoggedSetWithAchieved[] | null | undefined): boolean => {
            if (!sets1 && !sets2) return true; // Обидва null/undefined
            if (!sets1 || !sets2) return false; // Один null/undefined, інший ні
            if (sets1.length !== sets2.length) return false;

            for (let i = 0; i < sets1.length; i++) {
              const s1 = sets1[i];
              const s2 = sets2[i];
              if (s1.repsAchieved !== s2.repsAchieved ||
                  s1.weightUsed !== s2.weightUsed ||
                  (s1.completed ?? false) !== (s2.completed ?? false)) {
                return false;
              }
            }
            return true;
          };

          // Функція для глибокого порівняння масивів вправ
          const areExercisesEqual = (arr1: Exercise[], arr2: Exercise[]) => {
            if (arr1.length !== arr2.length) return false;
            for (let i = 0; i < arr1.length; i++) {
              const ex1 = arr1[i];
              const ex2 = arr2[i];
              // Порівнюємо всі відповідні властивості, які можуть спричинити рендеринг
              if (ex1.id !== ex2.id ||
                  ex1.name !== ex2.name ||
                  ex1.description !== ex2.description ||
                  ex1.sets !== ex2.sets ||
                  ex1.reps !== ex2.reps ||
                  ex1.rest !== ex2.rest ||
                  ex1.videoSearchQuery !== ex2.videoSearchQuery ||
                  ex1.targetWeight !== ex2.targetWeight ||
                  ex1.targetReps !== ex2.targetReps ||
                  (ex1.recommendation?.text !== ex2.recommendation?.text) ||
                  (ex1.recommendation?.action !== ex2.recommendation?.action) ||
                  ex1.isCompletedDuringSession !== ex2.isCompletedDuringSession ||
                  ex1.sessionSuccess !== ex2.sessionSuccess ||
                  (ex1.isSkipped ?? false) !== (ex2.isSkipped ?? false) ||
                  !areLoggedSetsEqual(ex1.sessionLoggedSets, ex2.sessionLoggedSets)) {
                return false;
              }
            }
            return true;
          };

          // Переконуємося, що adaptiveWorkoutPlan.adaptations завжди масив
          const safeAdaptiveWorkoutPlan = cleanedData.adaptiveWorkoutPlan ? {
            ...cleanedData.adaptiveWorkoutPlan,
            adaptations: Array.isArray(cleanedData.adaptiveWorkoutPlan.adaptations)
              ? cleanedData.adaptiveWorkoutPlan.adaptations
              : []
          } : null;

          // Переконуємося, що wellnessRecommendations завжди масив або null
          const safeWellnessRecommendations = Array.isArray(cleanedData.wellnessRecommendations)
            ? cleanedData.wellnessRecommendations
            : (cleanedData.wellnessRecommendations === null ? null : []);

          // Використовуємо завантажені рекомендації, якщо вони є, інакше використовуємо з Firebase
          const safeExerciseRecommendations = loadedRecommendations !== null
            ? loadedRecommendations
            : (Array.isArray(cleanedData.exerciseRecommendations)
                ? cleanedData.exerciseRecommendations
                : (cleanedData.exerciseRecommendations === null ? null : []));

          const newSession = {
            activeDay: cleanedData.activeDay ?? null,
            sessionExercises: areExercisesEqual(newSessionExercises, oldSessionExercises)
              ? oldSessionExercises
              : newSessionExercises,
            startTime: cleanedData.startTime ?? null,
            workoutTimer: cleanedData.workoutTimer ?? 0,
            wellnessCheck: cleanedData.wellnessCheck ?? null,
            adaptiveWorkoutPlan: safeAdaptiveWorkoutPlan,
            wellnessRecommendations: safeWellnessRecommendations,
            exerciseRecommendations: safeExerciseRecommendations,
          };
          
          return newSession;
        });
      } else {
        // Не скидаємо сесію якщо офлайн - можливо є активне тренування
        console.log('🔥 [Firebase] Немає даних, isOnline:', isOnline());
        if (isOnline()) {
          console.log('🌐 Firebase: немає активної сесії - скидаємо');
          setSession({
            activeDay: null,
            sessionExercises: [],
            startTime: null,
            workoutTimer: 0,
            wellnessCheck: null,
            adaptiveWorkoutPlan: null,
            wellnessRecommendations: null
          });
        } else {
          console.log('📵 Firebase: немає даних, але офлайн - зберігаємо локальну сесію');
        }
      }
    });

    return () => {
      if (userId) {
      unsubscribe();
      }
    };
  }, [userId, workoutLogs]);

  // Перезавантажуємо рекомендації коли workoutLogs оновлюються і є активна сесія
  const previousWorkoutLogsRef = useRef<WorkoutLog[]>([]);
  const previousActiveDayRef = useRef<number | null>(null);
  useEffect(() => {
    if (!userId || !session.activeDay) {
      previousWorkoutLogsRef.current = workoutLogs;
      previousActiveDayRef.current = session.activeDay;
      return;
    }

    // Перевіряємо чи workoutLogs або activeDay дійсно змінилися
    const logsChanged = JSON.stringify(previousWorkoutLogsRef.current) !== JSON.stringify(workoutLogs);
    const dayChanged = previousActiveDayRef.current !== session.activeDay;
    
    if (!logsChanged && !dayChanged) {
      return;
    }

    previousWorkoutLogsRef.current = workoutLogs;
    previousActiveDayRef.current = session.activeDay;

    // Скидаємо lastLoadedDayRef, щоб рекомендації завантажилися знову в onValue callback
    if (logsChanged) {
      lastLoadedDayRef.current = null;
    }

    // Завантажуємо рекомендації з workoutLogs (навіть якщо workoutLogs порожній, спробуємо завантажити)
    try {
      const recommendations = backgroundAnalysisService.getRecommendationsForDay(workoutLogs, session.activeDay);
      
      if (recommendations.length > 0) {
        // Перевіряємо чи рекомендації відрізняються від поточних
        const currentRecs = session.exerciseRecommendations || [];
        const areDifferent = recommendations.length !== currentRecs.length ||
          recommendations.some((rec, idx) => {
            const currentRec = currentRecs[idx];
            return !currentRec || rec.exerciseName !== currentRec.exerciseName || rec.recommendation !== currentRec.recommendation;
          });

        if (areDifferent) {
          console.log('🔄 Оновлюємо рекомендації після зміни workoutLogs:', recommendations.length);
          updateExerciseRecommendations(recommendations);
        }
        // Якщо рекомендації однакові, не оновлюємо - це запобігає зацикленню
      } else if (workoutLogs.length > 0) {
        // Якщо workoutLogs завантажені, але рекомендацій немає - очищуємо базові
        // Це означає, що для цього дня ще не було аналізу
        const currentRecs = session.exerciseRecommendations || [];
        if (currentRecs.length > 0) {
          // Перевіряємо чи це базові рекомендації (мають reason "Базова рекомендація для прогресу")
          const areBasicRecommendations = currentRecs.every(rec => 
            rec.reason === "Базова рекомендація для прогресу" || 
            !rec.reason ||
            rec.reason.includes("Базова")
          );
          
          if (areBasicRecommendations) {
            console.log('ℹ️ Очищуємо базові рекомендації - для цього дня ще не було аналізу');
            updateExerciseRecommendations([]);
          }
        }
      }
    } catch (error) {
      console.error('❌ Помилка завантаження рекомендацій з workoutLogs:', error);
    }
  }, [workoutLogs, session.activeDay, userId]);

  // Локальний таймер: тільки офлайн для фонової роботи
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    if (session.startTime && session.activeDay !== null && !isOnline()) {
      console.log('⏱️ [Timer] Запускаємо локальний таймер (офлайн режим)');
      
      timerInterval = setInterval(() => {
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - session.startTime!) / 1000);
        
        setSession(prevSession => {
          if (prevSession.startTime && prevSession.activeDay !== null) {
            const newSession = { ...prevSession, workoutTimer: elapsedSeconds };
            
            // Зберігаємо в офлайн кеш
            const offlineData = getOfflineData();
            saveOfflineData({
              ...offlineData,
              currentSession: newSession
            });
            
            return newSession;
          }
          return prevSession;
        });
      }, 1000); // Оновлюємо кожну секунду
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [session.startTime, session.activeDay]);

  // Обробка повернення до додатку (після блокування телефону)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session.startTime && session.activeDay !== null) {
        // Користувач повернувся до додатку - перераховуємо таймер
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - session.startTime) / 1000);
        
        setSession(prevSession => {
          const newSession = { ...prevSession, workoutTimer: elapsedSeconds };
          
          // Зберігаємо в офлайн кеш
          const offlineData = getOfflineData();
          saveOfflineData({
            ...offlineData,
            currentSession: newSession
          });
          
          return newSession;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session.startTime, session.activeDay]);

  // Синхронізація таймера при відновленні мережі
  useEffect(() => {
    const handleOnlineStatusChange = () => {
      if (isOnline() && session.startTime && session.activeDay !== null) {
        // Мережа відновилася під час активного тренування
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - session.startTime) / 1000);
        console.log('🌐 [Timer] Мережа відновлена під час тренування - синхронізуємо таймер:', elapsedSeconds, 'секунд');
        
        // Оновлюємо локальний стан
        setSession(prevSession => {
          const newSession = { ...prevSession, workoutTimer: elapsedSeconds };
          
          // Зберігаємо в офлайн кеш
          const offlineData = getOfflineData();
          saveOfflineData({
            ...offlineData,
            currentSession: newSession
          });
          
          return newSession;
        });
        
        // Синхронізуємо всю сесію з Firebase
        setTimeout(() => {
          setSession(currentSession => {
            if (currentSession.startTime && currentSession.activeDay !== null) {
              const sessionPath = `workoutSessions/${userId}`;
              const cleanedSession = removeUndefined(currentSession);
              
              set(ref(database, sessionPath), cleanedSession)
                .then(() => {
                  console.log('🌐 [Timer] Вся сесія синхронізована з Firebase');
                })
                .catch((error) => {
                  console.error('❌ [Timer] Помилка синхронізації сесії з Firebase:', error);
                });
            }
            return currentSession;
          });
        }, 100); // Невелика затримка щоб стан встиг оновитися
      }
    };

    // Слухаємо зміни статусу мережі
    window.addEventListener('online', handleOnlineStatusChange);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
    };
  }, [session.startTime, session.activeDay, userId]);

  const startWorkout = async (dayNumber: number, exercises: Exercise[]) => {
    if (!userId) { console.error("startWorkout: userId відсутній."); return; }
    
    const newSession: WorkoutSession = {
      activeDay: dayNumber,
      sessionExercises: exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        description: ex.description,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        videoSearchQuery: ex.videoSearchQuery ?? null,
        weightType: ex.weightType,
        targetWeight: ex.targetWeight ?? null,
        targetReps: ex.targetReps ?? null,
        recommendation: ex.recommendation ?? null,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: false,
        isSkipped: false,
        notes: ex.notes ?? null,
      })),
      startTime: Date.now(),
      workoutTimer: 0,
      wellnessCheck: null,
      adaptiveWorkoutPlan: null,
      wellnessRecommendations: null,
      exerciseRecommendations: null
    };

    // Оновлюємо локальний стан одразу
    console.log('🎯 [startWorkout] Оновлюємо сесію:', { activeDay: dayNumber, exercisesCount: exercises.length });
    setSession(newSession);
    console.log('🎯 [startWorkout] Сесія оновлена, activeDay:', newSession.activeDay);

    // Зберігаємо в офлайн кеш
    const offlineData = getOfflineData();
    saveOfflineData({
      ...offlineData,
      currentSession: newSession
    });

    // Якщо онлайн - зберігаємо в Firebase
    if (isOnline()) {
      const cleanedSession = removeUndefined(newSession);
      const sessionPath = `workoutSessions/${userId}`;
      try {
        await set(ref(database, sessionPath), cleanedSession);
        console.log('🌐 Тренування збережено в Firebase');
      } catch (error) {
        console.error("Помилка при збереженні сесії у Firebase:", error);
        console.log('📵 Продовжуємо офлайн - сесія збережена локально');
      }
    } else {
      console.log('📵 Офлайн режим - тренування розпочато локально');
    }
  };

  const updateExercise = async (exerciseIndex: number, loggedSets: LoggedSetWithAchieved[], success: boolean, isSkipped: boolean = false) => {
    if (!userId) { console.error("updateExercise: userId відсутній."); return; }
    const sanitizedLoggedSets = loggedSets.map(set => ({
      repsAchieved: set.repsAchieved ?? null,
      weightUsed: set.weightUsed ?? null,
      completed: set.completed ?? false,
      extraWeightKg: (set as any).extraWeightKg ?? null,
    }));

    const updatedExercises = session.sessionExercises.map((ex, idx) =>
      idx === exerciseIndex
        ? {
            ...ex,
            isCompletedDuringSession: !isSkipped,
            sessionLoggedSets: sanitizedLoggedSets,
            sessionSuccess: success,
            isSkipped: isSkipped,
          }
        : ex
    );

    // Оновлюємо локальний стан одразу
    const updatedSession = { ...session, sessionExercises: updatedExercises };
    setSession(updatedSession);

    // Зберігаємо в офлайн кеш
    const offlineData = getOfflineData();
    saveOfflineData({
      ...offlineData,
      currentSession: updatedSession
    });

    // Якщо онлайн - зберігаємо в Firebase
    if (isOnline()) {
      const cleanedExercises = removeUndefined(updatedExercises);
      const sessionPath = `workoutSessions/${userId}/sessionExercises`;
      try {
        await set(ref(database, sessionPath), cleanedExercises);
      } catch (error) {
        console.error("Помилка при оновленні вправи у Firebase:", error);
        console.log('📵 Продовжуємо офлайн - зміни збережено локально');
      }
    }
  };

  const addCustomExercise = async (exercise: Exercise) => {
    if (!userId) { console.error("addCustomExercise: userId відсутній."); return; }
    
    const newExercise: Exercise = {
      id: exercise.id,
      name: exercise.name,
      description: exercise.description || 'Користувацька вправа',
      sets: exercise.sets || '3',
      reps: exercise.reps || '8-12',
      rest: exercise.rest || '60 секунд',
      videoSearchQuery: exercise.videoSearchQuery ?? null,
      weightType: exercise.weightType,
      targetWeight: exercise.targetWeight ?? null,
      targetReps: exercise.targetReps ?? null,
      recommendation: exercise.recommendation ?? null,
      isCompletedDuringSession: false,
      sessionLoggedSets: [],
      sessionSuccess: false,
      isSkipped: false,
      notes: exercise.notes ?? null,
    };

    const updated = [...session.sessionExercises, newExercise];
    const cleaned = removeUndefined(updated);
    const sessionPath = `workoutSessions/${userId}/sessionExercises`;
    try {
      await set(ref(database, sessionPath), cleaned);
    } catch (error) {
      console.error('Помилка при додаванні користувацької вправи:', error);
      throw error;
    }
  };

  const endWorkout = async () => {
    if (!userId) { console.error("endWorkout: userId відсутній."); return; }
    
    // Очищуємо локальний стан одразу
    setSession({
      activeDay: null,
      sessionExercises: [],
      startTime: null,
      workoutTimer: 0,
      wellnessCheck: null,
      adaptiveWorkoutPlan: null,
      wellnessRecommendations: null,
      exerciseRecommendations: null
    });

    // Очищуємо офлайн кеш
    const offlineData = getOfflineData();
    saveOfflineData({
      ...offlineData,
      currentSession: null
    });

    // Якщо онлайн - видаляємо з Firebase
    if (isOnline()) {
      const sessionRef = ref(database, `workoutSessions/${userId}`);
      try {
        const snapshot = await get(sessionRef);
        if (snapshot.exists()) {
          await remove(sessionRef);
          console.log("🌐 Сесія успішно завершена в Firebase");
        }
      } catch (error) {
        console.error("Помилка при завершенні тренування у Firebase:", error);
        console.log('📵 Сесія завершена локально');
      }
    } else {
      console.log('📵 Офлайн режим - тренування завершено локально');
    }
  };

  const updateTimer = async (time: number) => {
    if (!userId) { console.error("updateTimer: userId відсутній."); return; }
    
    // Оновлюємо локальний стан одразу
    setSession(prevSession => {
      const newSession = { ...prevSession, workoutTimer: time };
      
      // Зберігаємо в офлайн кеш
      const offlineData = getOfflineData();
      saveOfflineData({
        ...offlineData,
        currentSession: newSession
      });
      
      return newSession;
    });
    
    // Якщо онлайн - зберігаємо в Firebase
    if (isOnline()) {
      const cleanedTime = removeUndefined(time);
      const sessionPath = `workoutSessions/${userId}/workoutTimer`;
      try {
        await set(ref(database, sessionPath), cleanedTime);
      } catch (error) {
        console.error("Помилка при оновленні таймера у Firebase:", error);
        console.log('⏱️ [Timer] Продовжуємо офлайн - таймер збережено локально');
      }
    }
  };

  const updateWellnessCheck = async (wellnessCheck: WellnessCheck) => {
    if (!userId) { console.error("updateWellnessCheck: userId відсутній."); return; }
    const cleanedWellnessCheck = removeUndefined(wellnessCheck);
    const sessionPath = `workoutSessions/${userId}/wellnessCheck`;
    try {
      await set(ref(database, sessionPath), cleanedWellnessCheck);
    } catch (error) {
      console.error("Помилка при оновленні wellnessCheck у Firebase:", error);
      throw error;
    }
  };

  const updateAdaptiveWorkoutPlan = async (adaptiveWorkoutPlan: AdaptiveWorkoutPlan) => {
    if (!userId) { console.error("updateAdaptiveWorkoutPlan: userId відсутній."); return; }
    
    const safeAdaptiveWorkoutPlan = {
      ...adaptiveWorkoutPlan,
      adaptations: adaptiveWorkoutPlan.adaptations || []
    };
    
    const cleanedAdaptiveWorkoutPlan = removeUndefined(safeAdaptiveWorkoutPlan);
    const sessionPath = `workoutSessions/${userId}/adaptiveWorkoutPlan`;
    try {
      await set(ref(database, sessionPath), cleanedAdaptiveWorkoutPlan);
    } catch (error) {
      console.error("Помилка при оновленні adaptiveWorkoutPlan у Firebase:", error);
      throw error;
    }
  };

  const updateExerciseRecommendations = async (exerciseRecommendations: ExerciseRecommendation[]) => {
    if (!userId) { console.error("updateExerciseRecommendations: userId відсутній."); return; }

    setSession(prevSession => {
      const newSession = { ...prevSession, exerciseRecommendations };

      const offlineData = getOfflineData();
      saveOfflineData({
        ...offlineData,
        currentSession: newSession
      });

      return newSession;
    });

    if (isOnline()) {
      const cleanedExerciseRecommendations = removeUndefined(exerciseRecommendations);
      const sessionPath = `workoutSessions/${userId}/exerciseRecommendations`;
      try {
        await set(ref(database, sessionPath), cleanedExerciseRecommendations);
      } catch (error) {
        console.error("Помилка при оновленні exerciseRecommendations у Firebase:", error);
        console.log('📵 Продовжуємо офлайн - exercise recommendations збережено локально');
      }
    }
  };

  const updateWellnessRecommendations = async (wellnessRecommendations: WellnessRecommendation[]) => {
    if (!userId) { console.error("updateWellnessRecommendations: userId відсутній."); return; }
    
    // Update local state first
    setSession(prevSession => {
      const newSession = { ...prevSession, wellnessRecommendations };
      
      // Save to offline cache
      const offlineData = getOfflineData();
      saveOfflineData({
        ...offlineData,
        currentSession: newSession
      });
      
      return newSession;
    });

    // If online - sync with Firebase
    if (isOnline()) {
      const cleanedWellnessRecommendations = removeUndefined(wellnessRecommendations); 
      const sessionPath = `workoutSessions/${userId}/wellnessRecommendations`;
      try {
        await set(ref(database, sessionPath), cleanedWellnessRecommendations);
      } catch (error) {
        console.error("Помилка при оновленні wellnessRecommendations у Firebase:", error);
        console.log('📵 Продовжуємо офлайн - рекомендації збережено локально');
      }
    }
  };

  const updateExerciseOrder = async (reorderedExercises: Exercise[]) => {
    if (!userId) { console.error("updateExerciseOrder: userId відсутній."); return; }
    const cleanedExercises = removeUndefined(reorderedExercises);
    const sessionPath = `workoutSessions/${userId}/sessionExercises`;
    try {
      await set(ref(database, sessionPath), cleanedExercises);
    } catch (error) {
      console.error("Помилка при оновленні порядку вправ у Firebase:", error);
      throw error;
    }
  };

  return {
    session,
    startWorkout,
    updateExercise,
    addCustomExercise,
    endWorkout,
    updateTimer,
    updateWellnessCheck,
    updateAdaptiveWorkoutPlan,
    updateWellnessRecommendations,
    updateExerciseOrder,
    updateExerciseRecommendations
  };
};