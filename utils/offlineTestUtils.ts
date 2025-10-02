// Утиліти для тестування офлайн функціональності

export interface OfflineTestResult {
  testName: string;
  passed: boolean;
  message: string;
  timestamp: number;
}

export class OfflineTestSuite {
  private results: OfflineTestResult[] = [];

  // Тест збереження даних офлайн
  async testOfflineDataSaving(): Promise<OfflineTestResult> {
    const testName = 'Збереження даних офлайн';
    try {
      const testData = {
        workoutLogs: [{ id: 'test-1', date: new Date(), exercises: [] }],
        userProfile: { name: 'Test User' },
        workoutPlan: [{ day: 1, exercises: [] }],
        lastSync: Date.now()
      };

      // Імітуємо офлайн режим
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

      // Тестуємо збереження
      localStorage.setItem('fitness-offline-test', JSON.stringify(testData));
      const saved = JSON.parse(localStorage.getItem('fitness-offline-test') || '{}');
      
      // Відновлюємо стан мережі
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, writable: true });
      
      const passed = saved.workoutLogs?.length === 1 && saved.userProfile?.name === 'Test User';
      
      // Очищуємо тестові дані
      localStorage.removeItem('fitness-offline-test');

      return {
        testName,
        passed,
        message: passed ? 'Дані успішно збережено офлайн' : 'Помилка збереження офлайн даних',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Помилка тесту: ${error}`,
        timestamp: Date.now()
      };
    }
  }

  // Тест Service Worker кешування
  async testServiceWorkerCaching(): Promise<OfflineTestResult> {
    const testName = 'Service Worker кешування';
    try {
      if (!('serviceWorker' in navigator)) {
        return {
          testName,
          passed: false,
          message: 'Service Worker не підтримується',
          timestamp: Date.now()
        };
      }

      const registration = await navigator.serviceWorker.ready;
      const cacheNames = await caches.keys();
      const hasFitnessCache = cacheNames.some(name => name.includes('fitness'));

      return {
        testName,
        passed: hasFitnessCache,
        message: hasFitnessCache 
          ? `Знайдено ${cacheNames.length} кешів, включаючи фітнес кеші`
          : 'Фітнес кеші не знайдено',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Помилка тесту Service Worker: ${error}`,
        timestamp: Date.now()
      };
    }
  }

  // Тест офлайн черги синхронізації
  async testOfflineQueue(): Promise<OfflineTestResult> {
    const testName = 'Офлайн черга синхронізації';
    try {
      const testAction = {
        type: 'save_workout_log' as const,
        data: { id: 'test-log', exercises: [] },
        timestamp: Date.now()
      };

      // Додаємо в чергу
      const existingQueue = JSON.parse(localStorage.getItem('fitness-offline-queue') || '[]');
      const newQueue = [...existingQueue, testAction];
      localStorage.setItem('fitness-offline-queue', JSON.stringify(newQueue));

      // Перевіряємо чергу
      const savedQueue = JSON.parse(localStorage.getItem('fitness-offline-queue') || '[]');
      const hasTestAction = savedQueue.some((action: any) => action.data.id === 'test-log');

      // Очищуємо тестові дані
      const cleanQueue = savedQueue.filter((action: any) => action.data.id !== 'test-log');
      localStorage.setItem('fitness-offline-queue', JSON.stringify(cleanQueue));

      return {
        testName,
        passed: hasTestAction,
        message: hasTestAction 
          ? 'Офлайн черга працює коректно'
          : 'Помилка роботи офлайн черги',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Помилка тесту черги: ${error}`,
        timestamp: Date.now()
      };
    }
  }

  // Тест localStorage доступності
  async testLocalStorageAvailability(): Promise<OfflineTestResult> {
    const testName = 'Доступність localStorage';
    try {
      const testKey = 'fitness-storage-test';
      const testValue = 'test-data-' + Date.now();
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      const passed = retrieved === testValue;

      return {
        testName,
        passed,
        message: passed 
          ? 'localStorage працює коректно'
          : 'Проблеми з localStorage',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `localStorage недоступний: ${error}`,
        timestamp: Date.now()
      };
    }
  }

  // Запуск всіх тестів
  async runAllTests(): Promise<OfflineTestResult[]> {
    console.log('🧪 Запуск тестів офлайн функціональності...');
    
    this.results = [];
    
    const tests = [
      this.testLocalStorageAvailability(),
      this.testOfflineDataSaving(),
      this.testServiceWorkerCaching(),
      this.testOfflineQueue()
    ];

    const results = await Promise.all(tests);
    this.results = results;

    // Логування результатів
    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.testName}: ${result.message}`);
    });

    const passedCount = results.filter(r => r.passed).length;
    console.log(`📊 Результат тестування: ${passedCount}/${results.length} тестів пройдено`);

    return results;
  }

  // Отримання результатів
  getResults(): OfflineTestResult[] {
    return this.results;
  }

  // Перевірка загального стану
  getOverallStatus(): { healthy: boolean; score: number; issues: string[] } {
    const results = this.getResults();
    if (results.length === 0) {
      return { healthy: false, score: 0, issues: ['Тести не запущені'] };
    }

    const passedCount = results.filter(r => r.passed).length;
    const score = Math.round((passedCount / results.length) * 100);
    const issues = results.filter(r => !r.passed).map(r => r.message);

    return {
      healthy: score >= 75,
      score,
      issues
    };
  }
}

// Глобальний екземпляр для використання
export const offlineTestSuite = new OfflineTestSuite();
