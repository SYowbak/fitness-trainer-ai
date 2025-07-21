import { useCallback, useEffect, useRef } from 'react';

export const useSound = (soundPath: string) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(soundPath);
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [soundPath]);

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Перемотуємо на початок
      audioRef.current.play().catch(error => {
        console.error('Помилка відтворення звуку:', error);
      });
    }
  }, []);

  return { play };
}; 