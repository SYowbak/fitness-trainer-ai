import { useState, useEffect, useRef } from 'react';

export const useTimer = (initialTime: number = 0) => {
  const [time, setTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Створюємо Web Worker
    workerRef.current = new Worker(new URL('../workers/timer.worker.ts', import.meta.url));

    // Обробляємо повідомлення від Worker
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        setTime(e.data.time);
      }
    };

    // Очищаємо при розмонтуванні
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
        workerRef.current.terminate();
      }
    };
  }, []);

  const start = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ 
        type: 'START', 
        data: { initialTime: time } 
      });
      setIsRunning(true);
    }
  };

  const pause = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PAUSE' });
      setIsRunning(false);
    }
  };

  const resume = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESUME' });
      setIsRunning(true);
    }
  };

  const stop = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' });
      setTime(0);
      setIsRunning(false);
    }
  };

  return {
    time,
    isRunning,
    start,
    pause,
    resume,
    stop
  };
}; 