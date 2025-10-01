import React, { useState, useEffect } from 'react';
import { quotaManager } from '../utils/apiQuotaManager';

interface QuotaStatusProps {
  className?: string;
  showDetailed?: boolean;
}

const QuotaStatus: React.FC<QuotaStatusProps> = ({ 
  className = '',
  showDetailed = false
}) => {
  const [quotaStatus, setQuotaStatus] = useState(quotaManager.getQuotaStatus());

  useEffect(() => {
    const updateStatus = () => {
      setQuotaStatus(quotaManager.getQuotaStatus());
    };

    const interval = setInterval(updateStatus, 30000);
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const getStatusColor = () => {
    if (quotaStatus.isExceeded) return 'text-gray-400';
    if (quotaManager.isServiceOverloaded()) return 'text-orange-400';
    
    const usagePercent = (quotaStatus.requestCount / quotaStatus.dailyLimit) * 100;
    if (usagePercent >= 80) return 'text-orange-400';
    if (usagePercent >= 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusIcon = () => {
    if (quotaStatus.isExceeded) return '⚠️';
    if (quotaManager.isServiceOverloaded()) return '⏳';
    
    const usagePercent = (quotaStatus.requestCount / quotaStatus.dailyLimit) * 100;
    if (usagePercent >= 80) return '🟡';
    return '✅';
  };

  const getUsagePercent = () => {
    return Math.min(100, (quotaStatus.requestCount / quotaStatus.dailyLimit) * 100);
  };

  const getTimeUntilReset = () => {
    const resetTime = quotaManager.getTimeUntilReset();
    const hours = Math.floor(resetTime / (1000 * 60 * 60));
    const minutes = Math.floor((resetTime % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}г ${minutes}хв`;
    }
    return `${minutes}хв`;
  };

  const getStatusMessage = () => {
    if (quotaManager.isServiceOverloaded()) {
      return 'Сервіс AI перевантажений';
    }
    
    if (quotaStatus.isExceeded) {
      return 'Ліміт перевищено';
    }
    
    const remaining = quotaStatus.dailyLimit - quotaStatus.requestCount;
    return `Залишилось: ${remaining}`;
  };

  if (!showDetailed) {
    // Компактний режим для шапки
    return (
      <div className={`inline-flex items-center space-x-2 ${className}`}>
        <span className="text-sm">{getStatusIcon()}</span>
        <span className={`text-xs ${getStatusColor()}`}>
          {quotaStatus.requestCount}/{quotaStatus.dailyLimit}
        </span>
        {quotaStatus.isExceeded && (
          <span className="text-xs text-gray-400">Ліміт</span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon()}</span>
          <h3 className="text-base font-medium text-white">Статус AI</h3>
        </div>
      </div>

      <div className="space-y-3">
        {/* Usage Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">Використано сьогодні</span>
            <span className={getStatusColor()}>
              {quotaStatus.requestCount}/{quotaStatus.dailyLimit}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                quotaStatus.isExceeded 
                  ? 'bg-gray-500' 
                  : getUsagePercent() >= 80 
                    ? 'bg-orange-500' 
                    : getUsagePercent() >= 60 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, getUsagePercent())}%` }}
            ></div>
          </div>
        </div>

        {/* Status Message */}
        <div className="flex items-center justify-between">
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusMessage()}
          </span>
          <span className="text-sm text-gray-400">
            Оновлення: {getTimeUntilReset()}
          </span>
        </div>

        {/* Warning Messages */}
        {quotaStatus.isExceeded && (
          <div className="bg-gray-800/50 border border-gray-600 rounded p-3 mt-3">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">⚠️</span>
              <span className="text-gray-300 text-sm">
                Ліміт перевищено. Оновлення через {getTimeUntilReset()}
              </span>
            </div>
          </div>
        )}
        
        {quotaManager.isServiceOverloaded() && (
          <div className="bg-orange-900/30 border border-orange-700 rounded p-3 mt-3">
            <div className="flex items-center space-x-2">
              <span className="text-orange-400">⏳</span>
              <span className="text-orange-300 text-sm">
                Сервіс перевантажений. Деякі функції можуть бути обмежені.
              </span>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-sm text-gray-400 mt-4 pt-3 border-t border-gray-700">
          <div className="mb-2 font-medium text-gray-300">Що це таке?</div>
          <p>AI допомагає генерувати персональні тренування та адаптувати їх під ваше самопочуття, травми та прогрес. Система відстежує використання для забезпечення стабільної роботи.</p>
        </div>
      </div>
    </div>
  );
};

export default QuotaStatus;