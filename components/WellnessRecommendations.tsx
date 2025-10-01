import React from 'react';
import { WellnessRecommendation } from '../types';
import { UI_TEXT } from '../constants';

interface WellnessRecommendationsProps {
  recommendations: WellnessRecommendation[];
  onClose: () => void;
}

const WellnessRecommendations: React.FC<WellnessRecommendationsProps> = ({
  recommendations,
  onClose
}) => {
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'energy': return 'fas fa-bolt text-yellow-400';
      case 'recovery': return 'fas fa-bed text-blue-400';
      case 'motivation': return 'fas fa-fire text-orange-400';
      case 'stress': return 'fas fa-brain text-purple-400';
      default: return 'fas fa-heart text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-gray-500 bg-gray-800/30';
      case 'medium': return 'border-yellow-500 bg-yellow-900/20';
      case 'low': return 'border-green-500 bg-green-900/20';
      default: return 'border-gray-500 bg-gray-900/20';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'Високий пріоритет';
      case 'medium': return 'Середній пріоритет';
      case 'low': return 'Низький пріоритет';
      default: return 'Пріоритет';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-purple-300">
            <i className="fas fa-heart mr-2"></i>
            {UI_TEXT.wellnessRecommendations}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-thumbs-up text-4xl text-green-400 mb-4"></i>
              <p className="text-gray-300">Ваше самопочуття відмінне! Продовжуйте в тому ж дусі.</p>
            </div>
          ) : (
            recommendations.map((recommendation, index) => (
              <div
                key={`${recommendation.type}-${index}`}
                className={`p-4 rounded-lg border-l-4 ${getPriorityColor(recommendation.priority)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <i className={`${getRecommendationIcon(recommendation.type)} text-2xl`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {recommendation.title}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        recommendation.priority === 'high' ? 'bg-gray-600 text-white' :
                        recommendation.priority === 'medium' ? 'bg-yellow-600 text-white' :
                        'bg-green-600 text-white'
                      }`}>
                        {getPriorityText(recommendation.priority)}
                      </span>
                    </div>
                    
                    <p className="text-gray-300 mb-3">
                      {recommendation.description}
                    </p>
                    
                    {recommendation.actions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">
                          Рекомендовані дії:
                        </h4>
                        <ul className="space-y-1">
                          {recommendation.actions.map((action, actionIndex) => (
                            <li key={`${action}-${actionIndex}`} className="flex items-center text-sm text-gray-300">
                              <i className="fas fa-check-circle text-green-400 mr-2 text-xs"></i>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <i className="fas fa-lightbulb text-blue-400 mt-1"></i>
              <div>
                <h4 className="text-blue-300 font-medium mb-2">Пам'ятайте:</h4>
                <ul className="text-blue-200 text-sm space-y-1">
                  <li>• {UI_TEXT.listenToYourBody}</li>
                  <li>• {UI_TEXT.itsOkayToReduce}</li>
                  <li>• {UI_TEXT.qualityOverQuantity}</li>
                  <li>• {UI_TEXT.consistencyIsKey}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <i className="fas fa-check mr-2"></i>
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
};

export default WellnessRecommendations; 