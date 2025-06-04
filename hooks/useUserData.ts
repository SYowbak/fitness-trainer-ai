import { useState, useEffect } from 'react';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile, WorkoutLog, DailyWorkoutPlan, Exercise } from '../types';
import { useAuth } from './useAuth';
import { removeUndefined } from '../utils/cleanObject';

// Очищення плану для Firestore: залишає тільки потрібні поля у вправах
function cleanWorkoutPlanForFirestore(plan: DailyWorkoutPlan[]): DailyWorkoutPlan[] {
  return plan.map(day => ({
    ...removeUndefined({
      ...day,
      exercises: day.exercises.map(ex => {
        // Зберігаємо всі поля вправи
        const { 
          name, 
          sets, 
          reps, 
          weight, 
          muscleGroup, 
          notes, 
          rest, 
          description, 
          videoSearchQuery,
          imageSuggestion,
          targetWeight,
          targetReps,
          isCompletedDuringSession,
          sessionLoggedSets,
          sessionSuccess
        } = ex;

        // Конвертуємо rest в секунди, якщо він заданий у форматі "X секунд"
        let restValue: string | number | undefined = rest;
        if (typeof rest === 'string' && rest.includes('секунд')) {
          const parsed = parseInt(rest.split(' ')[0]);
          if (!isNaN(parsed)) {
             restValue = parsed;
          }
        }
        // Переконайтеся, що rest завжди зберігається як рядок
        const restForFirestore = restValue !== undefined && restValue !== null ? String(restValue) + ' секунд' : undefined;

        return removeUndefined({ 
          name, 
          sets, 
          reps, 
          weight, 
          muscleGroup, 
          notes, 
          rest: restForFirestore,
          description,
          videoSearchQuery,
          imageSuggestion,
          targetWeight,
          targetReps,
          isCompletedDuringSession,
          sessionLoggedSets,
          sessionSuccess
        });
      })
    })
  }));
}

// Функція для очищення стану сесії перед збереженням
// Прибираємо непотрібні для збереження поля або форматуємо їх
function cleanSessionStateForFirestore(session: { day: number | null; exercises: Exercise[]; startTime: number | null } | null) {
  if (!session) return null;
  
  return removeUndefined({
    day: session.day,
    startTime: session.startTime,
    exercises: session.exercises.map(ex => ({
      // Зберігаємо тільки ті поля Exercise, які є частиною сесії
      name: ex.name,
      sets: ex.sets, // Зберігаємо як є
      reps: ex.reps, // Зберігаємо як є
      weight: ex.weight,
      muscleGroup: ex.muscleGroup,
      notes: ex.notes,
      description: ex.description,
      rest: ex.rest, // Зберігаємо як є
      videoSearchQuery: ex.videoSearchQuery,
      imageSuggestion: ex.imageSuggestion,
      targetWeight: ex.targetWeight,
      targetReps: ex.targetReps,
      isCompletedDuringSession: ex.isCompletedDuringSession || false, // Переконаємось, що це булеве значення
      sessionLoggedSets: ex.sessionLoggedSets || [], // Переконаємось, що це масив
      sessionSuccess: ex.sessionSuccess,
    }))
  });
}

