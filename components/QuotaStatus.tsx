import React from 'react';
import { quotaManager } from '../utils/apiQuotaManager';

interface QuotaStatusProps {
  className?: string;
}

const QuotaStatus: React.FC<QuotaStatusProps> = ({ className = '' }) => {
  const [statusMessage, setStatusMessage] = React.useState('');
  const [canMakeRequests, setCanMakeRequests] = React.useState(true);

  React.useEffect(() => {
    const updateStatus = () => {
      setStatusMessage(quotaManager.getStatusMessage());
      setCanMakeRequests(quotaManager.canMakeRequest());
    };

    updateStatus();
    
    // Update every minute
    const interval = setInterval(updateStatus, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (canMakeRequests) {
      const status = quotaManager.getQuotaStatus();
      const remaining = status.dailyLimit - status.requestCount;
      
      if (remaining > 20) return 'text-green-400';
      if (remaining > 10) return 'text-yellow-400';
      if (remaining > 5) return 'text-orange-400';
    }
    return 'text-red-400';
  };

  const getStatusIcon = () => {
    if (canMakeRequests) {
      const status = quotaManager.getQuotaStatus();
      const remaining = status.dailyLimit - status.requestCount;
      
      if (remaining > 20) return 'fas fa-check-circle';
      if (remaining > 10) return 'fas fa-exclamation-triangle';
      if (remaining > 5) return 'fas fa-exclamation-circle';
    }
    return 'fas fa-times-circle';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <i className={`${getStatusIcon()} ${getStatusColor()}`}></i>
      <span className={`text-xs ${getStatusColor()}`}>
        {statusMessage}
      </span>
    </div>
  );
};

export default QuotaStatus;