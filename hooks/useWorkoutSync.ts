import { useState, useEffect } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../config/firebase';
import { Exercise, LoggedSetWithAchieved, WellnessCheck, AdaptiveWorkoutPlan, WellnessRecommendation } from '../types';

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
}

export const useWorkoutSync = (userId: string) => {
  // console.log("useWorkoutSync ініціалізовано з userId:", userId); // Лог для userId
  const [session, setSession] = useState<WorkoutSession>({
    activeDay: null,
    sessionExercises: [],
    startTime: null,
    workoutTimer: 0,
    wellnessCheck: null,
    adaptiveWorkoutPlan: null,
    wellnessRecommendations: null
  });

  // Підписуємось на зміни в базі даних
  useEffect(() => {
    if (!userId) {
      // console.log("useWorkoutSync: userId відсутній, не підписуємось на Firebase Realtime Database.");
      return;
    }
    const sessionRef = ref(database, `workoutSessions/${userId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      // Додаємо детальне логування отриманих даних з Firebase
      console.log("[Firebase] Отримано сирі дані:", data);
      if (data) {
        const cleanedData = removeUndefined(data);
        console.log("[Firebase] Очищені дані:", cleanedData);

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
          };
          
          // Логуємо зміни для live-синхронізації
          if (cleanedData.wellnessCheck !== prevSession.wellnessCheck) {
            console.log("Отримано оновлений wellnessCheck з live-сесії:", cleanedData.wellnessCheck);
          }
          if (cleanedData.adaptiveWorkoutPlan !== prevSession.adaptiveWorkoutPlan) {
            console.log("Отримано оновлений adaptiveWorkoutPlan з live-сесії:", cleanedData.adaptiveWorkoutPlan);
          }
          if (cleanedData.wellnessRecommendations !== prevSession.wellnessRecommendations) {
            console.log("Отримано оновлені wellnessRecommendations з live-сесії:", cleanedData.wellnessRecommendations);
          }
          
          return newSession;
        });
      } else {
        // console.log("Дані з Firebase Realtime Database порожні.");
        setSession({
          activeDay: null,
          sessionExercises: [],
          startTime: null,
          workoutTimer: 0,
          wellnessCheck: null,
          adaptiveWorkoutPlan: null,
          wellnessRecommendations: null
        });
      }
    });

    return () => {
      if (userId) {
      unsubscribe();
      }
    };
  }, [userId]);

  const startWorkout = async (dayNumber: number, exercises: Exercise[]) => {
    if (!userId) { console.error("startWorkout: userId відсутній."); return; }
    // console.log("startWorkout викликано. День:", dayNumber, "Вправи:", exercises);
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
        targetWeight: ex.targetWeight ?? null,
        targetReps: ex.targetReps ?? null,
        recommendation: ex.recommendation ?? null,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: false,
        notes: ex.notes ?? null,
      })),
      startTime: Date.now(),
      workoutTimer: 0,
      wellnessCheck: null,
      adaptiveWorkoutPlan: null,
      wellnessRecommendations: null
    };

    const cleanedSession = removeUndefined(newSession);
    // console.log("Очищений об'єкт сесії для Firebase:", cleanedSession);
    const sessionPath = `workoutSessions/${userId}`; // Лог для шляху
    // console.log("startWorkout: Спроба зберегти сесію за шляхом:", sessionPath, "з userId:", userId);
    try {
      await set(ref(database, sessionPath), cleanedSession);
      // console.log("Дані сесії успішно збережено у Firebase.");
    } catch (error) {
      console.error("Помилка при збереженні сесії у Firebase:", error);
      throw error; // Перевикидаємо помилку, щоб вона була оброблена вище
    }
  };

  const updateExercise = async (exerciseIndex: number, loggedSets: LoggedSetWithAchieved[], success: boolean) => {
    if (!userId) { console.error("updateExercise: userId відсутній."); return; }
    const sanitizedLoggedSets = loggedSets.map(set => ({
      repsAchieved: set.repsAchieved ?? null,
      weightUsed: set.weightUsed ?? null,
      completed: set.completed ?? false
    }));

    const updatedExercises = session.sessionExercises.map((ex, idx) =>
      idx === exerciseIndex
        ? {
            id: ex.id,
            name: ex.name,
            description: ex.description,
            sets: ex.sets,
            reps: ex.reps,
            rest: ex.rest,
            videoSearchQuery: ex.videoSearchQuery ?? null,
            targetWeight: ex.targetWeight ?? null,
            targetReps: ex.targetReps ?? null,
            recommendation: ex.recommendation ?? null,
            isCompletedDuringSession: true,
            sessionLoggedSets: sanitizedLoggedSets,
            sessionSuccess: success,
            notes: ex.notes ?? null,
          }
        : ex
    );

    const cleanedExercises = removeUndefined(updatedExercises);
    const sessionPath = `workoutSessions/${userId}/sessionExercises`; // Лог для шляху
    // console.log("updateExercise: Спроба оновити вправу за шляхом:", sessionPath, "з userId:", userId);
    try {
      await set(ref(database, sessionPath), cleanedExercises);
    } catch (error) {
      console.error("Помилка при оновленні вправи у Firebase:", error);
      throw error;
    }
  };

  const endWorkout = async () => {
    if (!userId) { console.error("endWorkout: userId відсутній."); return; }
    const sessionPath = `workoutSessions/${userId}`; // Лог для шляху
    // console.log("endWorkout: Спроба завершити тренування за шляхом:", sessionPath, "з userId:", userId);
    try {
      await remove(ref(database, sessionPath));
    } catch (error) {
      console.error("Помилка при завершенні тренування у Firebase:", error);
      throw error;
    }
  };

  const updateTimer = async (time: number) => {
    if (!userId) { console.error("updateTimer: userId відсутній."); return; }
    const cleanedTime = removeUndefined(time);
    const sessionPath = `workoutSessions/${userId}/workoutTimer`; // Лог для шляху
    // console.log("updateTimer: Спроба оновити таймер за шляхом:", sessionPath, "з userId:", userId);
    try {
      await set(ref(database, sessionPath), cleanedTime);
    } catch (error) {
      console.error("Помилка при оновленні таймера у Firebase:", error);
      throw error;
    }
  };

  const updateWellnessCheck = async (wellnessCheck: WellnessCheck) => {
    if (!userId) { console.error("updateWellnessCheck: userId відсутній."); return; }
    const cleanedWellnessCheck = removeUndefined(wellnessCheck);
    const sessionPath = `workoutSessions/${userId}/wellnessCheck`;
    console.log("Оновлюємо wellnessCheck у live-сесії:", cleanedWellnessCheck);
    try {
      await set(ref(database, sessionPath), cleanedWellnessCheck);
      console.log("wellnessCheck успішно оновлено у live-сесії");
    } catch (error) {
      console.error("Помилка при оновленні wellnessCheck у Firebase:", error);
      throw error;
    }
  };

  const updateAdaptiveWorkoutPlan = async (adaptiveWorkoutPlan: AdaptiveWorkoutPlan) => {
    if (!userId) { console.error("updateAdaptiveWorkoutPlan: userId відсутній."); return; }
    
    // Перекоюємося, що adaptations завжди є масивом
    const safeAdaptiveWorkoutPlan = {
      ...adaptiveWorkoutPlan,
      adaptations: adaptiveWorkoutPlan.adaptations || []
    };
    
    const cleanedAdaptiveWorkoutPlan = removeUndefined(safeAdaptiveWorkoutPlan);
    const sessionPath = `workoutSessions/${userId}/adaptiveWorkoutPlan`;
    console.log("Оновлюємо adaptiveWorkoutPlan у live-сесії:", cleanedAdaptiveWorkoutPlan);
    try {
      await set(ref(database, sessionPath), cleanedAdaptiveWorkoutPlan);
      console.log("adaptiveWorkoutPlan успішно оновлено у live-сесії");
    } catch (error) {
      console.error("Помилка при оновленні adaptiveWorkoutPlan у Firebase:", error);
      throw error;
    }
  };

  const updateWellnessRecommendations = async (wellnessRecommendations: WellnessRecommendation[]) => {
    if (!userId) { console.error("updateWellnessRecommendations: userId відсутній."); return; }
    const cleanedWellnessRecommendations = removeUndefined(wellnessRecommendations);
    const sessionPath = `workoutSessions/${userId}/wellnessRecommendations`;
    console.log("Оновлюємо wellnessRecommendations у live-сесії:", cleanedWellnessRecommendations);
    try {
      await set(ref(database, sessionPath), cleanedWellnessRecommendations);
      console.log("wellnessRecommendations успішно оновлено у live-сесії");
    } catch (error) {
      console.error("Помилка при оновленні wellnessRecommendations у Firebase:", error);
      throw error;
    }
  };

  return {
    session,
    startWorkout,
    updateExercise,
    endWorkout,
    updateTimer,
    updateWellnessCheck,
    updateAdaptiveWorkoutPlan,
    updateWellnessRecommendations
  };
}; 