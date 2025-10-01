import React from 'react';
import { UI_TEXT } from '../constants';

interface ErrorMessageProps {
  message: string;
  onClear?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onClear }) => {
  return (
    <div className="bg-gray-800/80 border border-gray-500/50 text-gray-200 px-4 py-3 rounded-lg relative mb-6 shadow-dark-lg backdrop-blur-sm flex items-start" role="alert">
      <i className="fas fa-exclamation-triangle mr-3 text-xl text-gray-400 mt-1"></i>
      <div>
        <strong className="font-bold text-gray-300">{UI_TEXT.errorOccurred}</strong>
        <span className="block sm:inline ml-1 text-sm text-gray-100">{message}</span>
      </div>
      {onClear && (
        <button 
          onClick={onClear} 
          className="ml-auto pl-3 text-gray-300 hover:text-gray-100 focus:outline-none transition-colors"
          aria-label="Close"
        >
          <i className="fas fa-times text-lg"></i>
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;