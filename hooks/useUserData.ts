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
          isSkipped: ex.isSkipped ?? false, // Додаємо підтримку isSkipped
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
  const [justSaved, setJustSaved] = useState(false);

  // Завантаження профілю
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Якщо ми щойно зберегли профіль, не перезавантажуємо його
      if (justSaved) {
        console.log('🟡 [useUserData.loadProfile] Пропускаємо завантаження - профіль щойно збережено');
        setJustSaved(false);
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const loadedProfile = docSnap.data() as UserProfile;
          console.log('🔄 [useUserData.loadProfile] Завантажено профіль з Firebase:', loadedProfile.healthProfile?.conditions?.length || 0, 'умов');
          setProfile(loadedProfile);
        } else {
          console.log('🔄 [useUserData.loadProfile] Профіль не знайдено в Firebase');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, justSaved]);

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

  // Функція для очищення undefined значень
  const cleanUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(cleanUndefinedValues);
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    return obj;
  };

  // Збереження профілю
  const saveProfile = async (profile: UserProfile) => {
    console.log('🔵 [useUserData.saveProfile] Початок збереження профілю:', profile.healthProfile?.conditions?.length || 0, 'умов');
    
    if (!user) throw new Error('User not authenticated');

    try {
      console.log('🔄 [useUserData.saveProfile] Зберігаємо в Firestore');
      const cleanedProfile = cleanUndefinedValues(profile);
      console.log('🧹 [useUserData.saveProfile] Очищено undefined значення');
      await setDoc(doc(db, 'users', user.uid), cleanedProfile);
      console.log('🟡 [useUserData.saveProfile] Оновлюємо локальний стан setProfile');
      setProfile(profile);
      console.log('🟡 [useUserData.saveProfile] Встановлюємо флаг justSaved');
      setJustSaved(true);
      console.log('✅ [useUserData.saveProfile] Профіль успішно збережено');
    } catch (error) {
      console.error('❌ [useUserData.saveProfile] Помилка при збереженні:', error);
      throw error;
    }
  };

  // Збереження логу тренування
  const saveWorkoutLog = async (log: WorkoutLog): Promise<WorkoutLog> => {
    console.log('[saveWorkoutLog] Початок. Отримано лог:', log);
    if (!user) {
      console.error('[saveWorkoutLog] Користувач не автентифікований.');
      throw new Error('User not authenticated');
    }

    try {
      let finalLog: WorkoutLog;
      let logRef;

      if (log.id) {
        // Оновлення існуючого логу
        console.log(`[saveWorkoutLog] Оновлюємо існуючий лог з ID: ${log.id}`);
        logRef = doc(db, 'workoutLogs', log.id);
        finalLog = { ...log, userId: user.uid };
      } else {
        // Створення нового логу
        const newLogId = `${user.uid}_${Date.now()}`;
        console.log(`[saveWorkoutLog] Створюємо новий лог з ID: ${newLogId}`);
        logRef = doc(db, 'workoutLogs', newLogId);
        finalLog = { ...log, id: newLogId, userId: user.uid };
      }
      
      // Підготовка даних для Firestore
      const dateForFirestore = finalLog.date instanceof Date
        ? {
            seconds: Math.floor(finalLog.date.getTime() / 1000),
            nanoseconds: (finalLog.date.getTime() % 1000) * 1e6
          }
        : finalLog.date;

      const cleanedLog = removeUndefined({ ...finalLog, date: dateForFirestore });
      
      await setDoc(logRef, cleanedLog, { merge: true }); // Використовуємо merge: true для безпечного оновлення
      
      // Оновлюємо локальний стан після збереження
      setWorkoutLogs(prevLogs => {
        const existingIndex = prevLogs.findIndex(log => log.id === finalLog.id);
        if (existingIndex >= 0) {
          // Оновлюємо існуючий лог
          const updatedLogs = [...prevLogs];
          updatedLogs[existingIndex] = cleanedLog as WorkoutLog;
          return updatedLogs;
        } else {
          // Додаємо новий лог на початок списку
          return [cleanedLog as WorkoutLog, ...prevLogs];
        }
      });
      
      return cleanedLog as WorkoutLog;

    } catch (error) {
      console.error('[saveWorkoutLog] Детальна помилка:', error);
      throw error;
    }
  };

  // Збереження плану тренувань
  const saveWorkoutPlan = async (plan: DailyWorkoutPlan[] | null, forceRefetch: boolean = false): Promise<DailyWorkoutPlan[] | undefined> => {
    if (!user) throw new Error('User not authenticated');
    
    if (plan) {
      try {
        const cleanedPlan = cleanWorkoutPlanForFirestore(plan);
        const docRef = doc(db, 'workoutPlans', user.uid);
        await setDoc(docRef, { plan: cleanedPlan });
        setWorkoutPlan(cleanedPlan);
        return cleanedPlan;
      } catch (error) {
        console.error('Error saving workout plan:', error);
        throw error;
      }
    }

    if (forceRefetch) {
      try {
        const docRef = doc(db, 'workoutPlans', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetchedPlan = docSnap.data().plan as DailyWorkoutPlan[];
          setWorkoutPlan(fetchedPlan);
          return fetchedPlan;
        }
      } catch (error) {
        console.error('Error refetching workout plan:', error);
      }
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