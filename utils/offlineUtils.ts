// Утиліти для роботи в офлайн режимі

export interface OfflineData {
  workoutLogs: any[];
  userProfile: any;
  workoutPlan: any[];
  currentSession?: any;
  lastSync: number;
}

const OFFLINE_STORAGE_KEY = 'fitness-offline-data';
const OFFLINE_QUEUE_KEY = 'fitness-offline-queue';

// Збереження даних для офлайн використання
export function saveOfflineData(data: Partial<OfflineData>): void {
  try {
    const existing = getOfflineData();
    const updated = {
      ...existing,
      ...data,
      lastSync: Date.now()
    };
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updated));
    // console.log('💾 Дані збережено для офлайн використання');
  } catch (error) {
    console.error('❌ Помилка збереження офлайн даних:', error);
  }
}

// Отримання офлайн даних
export function getOfflineData(): OfflineData {
  try {
    const data = localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ Помилка читання офлайн даних:', error);
  }
  
  return {
    workoutLogs: [],
    userProfile: null,
    workoutPlan: [],
    lastSync: 0
  };
}

// Перевірка чи дані свіжі (менше 24 годин)
export function isOfflineDataFresh(): boolean {
  const data = getOfflineData();
  const dayInMs = 24 * 60 * 60 * 1000;
  return (Date.now() - data.lastSync) < dayInMs;
}

// Додавання дії в чергу для синхронізації
export function addToOfflineQueue(action: {
  type: 'save_workout_log' | 'save_profile' | 'save_workout_plan';
  data: any;
  timestamp: number;
}): void {
  try {
    const queue = getOfflineQueue();
    queue.push(action);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('📝 Дію додано в офлайн чергу:', action.type);
  } catch (error) {
    console.error('❌ Помилка додавання в офлайн чергу:', error);
  }
}

// Отримання черги офлайн дій
export function getOfflineQueue(): any[] {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('❌ Помилка читання офлайн черги:', error);
    return [];
  }
}

// Очищення черги після синхронізації
export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    console.log('✅ Офлайн черга очищена');
  } catch (error) {
    console.error('❌ Помилка очищення офлайн черги:', error);
  }
}

// Очищення застарілих офлайн даних
export function clearStaleOfflineData(): void {
  try {
    const data = getOfflineData();
    const now = Date.now();
    const STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 днів
    
    if (data.lastSync && (now - data.lastSync) > STALE_THRESHOLD) {
      console.log('🧹 Очищуємо застарілі офлайн дані (старше 7 днів)');
      localStorage.removeItem(OFFLINE_STORAGE_KEY);
    }
  } catch (error) {
    console.error('❌ Помилка очищення застарілих даних:', error);
  }
}

// Перевірка чи localStorage не переповнений
export function checkLocalStorageHealth(): boolean {
  try {
    const testKey = 'localStorage_test';
    const testData = 'x'.repeat(1024); // 1KB тест
    localStorage.setItem(testKey, testData);
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('⚠️ localStorage може бути переповнений:', error);
    return false;
  }
}

// Перевірка статусу мережі
export function isOnline(): boolean {
  return navigator.onLine;
}

// Обробка офлайн помилок API
export function handleOfflineError(error: any, fallbackData?: any) {
  if (!isOnline()) {
    console.log('📵 Офлайн режим - використовуємо кешовані дані');
    return fallbackData || getOfflineData();
  }
  throw error;
}

// Синхронізація офлайн черги при відновленні мережі
export async function syncOfflineQueue(
  syncFunctions: {
    saveWorkoutLog: (data: any) => Promise<void>;
    saveProfile: (data: any) => Promise<void>;
    saveWorkoutPlan: (data: any) => Promise<void>;
  }
): Promise<void> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`🔄 Синхронізація ${queue.length} офлайн дій...`);

  for (const action of queue) {
    try {
      switch (action.type) {
        case 'save_workout_log':
          await syncFunctions.saveWorkoutLog(action.data);
          break;
        case 'save_profile':
          await syncFunctions.saveProfile(action.data);
          break;
        case 'save_workout_plan':
          await syncFunctions.saveWorkoutPlan(action.data);
          break;
      }
      console.log('✅ Синхронізовано:', action.type);
    } catch (error) {
      console.error('❌ Помилка синхронізації:', action.type, error);
      // Не видаляємо з черги при помилці
      return;
    }
  }

  clearOfflineQueue();
  console.log('🎉 Офлайн синхронізація завершена');
}