export const useUserData = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<DailyWorkoutPlan[] | null>(null);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState<{ day: number | null; exercises: Exercise[]; startTime: number | null } | null>(null);
  const [loadingActiveSession, setLoadingActiveSession] = useState(true);

  // Завантаження профілю та активної сесії
  useEffect(() => {
    console.log('useUserData useEffect triggered', { user: !!user });
    const loadUserData = async () => {
      console.log('loadUserData function called');
      if (!user) {
        console.log('loadUserData: user is null');
        setProfile(null);
        setWorkoutLogs([]);
        setWorkoutPlan(null);
        setActiveWorkoutSession(null);
        setLoading(false);
        setLoadingActiveSession(false);
        return;
      }

      console.log('loadUserData: user is present, starting data fetch');
      setLoading(true);
      setLoadingActiveSession(true);
      try {
        // Завантаження профілю
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          console.log('Profile data found');
          setProfile(userDocSnap.data() as UserProfile);
        } else {
          console.log('Profile data not found');
          setProfile(null);
        }

        // Завантаження логів тренувань
        const logsRef = collection(db, 'workoutLogs');
        const q = query(
          logsRef,
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => doc.data() as WorkoutLog);
        setWorkoutLogs(logs);

        // Завантаження плану тренувань
        const planDocRef = doc(db, 'workoutPlans', user.uid);
        const planDocSnap = await getDoc(planDocRef);
        if (planDocSnap.exists()) {
          console.log('Workout plan found');
          setWorkoutPlan(planDocSnap.data().plan as DailyWorkoutPlan[]);
        } else {
          console.log('Workout plan not found');
          setWorkoutPlan(null);
        }

        // Завантаження активної сесії тренування
        const sessionDocRef = doc(db, 'users', user.uid, 'activeSession', 'current');
        const sessionDocSnap = await getDoc(sessionDocRef);
        if (sessionDocSnap.exists()) {
          setActiveWorkoutSession(sessionDocSnap.data() as { day: number | null; exercises: Exercise[]; startTime: number | null });
          console.log("Активну сесію тренування завантажено з Firestore");
        } else {
          setActiveWorkoutSession(null);
          console.log("Активної сесії тренування у Firestore не знайдено");
        }

      } catch (error: any) {
        console.error('Error loading user data:', error);
        // Встановлюємо null для всіх даних у випадку помилки
        setProfile(null);
        setWorkoutLogs([]);
        setWorkoutPlan(null);
        setActiveWorkoutSession(null);
      } finally {
        setLoading(false);
        setLoadingActiveSession(false);
      }
    };

    if (user && loading) {
      console.log('useUserData: Starting data load...');
      loadUserData();
    } else if (!user && !loading) {
      console.log('useUserData: User is null and state is already reset.');
      setProfile(null);
      setWorkoutLogs([]);
      setWorkoutPlan(null);
      setActiveWorkoutSession(null);
      setLoading(false);
      setLoadingActiveSession(false);
    } else if (!user && loading) {
      console.log('useUserData: User became null while loading was true, resetting state.');
      setProfile(null);
      setWorkoutLogs([]);
      setWorkoutPlan(null);
      setActiveWorkoutSession(null);
      setLoading(false);
      setLoadingActiveSession(false);
    }
  }, [user, loading]);

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
      const logWithUserId = {
        ...log,
        userId: user.uid
      };

      // Use removeUndefined to clean the log object before saving
      const cleanedLog = removeUndefined(logWithUserId);

      console.log('Attempting to save workout log data:', cleanedLog); // Log cleaned data

      const logsRef = collection(db, 'workoutLogs');
      // Pass the cleaned object to setDoc
      await setDoc(doc(logsRef), cleanedLog);

      setWorkoutLogs(prev => [cleanedLog as WorkoutLog, ...prev]); // Update state with cleaned log
    } catch (error) {
      console.error('Error saving workout log:', error);
      throw error;
    }
  };

  // Збереження плану тренувань
  const saveWorkoutPlan = async (plan: DailyWorkoutPlan[]) => {
    if (!user) throw new Error('User not authenticated');
    try {
      console.log('Saving workout plan for user:', user.uid);
      const cleanedPlan = cleanWorkoutPlanForFirestore(plan);
      const docRef = doc(db, 'workoutPlans', user.uid);
      await setDoc(docRef, { plan: cleanedPlan });
      console.log('Successfully saved workout plan to Firestore');
      setWorkoutPlan(cleanedPlan);
    } catch (error) {
      console.error('Error saving workout plan:', error);
      throw error;
    }
  };

  // Збереження активної сесії тренування
  const saveActiveWorkoutSession = async (session: { day: number | null; exercises: Exercise[]; startTime: number | null } | null) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const sessionDocRef = doc(db, 'users', user.uid, 'activeSession', 'current');
      if (session && session.day !== null && session.exercises.length > 0 && session.startTime !== null) {
        const cleanedSession = cleanSessionStateForFirestore(session);
        if (cleanedSession) {
           await setDoc(sessionDocRef, cleanedSession);
           setActiveWorkoutSession(session);
           console.log('Активну сесію тренування збережено у Firestore');
        }
      } else {
        // Видаляємо документ, якщо сесія не активна
        await deleteDoc(sessionDocRef);
        setActiveWorkoutSession(null);
        console.log('Активну сесію тренування видалено з Firestore');
      }
    } catch (error) {
      console.error('Error saving active workout session:', error);
      throw error;
    }
  };

  // Видалення активної сесії тренування
  const clearActiveWorkoutSession = async () => {
     if (!user) return;
     try {
        const sessionDocRef = doc(db, 'users', user.uid, 'activeSession', 'current');
        await deleteDoc(sessionDocRef);
        setActiveWorkoutSession(null);
        console.log('Активну сесію тренування видалено з Firestore (з clear функціі)');
     } catch (error) {
        console.error('Error clearing active workout session:', error);
        // Не викидаємо помилку тут, щоб не блокувати UI, якщо видалення не критичне
     }
  };

  return {
    loading,
    profile,
    workoutLogs,
    workoutPlan,
    activeWorkoutSession,
    loadingActiveSession,
    saveProfile,
    saveWorkoutLog,
    saveWorkoutPlan,
    saveActiveWorkoutSession,
    clearActiveWorkoutSession
  };
}; 