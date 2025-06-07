import { useState, useEffect } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../config/firebase';
import { Exercise, LoggedSetWithAchieved } from '../types';

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
}

export const useWorkoutSync = (userId: string) => {
  console.log("useWorkoutSync ініціалізовано з userId:", userId); // Лог для userId
  const [session, setSession] = useState<WorkoutSession>({
    activeDay: null,
    sessionExercises: [],
    startTime: null,
    workoutTimer: 0
  });

  // Підписуємось на зміни в базі даних
  useEffect(() => {
    if (!userId) {
      console.log("useWorkoutSync: userId відсутній, не підписуємось на Firebase Realtime Database.");
      return;
    }
    const sessionRef = ref(database, `workoutSessions/${userId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      console.log("Дані з Firebase Realtime Database (onValue):", data);
      if (data) {
        const cleanedData = removeUndefined(data);
        console.log("Очищені дані з Firebase (onValue):", cleanedData);
        setSession(prevSession => ({
          activeDay: cleanedData.activeDay ?? null,
          sessionExercises: cleanedData.sessionExercises ?? [],
          startTime: cleanedData.startTime ?? null,
          workoutTimer: cleanedData.workoutTimer ?? 0,
        }));
      } else {
        console.log("Дані з Firebase Realtime Database порожні.");
        setSession({
          activeDay: null,
          sessionExercises: [],
          startTime: null,
          workoutTimer: 0
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
    console.log("startWorkout викликано. День:", dayNumber, "Вправи:", exercises);
    const newSession: WorkoutSession = {
      activeDay: dayNumber,
      sessionExercises: exercises.map(ex => ({
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
      workoutTimer: 0
    };

    const cleanedSession = removeUndefined(newSession);
    console.log("Очищений об'єкт сесії для Firebase:", cleanedSession);
    const sessionPath = `workoutSessions/${userId}`; // Лог для шляху
    console.log("startWorkout: Спроба зберегти сесію за шляхом:", sessionPath, "з userId:", userId);
    try {
      await set(ref(database, sessionPath), cleanedSession);
      console.log("Дані сесії успішно збережено у Firebase.");
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
    console.log("updateExercise: Спроба оновити вправу за шляхом:", sessionPath, "з userId:", userId);
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
    console.log("endWorkout: Спроба завершити тренування за шляхом:", sessionPath, "з userId:", userId);
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
    console.log("updateTimer: Спроба оновити таймер за шляхом:", sessionPath, "з userId:", userId);
    try {
      await set(ref(database, sessionPath), cleanedTime);
    } catch (error) {
      console.error("Помилка при оновленні таймера у Firebase:", error);
      throw error;
    }
  };

  return {
    session,
    startWorkout,
    updateExercise,
    endWorkout,
    updateTimer
  };
}; 