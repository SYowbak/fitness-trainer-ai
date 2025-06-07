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
    return Object.fromEntries(
      Object.entries(obj)
        .map(([k, v]) => [k, removeUndefined(v)])
        .filter(([_, v]) => v !== undefined) // Додаткова перевірка, якщо після рекурсії з'явився undefined
    );
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
  const [session, setSession] = useState<WorkoutSession>({
    activeDay: null,
    sessionExercises: [],
    startTime: null,
    workoutTimer: 0
  });

  // Підписуємось на зміни в базі даних
  useEffect(() => {
    const sessionRef = ref(database, `workoutSessions/${userId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSession(removeUndefined(data));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const startWorkout = async (dayNumber: number, exercises: Exercise[]) => {
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
    await set(ref(database, `workoutSessions/${userId}`), cleanedSession);
  };

  const updateExercise = async (exerciseIndex: number, loggedSets: LoggedSetWithAchieved[], success: boolean) => {
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
    await set(ref(database, `workoutSessions/${userId}/sessionExercises`), cleanedExercises);
  };

  const endWorkout = async () => {
    await remove(ref(database, `workoutSessions/${userId}`));
  };

  const updateTimer = async (time: number) => {
    const cleanedTime = removeUndefined(time);
    await set(ref(database, `workoutSessions/${userId}/workoutTimer`), cleanedTime);
  };

  return {
    session,
    startWorkout,
    updateExercise,
    endWorkout,
    updateTimer
  };
}; 