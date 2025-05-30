let timerInterval: number | null = null;
let startTime: number = 0;
let pausedTime: number = 0;
let isPaused: boolean = false;

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case 'START':
      if (!timerInterval) {
        startTime = Date.now() - (data.initialTime || 0);
        timerInterval = self.setInterval(() => {
          if (!isPaused) {
            const elapsed = Date.now() - startTime;
            self.postMessage({ type: 'TICK', time: elapsed });
          }
        }, 1000);
      }
      break;

    case 'PAUSE':
      isPaused = true;
      pausedTime = Date.now();
      break;

    case 'RESUME':
      if (isPaused) {
        const pauseDuration = Date.now() - pausedTime;
        startTime += pauseDuration;
        isPaused = false;
      }
      break;

    case 'STOP':
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      break;
  }
}; 