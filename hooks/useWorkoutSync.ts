import { useState, useEffect } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../config/firebase';
import { Exercise } from '../types';

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
        setSession(data);
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
        ...ex,
        isCompletedDuringSession: false,
        sessionLoggedSets: [],
        sessionSuccess: undefined
      })),
      startTime: Date.now(),
      workoutTimer: 0
    };

    await set(ref(database, `workoutSessions/${userId}`), newSession);
  };

  const updateExercise = async (exerciseIndex: number, loggedSets: any[], success: boolean) => {
    const updatedExercises = session.sessionExercises.map((ex, idx) =>
      idx === exerciseIndex
        ? { ...ex, sessionLoggedSets: loggedSets, sessionSuccess: success, isCompletedDuringSession: true }
        : ex
    );

    await set(ref(database, `workoutSessions/${userId}/sessionExercises`), updatedExercises);
  };

  const endWorkout = async () => {
    await remove(ref(database, `workoutSessions/${userId}`));
  };

  const updateTimer = async (time: number) => {
    await set(ref(database, `workoutSessions/${userId}/workoutTimer`), time);
  };

  return {
    session,
    startWorkout,
    updateExercise,
    endWorkout,
    updateTimer
  };
}; 