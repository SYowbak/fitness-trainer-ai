import { useState, useEffect } from 'react';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  query,
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile, WorkoutLog, DailyWorkoutPlan } from '../types';
import { useAuth } from './useAuth';

// Утиліта для очищення undefined
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

// Очищення плану для Firestore: залишає тільки потрібні поля у вправах
function cleanWorkoutPlanForFirestore(plan: DailyWorkoutPlan[]): DailyWorkoutPlan[] {
  return plan.map(day => ({
    ...removeUndefined({
      ...day,
      exercises: day.exercises.map(ex => {
        const cleanedExercise = {
          name: ex.name,
          description: ex.description,
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest, // ex.rest повинен бути рядком відповідно до інтерфейсу Exercise
          videoSearchQuery: ex.videoSearchQuery ?? null,
          targetWeight: ex.targetWeight ?? null,
          targetReps: ex.targetReps ?? null,
          recommendation: ex.recommendation ?? null,
          isCompletedDuringSession: ex.isCompletedDuringSession ?? false, // Переконаємось, що це boolean
          sessionLoggedSets: ex.sessionLoggedSets ?? [], // Переконаємось, що це масив
          sessionSuccess: ex.sessionSuccess ?? false, // Переконаємось, що це boolean або null
          notes: ex.notes ?? null,
        };
        return removeUndefined(cleanedExercise);
      })
    })
  }));
}

export const useUserData = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);

  // Завантаження профілю
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // Завантаження логів тренувань
  useEffect(() => {
    const loadWorkoutLogs = async () => {
      if (!user) {
        setWorkoutLogs([]);
        return;
      }

      try {
        const logsRef = collection(db, 'workoutLogs');
        const q = query(
          logsRef,
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => {
          const data = doc.data() as WorkoutLog;
          // Перекоюємося, що adaptiveWorkoutPlan.adaptations завжди є масивом
          if (data.adaptiveWorkoutPlan) {
            return {
              ...data,
              adaptiveWorkoutPlan: {
                ...data.adaptiveWorkoutPlan,
                adaptations: data.adaptiveWorkoutPlan.adaptations || []
              }
            };
          }
          return data;
        });
        setWorkoutLogs(logs);
      } catch (error) {
        console.error('Error loading workout logs:', error);
      }
    };

    loadWorkoutLogs();
  }, [user]);

  // Завантаження плану тренувань
  useEffect(() => {
    const loadWorkoutPlan = async () => {
      if (!user) {
        setWorkoutPlan(null);
        return;
      }
      try {
        const docRef = doc(db, 'workoutPlans', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setWorkoutPlan(docSnap.data().plan as DailyWorkoutPlan[]);
        }
      } catch (error) {
        console.error('Error loading workout plan:', error);
      }
    };
    loadWorkoutPlan();
  }, [user]);

  // Збереження профілю
  const saveProfile = async (profile: UserProfile) => {
    if (!user) throw new Error('User not authenticated');

    try {
      await setDoc(doc(db, 'users', user.uid), profile);
      setProfile(profile);
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  };

  // Збереження логу тренування
  const saveWorkoutLog = async (log: WorkoutLog) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Перекоюємося, що adaptiveWorkoutPlan.adaptations завжди є масивом
      const safeLog = {
        ...log,
        userId: user.uid,
        adaptiveWorkoutPlan: log.adaptiveWorkoutPlan ? {
          ...log.adaptiveWorkoutPlan,
          adaptations: log.adaptiveWorkoutPlan.adaptations || []
        } : null
      };
      // --- Додаємо конвертацію дати ---
      let dateForFirestore = safeLog.date;
      if (dateForFirestore instanceof Date) {
        dateForFirestore = {
          seconds: Math.floor(dateForFirestore.getTime() / 1000),
          nanoseconds: (dateForFirestore.getTime() % 1000) * 1e6
        };
      }
      const cleanedLog = removeUndefined({ ...safeLog, date: dateForFirestore });
      const logsRef = collection(db, 'workoutLogs');
      await setDoc(doc(logsRef), cleanedLog);
      setWorkoutLogs(prev => [cleanedLog as WorkoutLog, ...prev]);
    } catch (error) {
      console.error('Error saving workout log:', error);
      throw error;
    }
  };

  // Збереження плану тренувань
  const saveWorkoutPlan = async (plan: DailyWorkoutPlan[]) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const cleanedPlan = cleanWorkoutPlanForFirestore(plan);
      const docRef = doc(db, 'workoutPlans', user.uid);
      await setDoc(docRef, { plan: cleanedPlan });
      setWorkoutPlan(cleanedPlan);
    } catch (error) {
      console.error('Error saving workout plan:', error);
      throw error;
    }
  };

  return {
    profile,
    workoutLogs,
    workoutPlan,
    loading,
    saveProfile,
    saveWorkoutLog,
    saveWorkoutPlan
  };
}; 