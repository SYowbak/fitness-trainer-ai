import React, { useState, useEffect } from 'react';
import { quotaManager, clearQuotaExceeded } from '../utils/apiQuotaManager';

interface QuotaStatusProps {
  className?: string;
  showDetailed?: boolean;
}

const QuotaStatus: React.FC<QuotaStatusProps> = ({ 
  className = '',
  showDetailed = false
}) => {
  const [quotaStatus, setQuotaStatus] = useState(quotaManager.getQuotaStatus());
  const [isVisible, setIsVisible] = useState(true);

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
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusMessage = () => {
    if (quotaManager.isServiceOverloaded()) {
      return 'AI service temporarily overloaded';
    }
    
    if (quotaStatus.isExceeded) {
      return 'Daily quota exceeded';
    }
    
    const remaining = quotaStatus.dailyLimit - quotaStatus.requestCount;
    return `${remaining} requests remaining`;
  };

  if (!showDetailed) {
    return (
      <div className={`relative ${className}`}>
        {/* Compact Header Indicator */}
        {isVisible ? (
          <div className="inline-flex items-center space-x-2 cursor-pointer">
            <i className={`${getStatusIcon()} ${getStatusColor()} text-sm`}></i>
            <span className={`text-sm ${getStatusColor()}`}>
              {quotaStatus.requestCount}/{quotaStatus.dailyLimit}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="text-gray-500 hover:text-gray-300 text-xs ml-1"
              title="Hide quota status"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsVisible(true)}
            className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
            title="Show quota status"
          >
            <i className="fas fa-chart-bar"></i>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <i className={`${getStatusIcon()} ${getStatusColor()}`}></i>
          <h3 className="text-lg font-semibold text-white">AI Quota Status</h3>
        </div>
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
            Reset: {getTimeUntilReset()}
          </span>
        </div>

        {/* Detailed Information */}
        {showDetailed && (
          <div className="mt-4 pt-3 border-t border-gray-700 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Daily Limit:</span>
                <span className="text-white ml-2">{quotaStatus.dailyLimit}</span>
              </div>
              <div>
                <span className="text-gray-400">Remaining:</span>
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
                    Quota exceeded. Reset in {getTimeUntilReset()}
                  </span>
                </div>
              </div>
            )}
            
            {quotaManager.isServiceOverloaded() && (
              <div className="bg-orange-900/30 border border-orange-700 rounded p-2">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-hourglass-half text-orange-400"></i>
                  <span className="text-orange-300 text-sm">
                    Service overloaded. Some features may be limited.
                  </span>
                </div>
              </div>
            )}

            {/* Debug Controls (Development Only) */}
            {import.meta.env.DEV && (
              <div className="mt-3 p-2 bg-purple-900/20 border border-purple-700 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <i className="fas fa-code text-purple-400"></i>
                  <span className="text-xs text-purple-300 font-semibold">Debug Controls</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      clearQuotaExceeded();
                      setQuotaStatus(quotaManager.getQuotaStatus());
                    }}
                    className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors"
                  >
                    🗑️ Clear Exceeded
                  </button>
                  <button
                    onClick={() => {
                      quotaManager.resetQuota();
                      setQuotaStatus(quotaManager.getQuotaStatus());
                    }}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                  >
                    🔄 Reset Quota
                  </button>
                </div>
              </div>
            )}

            {/* Reset Block Button (Production Safe) */}
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    if (confirm('Reset quota exceeded status? This may help if AI features are blocked incorrectly.')) {
                      clearQuotaExceeded();
                      setQuotaStatus(quotaManager.getQuotaStatus());
                    }
                  }}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
                  title="Reset quota block"
                >
                  <i className="fas fa-refresh mr-2"></i>
                  Reset Block
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