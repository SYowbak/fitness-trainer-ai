import React, { useState, useEffect } from 'react';
import { quotaManager, clearQuotaExceeded, disableQuotaChecks } from '../utils/apiQuotaManager';

interface QuotaStatusProps {
  className?: string;
  showDetailed?: boolean;
}

const QuotaStatus: React.FC<QuotaStatusProps> = ({ 
  className = '',
  showDetailed = false 
}) => {
  const [quotaStatus, setQuotaStatus] = useState(quotaManager.getQuotaStatus());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setQuotaStatus(quotaManager.getQuotaStatus());
    };

    // Update status every 30 seconds
    const interval = setInterval(updateStatus, 30000);
    
    // Also update when window becomes visible
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
    if (quotaStatus.isExceeded) return 'text-red-400';
    if (quotaManager.isServiceOverloaded()) return 'text-orange-400';
    
    const usagePercent = (quotaStatus.requestCount / quotaStatus.dailyLimit) * 100;
    if (usagePercent >= 80) return 'text-orange-400';
    if (usagePercent >= 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusIcon = () => {
    if (quotaStatus.isExceeded) return 'fas fa-exclamation-triangle';
    if (quotaManager.isServiceOverloaded()) return 'fas fa-hourglass-half';
    
    const usagePercent = (quotaStatus.requestCount / quotaStatus.dailyLimit) * 100;
    if (usagePercent >= 80) return 'fas fa-exclamation-circle';
    return 'fas fa-check-circle';
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
      return 'Сервіс AI тимчасово перевантажений';
    }
    
    if (quotaStatus.isExceeded) {
      return 'Денна квота вичерпана';
    }
    
    const remaining = quotaStatus.dailyLimit - quotaStatus.requestCount;
    return `Залишилось ${remaining} запитів`;
  };

  if (!showDetailed && !isExpanded) {
    return (
      <div 
        className={`inline-flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
        onClick={() => setIsExpanded(true)}
        title="Клікніть для детальної інформації про квоту"
      >
        <i className={`${getStatusIcon()} ${getStatusColor()} text-sm`}></i>
        <span className={`text-sm ${getStatusColor()}`}>
          {quotaStatus.requestCount}/{quotaStatus.dailyLimit}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <i className={`${getStatusIcon()} ${getStatusColor()}`}></i>
          <h3 className="text-lg font-semibold text-white">Статус квоти AI</h3>
        </div>
        {showDetailed && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Usage Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">Використано сьогодні</span>
            <span className={getStatusColor()}>
              {quotaStatus.requestCount}/{quotaStatus.dailyLimit} ({Math.round(getUsagePercent())}%)
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                quotaStatus.isExceeded 
                  ? 'bg-red-500' 
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
          <span className="text-xs text-gray-400">
            Оновлення: {getTimeUntilReset()}
          </span>
        </div>

        {/* Detailed Information */}
        {(isExpanded || showDetailed) && (
          <div className="mt-4 pt-3 border-t border-gray-700 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Денний лімітк:</span>
                <span className="text-white ml-2">{quotaStatus.dailyLimit}</span>
              </div>
              <div>
                <span className="text-gray-400">Залишилось:</span>
                <span className="text-white ml-2">
                  {Math.max(0, quotaStatus.dailyLimit - quotaStatus.requestCount)}
                </span>
              </div>
            </div>
            
            {quotaStatus.isExceeded && (
              <div className="bg-red-900/30 border border-red-700 rounded p-2">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-exclamation-triangle text-red-400"></i>
                  <span className="text-red-300 text-sm">
                    Квота вичерпана. Оновлення через {getTimeUntilReset()}
                  </span>
                </div>
              </div>
            )}
            
            {quotaManager.isServiceOverloaded() && (
              <div className="bg-orange-900/30 border border-orange-700 rounded p-2">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-hourglass-half text-orange-400"></i>
                  <span className="text-orange-300 text-sm">
                    Сервіс перевантажений. Деякі функції обмежені.
                  </span>
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700 rounded">
              <div className="flex items-start space-x-2">
                <i className="fas fa-info-circle text-blue-400 mt-0.5"></i>
                <div className="text-xs text-blue-300 space-y-1">
                  <p>💡 Квота оновлюється щодня о полночі</p>
                  <p>💡 Чат з тренером має найвищий пріоритет</p>
                  <p>💡 Спробуйте згодом, якщо функції недоступні</p>
                </div>
              </div>
            </div>

            {/* Emergency Controls (only in detailed view) */}
            <div className="mt-4 pt-3 border-t border-gray-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">
                <i className="fas fa-tools mr-2"></i>
                Керування квотою
              </h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (confirm('Скинути статус перевищення квоти? Це може допомогти, якщо функції AI блокуються помилково.')) {
                      clearQuotaExceeded();
                      setQuotaStatus(quotaManager.getQuotaStatus());
                    }
                  }}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors"
                  title="Скинути блокування квоти"
                >
                  <i className="fas fa-refresh mr-1"></i>
                  Скинути блокування
                </button>
                <button
                  onClick={() => {
                    if (confirm('Повністю відключити перевірки квоти? Використовуйте обережно - це може призвести до перевищення лімітів Google API.')) {
                      disableQuotaChecks();
                      setQuotaStatus(quotaManager.getQuotaStatus());
                    }
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  title="Відключити всі перевірки квоти (обережно!)"
                >
                  <i className="fas fa-power-off mr-1"></i>
                  Відключити квоту
                </button>
                <button
                  onClick={() => {
                    console.log('Current quota status:', quotaManager.getQuotaStatus());
                    console.log('Can make request:', quotaManager.canMakeRequest());
                    console.log('Is service overloaded:', quotaManager.isServiceOverloaded());
                    alert(`Quota status:\n- Is exceeded: ${quotaManager.getQuotaStatus().isExceeded}\n- Request count: ${quotaManager.getQuotaStatus().requestCount}\n- Can make request: ${quotaManager.canMakeRequest()}`);
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  title="Debug quota status"
                >
                  <i className="fas fa-bug mr-1"></i>
                  Debug Status
                </button>
                <button
                  onClick={() => {
                    quotaManager.resetQuota();
                    setQuotaStatus(quotaManager.getQuotaStatus());
                  }}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
                  title="Повністю скинути квоту до початкового стану"
                >
                  <i className="fas fa-undo mr-1"></i>
                  Повний скид
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotaStatus;