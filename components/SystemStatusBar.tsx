import React, { useState, useEffect } from 'react';
import { offlineTestSuite } from '../utils/offlineTestUtils';
import { getOfflineQueue } from '../utils/offlineUtils';

interface SystemStatusBarProps {
  isNetworkOnline: boolean;
}

const SystemStatusBar: React.FC<SystemStatusBarProps> = ({ isNetworkOnline }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<{
    speed: 'fast' | 'medium' | 'slow' | 'offline';
    effectiveType: string;
    downlink: number;
  }>({ speed: 'medium', effectiveType: 'unknown', downlink: 0 });
  const [offlineHealthStatus, setOfflineHealthStatus] = useState({ healthy: true, score: 100, issues: [] as string[] });
  const [healthTestsRun, setHealthTestsRun] = useState(false);

  // Оновлення статусів
  useEffect(() => {
    const updateStatuses = () => {
      // Офлайн черга
      const queue = getOfflineQueue();
      setOfflineQueueCount(queue.length);

      // Якість мережі
      if (isNetworkOnline) {
        if ('connection' in navigator) {
          const connection = (navigator as any).connection;
          const effectiveType = connection?.effectiveType || 'unknown';
          const downlink = connection?.downlink || 0;
          let speed: 'fast' | 'medium' | 'slow' | 'offline' = 'medium';
          
          // Більш реалістична логіка
          if (downlink > 5) {
            speed = 'fast';
          } else if (downlink > 1) {
            speed = 'medium';
          } else if (downlink > 0) {
            speed = 'slow';
          } else {
            // Якщо downlink недоступний, визначаємо за effectiveType
            if (effectiveType === '4g') {
              speed = 'fast';
            } else if (effectiveType === '3g') {
              speed = 'medium';
            } else if (effectiveType === '2g') {
              speed = 'slow';
            } else {
              speed = 'medium'; // За замовчуванням
            }
          }
          
          // Логуємо тільки при зміні даних
          if (networkQuality.effectiveType !== effectiveType || Math.abs(networkQuality.downlink - downlink) > 0.5) {
            console.log('🌐 Network changed:', { effectiveType, downlink, speed });
          }

          setNetworkQuality({ speed, effectiveType, downlink });
        } else {
          // Якщо Network API недоступний
          console.log('🌐 Network API not available, using fallback');
          setNetworkQuality({ speed: 'medium', effectiveType: 'unknown', downlink: 0 });
        }
      } else {
        setNetworkQuality({ speed: 'offline', effectiveType: 'offline', downlink: 0 });
      }

      // Офлайн здоров'я - запускаємо тести тільки один раз
      if (!healthTestsRun) {
        offlineTestSuite.runAllTests().then(() => {
          const healthStatus = offlineTestSuite.getOverallStatus();
          setOfflineHealthStatus(healthStatus);
          setHealthTestsRun(true);
        });
      } else {
        const healthStatus = offlineTestSuite.getOverallStatus();
        setOfflineHealthStatus(healthStatus);
      }
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 5000);
    return () => clearInterval(interval);
  }, [isNetworkOnline, healthTestsRun]);

  const getNetworkIcon = () => {
    if (!isNetworkOnline) return 'fa-exclamation-triangle'; // Використовуємо більш надійну іконку
    
    // Показуємо різні іконки залежно від типу мережі
    if (networkQuality.effectiveType === 'wifi') return 'fa-wifi';
    if (networkQuality.effectiveType === '4g') return 'fa-signal';
    if (networkQuality.effectiveType === '3g') return 'fa-signal';
    if (networkQuality.effectiveType === '2g') return 'fa-signal';
    
    return 'fa-wifi'; // За замовчуванням
  };

  const getNetworkColor = () => {
    if (!isNetworkOnline) return 'text-red-300';
    switch (networkQuality.speed) {
      case 'fast': return 'text-green-300';
      case 'medium': return 'text-yellow-300';
      case 'slow': return 'text-orange-300';
      default: return 'text-red-300';
    }
  };

  const getNetworkTitle = () => {
    if (!isNetworkOnline) return 'Офлайн режим';
    
    const type = networkQuality.effectiveType === 'unknown' ? 'Невідомо' : 
                 networkQuality.effectiveType === 'wifi' ? 'WiFi' : 
                 networkQuality.effectiveType.toUpperCase();
    
    const speedText = networkQuality.speed === 'fast' ? 'Швидка' : 
                     networkQuality.speed === 'medium' ? 'Середня' : 'Повільна';
    
    let title = `${type} - ${speedText} мережа`;
    
    if (networkQuality.downlink > 0) {
      title += ` (${networkQuality.downlink.toFixed(1)} Mbps)`;
    } else if (networkQuality.effectiveType === 'unknown') {
      title += ' (дані недоступні)';
    }
    
    return title;
  };

  return (
    <div className="flex items-center space-x-1 relative">
      {/* Індикатор мережі */}
      <div 
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer border-2 relative ${
          isNetworkOnline 
            ? networkQuality.speed === 'fast' ? 'bg-green-900/50 border-green-500/70 hover:bg-green-800/60' :
              networkQuality.speed === 'medium' ? 'bg-yellow-900/50 border-yellow-500/70 hover:bg-yellow-800/60' :
              'bg-orange-900/50 border-orange-500/70 hover:bg-orange-800/60'
            : 'bg-red-900/50 border-red-500/70 hover:bg-red-800/60 animate-pulse'
        }`}
        title={getNetworkTitle()}
        onClick={() => setShowDetails(!showDetails)}
      >
        {!isNetworkOnline ? (
          <span className="absolute inset-0 flex items-center justify-center text-red-300 text-[10px] font-bold leading-none">⚠</span>
        ) : (
          <i className={`absolute inset-0 flex items-center justify-center fas ${getNetworkIcon()} text-[10px] ${getNetworkColor()} leading-none`}></i>
        )}
      </div>

      {/* Статус синхронізації */}
      {offlineQueueCount > 0 && (
        <div 
          className="w-5 h-5 rounded-full flex items-center justify-center bg-blue-900/50 hover:bg-blue-800/60 border-2 border-blue-500/70 cursor-pointer transition-all duration-300 relative"
          title={`Синхронізація: ${offlineQueueCount} елементів в черзі`}
          onClick={() => setShowDetails(!showDetails)}
        >
          <i className="absolute inset-0 flex items-center justify-center fas fa-sync text-[10px] text-blue-300 animate-spin leading-none"></i>
          {offlineQueueCount > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-[6px] text-white font-bold">{offlineQueueCount > 9 ? '9+' : offlineQueueCount}</span>
            </div>
          )}
        </div>
      )}

      {/* Офлайн здоров'я */}
      {(process.env.NODE_ENV === 'development' || !offlineHealthStatus.healthy) && (
        <div 
          className={`w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-2 relative ${
            offlineHealthStatus.healthy 
              ? 'bg-green-900/50 border-green-500/70 hover:bg-green-800/60' 
              : 'bg-red-900/50 border-red-500/70 hover:bg-red-800/60 animate-pulse'
          }`}
          title={`Система: ${offlineHealthStatus.healthy ? 'Здорова' : offlineHealthStatus.issues.join(', ')} (${offlineHealthStatus.score}%)`}
          onClick={() => setShowDetails(!showDetails)}
        >
          <i className={`absolute inset-0 flex items-center justify-center fas ${offlineHealthStatus.healthy ? 'fa-check-circle' : 'fa-exclamation-triangle'} text-[10px] leading-none ${
            offlineHealthStatus.healthy ? 'text-green-300' : 'text-red-300'
          }`}></i>
        </div>
      )}

      {/* Детальна інформація */}
      {showDetails && (
        <div className="absolute top-6 right-0 bg-gray-900 text-white rounded-lg shadow-xl p-3 min-w-48 text-xs border border-fitness-gold-600/30 z-[70]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-fitness-gold-400">Мережа:</span>
              <span className={isNetworkOnline ? 'text-green-400' : 'text-red-400'}>
                {isNetworkOnline ? 'Онлайн' : 'Офлайн'}
              </span>
            </div>
            
            {isNetworkOnline && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-fitness-gold-400">Тип:</span>
                  <span className="text-white">
                    {networkQuality.effectiveType === 'unknown' ? 'Невідомо' :
                     networkQuality.effectiveType === 'wifi' ? 'WiFi' : 
                     networkQuality.effectiveType.toUpperCase()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-fitness-gold-400">Швидкість:</span>
                  <span className="text-white">
                    {networkQuality.downlink > 0 ? 
                      `${networkQuality.downlink.toFixed(1)} Mbps` : 
                      'Недоступно'
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-fitness-gold-400">API підтримка:</span>
                  <span className="text-white">
                    {'connection' in navigator ? 'Доступно' : 'Недоступно'}
                  </span>
                </div>
              </>
            )}

            {offlineQueueCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-fitness-gold-400">Синхронізація:</span>
                <span className="text-blue-400">{offlineQueueCount} елементів</span>
              </div>
            )}

            {(process.env.NODE_ENV === 'development' || !offlineHealthStatus.healthy) && (
              <div className="flex items-center justify-between">
                <span className="text-fitness-gold-400">Система:</span>
                <span className={offlineHealthStatus.healthy ? 'text-green-400' : 'text-red-400'}>
                  {offlineHealthStatus.healthy ? 'Здорова' : `${offlineHealthStatus.score}%`}
                </span>
              </div>
            )}

            {!offlineHealthStatus.healthy && offlineHealthStatus.issues.length > 0 && (
              <div className="mt-2 p-2 bg-red-900/30 rounded border border-red-500/50">
                <div className="text-red-300 text-[10px] font-semibold mb-1">Проблеми:</div>
                {offlineHealthStatus.issues.map((issue, index) => (
                  <div key={index} className="text-red-300 text-[10px]">• {issue}</div>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={() => setShowDetails(false)}
            className="absolute top-1 right-1 text-fitness-gold-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-full w-4 h-4 flex items-center justify-center"
          >
            <i className="fas fa-times text-[8px]"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default SystemStatusBar;
