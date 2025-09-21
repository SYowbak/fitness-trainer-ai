import React, { useState } from 'react';
import { WellnessCheck, EnergyLevel, SleepQuality, StressLevel } from '../types';
import { UI_TEXT } from '../constants';

interface WellnessCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (wellnessCheck: WellnessCheck) => void;
  onSkip: () => void;
}

const WellnessCheckModal: React.FC<WellnessCheckModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSkip
}) => {
  const [wellnessCheck, setWellnessCheck] = useState<WellnessCheck>({
    energyLevel: EnergyLevel.NORMAL,
    sleepQuality: SleepQuality.GOOD,
    stressLevel: StressLevel.LOW,
    motivation: 7,
    fatigue: 3,
    notes: '',
    timestamp: new Date()
  });

  const handleSubmit = () => {
    onSubmit({
      ...wellnessCheck,
      timestamp: new Date()
    });
  };

  const getEnergyLevelText = (level: EnergyLevel) => {
    switch (level) {
      case EnergyLevel.VERY_LOW: return UI_TEXT.veryLow;
      case EnergyLevel.LOW: return UI_TEXT.low;
      case EnergyLevel.NORMAL: return UI_TEXT.normal;
      case EnergyLevel.HIGH: return UI_TEXT.high;
      case EnergyLevel.VERY_HIGH: return UI_TEXT.veryHigh;
      default: return UI_TEXT.normal;
    }
  };

  const getSleepQualityText = (quality: SleepQuality) => {
    switch (quality) {
      case SleepQuality.POOR: return UI_TEXT.poor;
      case SleepQuality.FAIR: return UI_TEXT.fair;
      case SleepQuality.GOOD: return UI_TEXT.good;
      case SleepQuality.EXCELLENT: return UI_TEXT.excellent;
      default: return UI_TEXT.good;
    }
  };

  const getStressLevelText = (level: StressLevel) => {
    switch (level) {
      case StressLevel.HIGH: return UI_TEXT.stressHigh;
      case StressLevel.MODERATE: return UI_TEXT.stressModerate;
      case StressLevel.LOW: return UI_TEXT.stressLow;
      default: return UI_TEXT.stressLow;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-purple-300">
            <i className="fas fa-heart mr-2"></i>
            {UI_TEXT.wellnessCheck}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="space-y-6">
          {/* Рівень енергії */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <i className="fas fa-bolt mr-2"></i>
              {UI_TEXT.energyLevel}
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(EnergyLevel).map((level) => (
                <button
                  key={level}
                  onClick={() => setWellnessCheck(prev => ({ ...prev, energyLevel: level }))}
                  className={`flex-1 text-center p-3 rounded text-xs sm:text-sm transition-colors ${
                    wellnessCheck.energyLevel === level
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {getEnergyLevelText(level)}
                </button>
              ))}
            </div>
          </div>

          {/* Якість сну */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <i className="fas fa-bed mr-2"></i>
              {UI_TEXT.sleepQuality}
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(SleepQuality).map((quality) => (
                <button
                  key={quality}
                  onClick={() => setWellnessCheck(prev => ({ ...prev, sleepQuality: quality }))}
                  className={`flex-1 text-center p-3 rounded text-xs sm:text-sm transition-colors ${
                    wellnessCheck.sleepQuality === quality
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {getSleepQualityText(quality)}
                </button>
              ))}
            </div>
          </div>

          {/* Рівень стресу */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <i className="fas fa-brain mr-2"></i>
              {UI_TEXT.stressLevel}
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(StressLevel).map((level) => (
                <button
                  key={level}
                  onClick={() => setWellnessCheck(prev => ({ ...prev, stressLevel: level }))}
                  className={`flex-1 text-center p-3 rounded text-xs sm:text-sm transition-colors ${
                    wellnessCheck.stressLevel === level
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {getStressLevelText(level)}
                </button>
              ))}
            </div>
          </div>

          {/* Мотивація */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <i className="fas fa-fire mr-2"></i>
              {UI_TEXT.motivation} (1-10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={wellnessCheck.motivation}
              onChange={(e) => setWellnessCheck(prev => ({ 
                ...prev, 
                motivation: parseInt(e.target.value) 
              }))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1</span>
              <span className="text-purple-400 font-medium">{wellnessCheck.motivation}</span>
              <span>10</span>
            </div>
          </div>

          {/* Втома */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <i className="fas fa-tired mr-2"></i>
              {UI_TEXT.fatigue} (1-10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={wellnessCheck.fatigue}
              onChange={(e) => setWellnessCheck(prev => ({ 
                ...prev, 
                fatigue: parseInt(e.target.value) 
              }))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1</span>
              <span className="text-red-400 font-medium">{wellnessCheck.fatigue}</span>
              <span>10</span>
            </div>
          </div>

          {/* Нотатки */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-sticky-note mr-2"></i>
              {UI_TEXT.addNotes}
            </label>
            <textarea
              value={wellnessCheck.notes || ''}
              onChange={(e) => setWellnessCheck(prev => ({ 
                ...prev, 
                notes: e.target.value 
              }))}
              placeholder="Додаткові коментарі про самопочуття..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 placeholder-gray-400 focus:outline-none focus:border-purple-500"
              rows={3}
            />
          </div>

          {/* Кнопки */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <i className="fas fa-info-circle text-blue-400 mt-0.5"></i>
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">Про AI адаптацію:</p>
                <ul className="text-xs space-y-1">
                  <li>• Адаптує план під ваш стан</li>
                  <li>• Обробка: 30-90 секунд</li>
                  <li>• Лише AI-генеровані плани</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-center gap-4 pt-4">
            <button
              onClick={onSkip}
              className="w-full sm:w-auto px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              <i className="fas fa-forward mr-2"></i>
              Пропустити
            </button>
            <button
              onClick={handleSubmit}
              className="w-full sm:w-auto px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              <i className="fas fa-magic mr-2"></i>
              Генерувати AI план
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WellnessCheckModal; 