import { useState, useRef, useEffect, useCallback } from 'react';

// Простий useTimer hook, який повертає час у секундах та базові керування
export const useTimer = () => {
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (intervalRef.current !== null) return;
    setIsRunning(true);
    const startTs = Date.now() - time * 1000;
    intervalRef.current = window.setInterval(() => {
      setTime(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);
  }, [time]);

  const pause = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (intervalRef.current !== null) return;
    setIsRunning(true);
    const startTs = Date.now() - time * 1000;
    intervalRef.current = window.setInterval(() => {
      setTime(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);
  }, [time]);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setTime(0);
  }, []);

  // Очищення при розмонтуванні (unmount)
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { time, isRunning, start, pause, resume, stop } as const;
};

export default useTimer;
