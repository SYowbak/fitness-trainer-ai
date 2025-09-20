import React, { useState, useEffect } from 'react';

interface SpinnerProps {
  message?: string;
  showTimer?: boolean;
  processingStep?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ 
  message = "Завантаження...", 
  showTimer = false,
  processingStep = ''
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (showTimer) {
      const timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      
      return () => {
        clearInterval(timer);
        setElapsedTime(0);
      };
    }
  }, [showTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px] p-4 text-center my-6">
      <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-purple-400 border-t-transparent border-solid rounded-full animate-spin mb-4"></div>
      <p className="text-lg sm:text-xl text-gray-300 mb-2">{message}</p>
      
      {processingStep && (
        <p className="text-sm text-purple-300 mb-2">
          <i className="fas fa-cog animate-spin mr-2"></i>
          {processingStep}
        </p>
      )}
      
      {showTimer && (
        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600">
          <p className="text-sm text-gray-400 mb-1">Час обробки:</p>
          <p className="text-xl font-mono text-yellow-400">{formatTime(elapsedTime)}</p>
          {elapsedTime > 30 && (
            <p className="text-xs text-orange-400 mt-1">
              <i className="fas fa-clock mr-1"></i>
              AI обробляє складний запит...
            </p>
          )}
          {elapsedTime > 60 && (
            <p className="text-xs text-red-400 mt-1">
              <i className="fas fa-exclamation-triangle mr-1"></i>
              Незвично довго - можливо проблеми з сервісом
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Spinner;