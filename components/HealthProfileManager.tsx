import React, { useState, useEffect, FC } from 'react';
import { UserProfile, HealthCondition } from '../types';
import { HealthProfileService } from '../services/healthProfileService';

interface HealthProfileManagerProps {
  userProfile: UserProfile;
  existingProfile?: UserProfile | null;
  onUpdateProfile: (profile: UserProfile) => void;
  onDirectSave: (profile: UserProfile) => void;
  onAdaptExistingPlan?: (profile: UserProfile) => void;
  hasExistingPlan?: boolean;
}

export const HealthProfileManager: FC<HealthProfileManagerProps> = ({
  userProfile,
  existingProfile,
  onUpdateProfile,
  onDirectSave,
  onAdaptExistingPlan,
  hasExistingPlan = false
}) => {
  const [isAddingCondition, setIsAddingCondition] = useState(false);
  const [newCondition, setNewCondition] = useState({
    condition: '',
    type: 'temporary' as 'chronic' | 'temporary' | 'recovering',
    severity: 'moderate' as 'mild' | 'moderate' | 'severe',
    affectedAreas: '',
    notes: ''
  });

  // Отримуємо початковий профіль, використовуючи існуючий або новий
  const initialProfile = existingProfile || userProfile;
  // Мігруємо старі дані, якщо потрібно
  const migratedProfile = HealthProfileService.migrateOldHealthConstraints(initialProfile);
  
  // Отримуємо поточний профіль здоров'я або створюємо новий
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(migratedProfile);
  
  // Синхронізуємо currentProfile з переданим userProfile (пріоритет userProfile)
  useEffect(() => {
    const newProfile = userProfile || existingProfile;
    const migratedNewProfile = HealthProfileService.migrateOldHealthConstraints(newProfile);
    setCurrentProfile(migratedNewProfile);
  }, [userProfile, existingProfile]);
  
  const healthProfile = currentProfile.healthProfile || HealthProfileService.createInitialHealthProfile();
  
  // Створюємо безпечний профіль здоров'я з гарантованими полями
  const safeHealthProfile = {
    ...healthProfile,
    conditions: healthProfile.conditions || [],
    currentLimitations: healthProfile.currentLimitations || [],
    systemMemory: healthProfile.systemMemory || { rememberedFacts: [], adaptationHistory: [] }
  };

  const handleAddCondition = async () => {
    if (!newCondition.condition.trim()) return;

    console.log('🔵 [handleAddCondition] Додаємо нову проблему:', newCondition);

    const conditionToAdd: any = {
      condition: newCondition.condition.trim(),
      type: newCondition.type,
      severity: newCondition.severity,
      affectedAreas: newCondition.affectedAreas.split(',').map(area => area.trim()).filter(area => area),
      startDate: new Date(),
      isActive: true
    };

    // Додаємо notes тільки якщо є текст
    if (newCondition.notes.trim()) {
      conditionToAdd.notes = newCondition.notes.trim();
    }

    console.log('🔵 [handleAddCondition] Створено об\'єкт проблеми:', conditionToAdd);
    console.log('🔵 [handleAddCondition] Поточний профіль здоров\'я:', safeHealthProfile);

    const updatedHealthProfile = HealthProfileService.addHealthCondition(safeHealthProfile, conditionToAdd);
    
    console.log('🔵 [handleAddCondition] Оновлений профіль здоров\'я:', updatedHealthProfile);
    
    // Позначаємо що потрібна повторна адаптація плану
    if (updatedHealthProfile.planAdaptationStatus) {
      updatedHealthProfile.planAdaptationStatus.needsReAdaptation = true;
    }
    
    const updatedProfile = { ...currentProfile, healthProfile: updatedHealthProfile };

    // Миттєво оновлюємо UI
    setIsAddingCondition(false);
    setNewCondition({ condition: '', type: 'temporary', severity: 'moderate', affectedAreas: '', notes: '' });

    try {
      await onDirectSave(updatedProfile);
      console.log('✅ [HealthProfileManager.handleAddCondition] Проблему здоров\'я успішно додано, потрібна повторна адаптація плану');
    } catch (error) {
      console.error('❌ [HealthProfileManager.handleAddCondition] Помилка при збереженні:', error);
    }
  };

  const handleDeactivateCondition = async (conditionId: string) => {
    
    // Деактивуємо умову в профілі здоров'я
    const updatedHealthProfile = HealthProfileService.deactivateCondition(
      safeHealthProfile,
      conditionId
    );

    // Оновлюємо профіль з деактивованою умовою
    const updatedProfile = {
      ...currentProfile,
      healthProfile: updatedHealthProfile
    };

    // Миттєво оновлюємо UI
    setCurrentProfile(updatedProfile);
    
    try {
      await onDirectSave(updatedProfile);
    } catch (error) {
      console.error('Помилка при деактивації проблеми:', error);
      alert('Помилка при збереженні. Зміни застосовано локально, але не збережено на сервері.');
    }
  };

  const handleDeleteCondition = async (conditionId: string) => {
    console.log('🗑️ [handleDeleteCondition] Видаляємо проблему:', conditionId);
    
    // Повністю видаляємо проблему з масиву
    const updatedHealthProfile = {
      ...safeHealthProfile,
      conditions: safeHealthProfile.conditions.filter(c => c.id !== conditionId)
    };

    // Оновлюємо поточні обмеження
    const finalHealthProfile = HealthProfileService.updateCurrentLimitations(updatedHealthProfile);
    
    // Оновлюємо профіль
    const updatedProfile = {
      ...currentProfile,
      healthProfile: finalHealthProfile
    };

    // Миттєво оновлюємо UI
    setCurrentProfile(updatedProfile);
    
    try {
      await onDirectSave(updatedProfile);
      console.log('✅ [handleDeleteCondition] Проблему успішно видалено');
    } catch (error) {
      console.error('❌ [handleDeleteCondition] Помилка при видаленні:', error);
      alert('Помилка при збереженні. Зміни застосовано локально, але не збережено на сервері.');
    }
  };

  const handleClearMemory = async (type: 'facts' | 'history' | 'all') => {
    let confirmMessage = '';
    let updatedHealthProfile = { ...safeHealthProfile };

    switch (type) {
      case 'facts':
        confirmMessage = 'Ви впевнені, що хочете очистити всі запам\'ятовані факти? Система забуде все, що знала про вас.';
        if (confirm(confirmMessage)) {
          updatedHealthProfile = HealthProfileService.clearRememberedFacts(safeHealthProfile);
        } else {
          return;
        }
        break;
      case 'history':
        confirmMessage = 'Ви впевнені, що хочете очистити історію адаптацій? Це видалить всі записи про попередні зміни тренувань.';
        if (confirm(confirmMessage)) {
          updatedHealthProfile = HealthProfileService.clearAdaptationHistory(safeHealthProfile);
        } else {
          return;
        }
        break;
      case 'all':
        confirmMessage = 'Ви впевнені, що хочете повністю очистити пам\'ять системи? Це видалить ВСІ запам\'ятовані факти та історію адаптацій. Цю дію неможливо скасувати!';
        if (confirm(confirmMessage)) {
          updatedHealthProfile = HealthProfileService.clearSystemMemory(safeHealthProfile);
        } else {
          return;
        }
        break;
    }

    // Створюємо оновлений профіль з новим станом пам'яті
    const updatedProfile = {
      ...currentProfile,
      healthProfile: updatedHealthProfile
    };
    
    // Миттєво оновлюємо UI
    setCurrentProfile(updatedProfile);
    
    try {
      await onDirectSave(updatedProfile);
    } catch (error) {
      console.error('Помилка при очищенні пам\'яті:', error);
      alert('Помилка при збереженні. Зміни застосовано локально, але не збережено на сервері.');
    }
  };
  
  const activeConditions = safeHealthProfile.conditions.filter(c => c.isActive);
  const inactiveConditions = safeHealthProfile.conditions.filter(c => !c.isActive);
  

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-lg font-medium text-gray-200 mb-3">Профіль здоров'я</h3>
        
        {/* Поточні обмеження */}
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-gray-200 mb-2 text-sm">Поточні обмеження:</h4>
          {safeHealthProfile.currentLimitations.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {safeHealthProfile.currentLimitations.map((limitation, index) => (
                <span key={index} className="px-2 py-1 bg-red-600/30 text-red-200 border border-red-500 rounded-full text-xs">
                  {limitation}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-xs">Немає активних обмежень</p>
          )}
        </div>

        {/* Статус адаптації плану */}
        {safeHealthProfile.planAdaptationStatus && (
          <div className={`border rounded-lg p-3 mb-4 ${
            safeHealthProfile.planAdaptationStatus.needsReAdaptation 
              ? 'bg-yellow-900/30 border-yellow-600' 
              : 'bg-green-900/30 border-green-600'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className={`font-medium text-sm ${
                  safeHealthProfile.planAdaptationStatus.needsReAdaptation 
                    ? 'text-yellow-200' 
                    : 'text-green-200'
                }`}>
                  {safeHealthProfile.planAdaptationStatus.needsReAdaptation 
                    ? '⚠️ План потребує оновлення' 
                    : '✅ План адаптовано під ваші проблеми'}
                </h4>
                <p className={`text-xs mt-1 ${
                  safeHealthProfile.planAdaptationStatus.needsReAdaptation 
                    ? 'text-yellow-300' 
                    : 'text-green-300'
                }`}>
                  {safeHealthProfile.planAdaptationStatus.needsReAdaptation 
                    ? 'Додано нові проблеми здоров\'я. Натисніть кнопку адаптації нижче.' 
                    : `Останнє оновлення: ${new Date(safeHealthProfile.planAdaptationStatus.lastAdaptedDate).toLocaleDateString('uk-UA')}`}
                </p>
                
                {/* Показуємо адаптовані та неадаптовані проблеми */}
                {(() => {
                  const activeConditionNames = activeConditions.map(c => c.condition);
                  const adaptedConditions = safeHealthProfile.planAdaptationStatus.adaptedConditions;
                  const notAdaptedConditions = activeConditionNames.filter(condition => 
                    !adaptedConditions.includes(condition)
                  );
                  
                  return (
                    <div className="mt-2 space-y-2">
                      {/* Адаптовані проблеми */}
                      {adaptedConditions.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Адаптовано в поточному плані:</p>
                          <div className="flex flex-wrap gap-1">
                            {adaptedConditions.map((condition, index) => (
                              <span key={index} className="px-2 py-1 rounded-full text-xs bg-green-700/50 text-green-200 border border-green-600">
                                ✅ {condition}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Неадаптовані проблеми */}
                      {notAdaptedConditions.length > 0 && (
                        <div>
                          <p className="text-xs text-yellow-400 mb-1">Потребують адаптації:</p>
                          <div className="flex flex-wrap gap-1">
                            {notAdaptedConditions.map((condition, index) => (
                              <span key={index} className="px-2 py-1 rounded-full text-xs bg-yellow-700/50 text-yellow-200 border border-yellow-600">
                                ⚠️ {condition}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Пам'ять системи */}
        {safeHealthProfile.systemMemory.rememberedFacts.length > 0 && (
          <details className="bg-gray-700/50 border border-gray-600 rounded-lg mb-4">
            <summary className="p-3 cursor-pointer hover:bg-gray-700 rounded-lg transition-colors">
              <span className="text-gray-200 font-medium text-sm">
                Система пам'ятає про вас ({safeHealthProfile.systemMemory.rememberedFacts.length})
              </span>
            </summary>
            <div className="p-3 pt-0">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => handleClearMemory('facts')}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-400 hover:border-red-300"
                  title="Очистити запам'ятовані факти"
                >
                  Очистити факти
                </button>
              </div>
              <ul className="text-xs text-gray-300 space-y-1">
                {safeHealthProfile.systemMemory.rememberedFacts.map((fact, index) => (
                  <li key={index}>• {fact}</li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {/* Історія адаптацій */}
        {safeHealthProfile.systemMemory.adaptationHistory.length > 0 && (
          <details className="bg-gray-700/50 border border-gray-600 rounded-lg mb-4">
            <summary className="p-3 cursor-pointer hover:bg-gray-700 rounded-lg transition-colors">
              <span className="text-gray-200 font-medium text-sm">
                Історія адаптацій ({safeHealthProfile.systemMemory.adaptationHistory.length})
              </span>
            </summary>
            <div className="p-3 pt-0">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => handleClearMemory('history')}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-400 hover:border-red-300"
                  title="Очистити історію адаптацій"
                >
                  Очистити історію
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {safeHealthProfile.systemMemory.adaptationHistory.slice(-5).map((record, index) => (
                  <div key={index} className="text-xs text-gray-300 bg-gray-800/50 rounded p-2">
                    <div className="font-medium">{new Date(record.date).toLocaleDateString('uk-UA')}</div>
                    <div className="text-gray-400">{record.reason}</div>
                    <div className="text-gray-500">
                      Зміни: {record.adaptations?.join(', ') || 'Немає записів'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

        {/* Загальне очищення пам'яті */}
        {(safeHealthProfile.systemMemory.rememberedFacts.length > 0 || 
          safeHealthProfile.systemMemory.adaptationHistory.length > 0) && (
          <div className="bg-red-900/20 rounded-lg p-4 mb-4 border border-red-800">
            <h4 className="font-medium text-red-300 mb-2 text-sm">Повне очищення пам'яті</h4>
            <p className="text-sm text-red-200 mb-3">
              Це видалить всю пам'ять системи про вас. Система забуде всі факти та історію адаптацій.
            </p>
            <button
              onClick={() => handleClearMemory('all')}
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm"
            >
              Очистити всю пам'ять системи
            </button>
          </div>
        )}
      </div>

      {/* Активні захворювання */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium text-gray-200 text-sm">Активні проблеми здоров'я</h4>
          {activeConditions.length > 0 && (
            <button
              onClick={() => {
                const userConfirmed = confirm('Видалити всі активні проблеми здоров\'я?');
                if (userConfirmed) {
                  // Оновлюємо профіль, позначаючи всі проблеми як неактивні
                  const tempHealthProfile = {
                    ...safeHealthProfile,
                    conditions: safeHealthProfile.conditions.map(condition => ({
                      ...condition,
                      isActive: false,
                      resolvedDate: new Date()
                    }))
                  };
                  
                  // Оновлюємо поточні обмеження
                  const updatedHealthProfile = HealthProfileService.updateCurrentLimitations(tempHealthProfile);
                  
                  // Створюємо оновлений профіль
                  const updatedProfile = {
                    ...currentProfile,
                    healthProfile: updatedHealthProfile
                  };
                  
                  // Миттєво оновлюємо UI
                  setCurrentProfile(updatedProfile);
                  
                  // Зберігаємо зміни в БД в фоновому режимі
                  try {
                    onDirectSave(updatedProfile);
                  } catch (error) {
                    console.error('Помилка при збереженні:', error);
                    alert('Помилка при збереженні. Зміни застосовано локально.');
                  }
                }
              }}
              className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-400 hover:border-red-300"
            >
              Очистити всі
            </button>
          )}
        </div>
        {activeConditions.length > 0 ? (
          <div className="space-y-2">
            {activeConditions.map((condition) => (
              <div key={condition.id} className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-medium text-gray-200 text-sm">{condition.condition}</h5>
                  <button
                    onClick={() => {
                      console.log('🏥 [Одужав] Деактивуємо проблему:', condition.condition, condition.id);
                      handleDeactivateCondition(condition.id);
                    }}
                    className="text-green-400 hover:text-green-300 text-xs px-2 py-1 rounded border border-green-400 hover:border-green-300"
                  >
                    Одужав
                  </button>
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>Тип: <span className="text-purple-300">{
                    condition.type === 'chronic' ? 'Хронічне' :
                    condition.type === 'temporary' ? 'Тимчасове' : 'Відновлення'
                  }</span></p>
                  <p>Тяжкість: <span className={
                    condition.severity === 'severe' ? 'text-red-400' :
                    condition.severity === 'moderate' ? 'text-yellow-400' : 'text-green-400'
                  }>{
                    condition.severity === 'severe' ? 'Серйозна' :
                    condition.severity === 'moderate' ? 'Помірна' : 'Легка'
                  }</span></p>
                  <p>Уражені області: <span className="text-blue-300">{condition.affectedAreas.join(', ')}</span></p>
                  {condition.notes && <p>Нотатки: <span className="text-gray-400">{condition.notes}</span></p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs">Немає активних проблем здоров'я</p>
        )}
      </div>

      {/* Форма додавання нового захворювання */}
      <div>
        {!isAddingCondition ? (
          <button
            onClick={() => setIsAddingCondition(true)}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
          >
            Додати проблему здоров'я
          </button>
        ) : (
          <div className="bg-gray-700 rounded-lg p-4 space-y-4">
            <h4 className="font-medium text-white">Додати нову проблему здоров'я</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Опис проблеми</label>
                <input
                  type="text"
                  value={newCondition.condition}
                  onChange={(e) => setNewCondition(prev => ({ ...prev, condition: e.target.value }))}
                  placeholder="наприклад: травма спини, артрит колін"
                  className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Тип</label>
                  <select
                    value={newCondition.type}
                    onChange={(e) => setNewCondition(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white"
                  >
                    <option value="temporary">Тимчасове</option>
                    <option value="chronic">Хронічне</option>
                    <option value="recovering">Відновлення</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Тяжкість</label>
                  <select
                    value={newCondition.severity}
                    onChange={(e) => setNewCondition(prev => ({ ...prev, severity: e.target.value as any }))}
                    className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white"
                  >
                    <option value="mild">Легка</option>
                    <option value="moderate">Помірна</option>
                    <option value="severe">Серйозна</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Уражені області (через кому)</label>
                <input
                  type="text"
                  value={newCondition.affectedAreas}
                  onChange={(e) => setNewCondition(prev => ({ ...prev, affectedAreas: e.target.value }))}
                  placeholder="спина, поперек, хребет"
                  className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Додаткові нотатки (необов'язково)</label>
                <textarea
                  value={newCondition.notes}
                  onChange={(e) => setNewCondition(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="додаткова інформація про проблему"
                  className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white h-20"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCondition(false)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                >
                  Додати
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Вирішені проблеми */}
        {inactiveConditions.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-green-400 text-sm">Вирішені проблеми</h4>
              <button
                onClick={() => {
                  const userConfirmed = confirm('Видалити всі вирішені проблеми здоров\'я?');
                  if (userConfirmed) {
                    const tempHealthProfile = {
                      ...safeHealthProfile,
                      conditions: safeHealthProfile.conditions.filter(c => c.isActive)
                    };
                    
                    // Оновлюємо поточні обмеження
                    const updatedHealthProfile = HealthProfileService.updateCurrentLimitations(tempHealthProfile);
                    const updatedProfile = {
                      ...currentProfile,
                      healthProfile: updatedHealthProfile
                    };
                    
                    // Миттєво оновлюємо UI
                    setCurrentProfile(updatedProfile);
                    
                    // Зберігаємо в БД в фоновому режимі
                    try {
                      onDirectSave(updatedProfile);
                    } catch (error) {
                      console.error('Помилка при збереженні:', error);
                      alert('Помилка при збереженні. Зміни застосовано локально.');
                    }
                  }
                }}
                className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-400 hover:border-red-300"
              >
                Очистити вирішені
              </button>
            </div>
            <div className="space-y-2">
              {inactiveConditions.map((condition) => (
                <div key={condition.id} className="bg-green-900/20 rounded-lg p-3 border border-green-800">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-medium text-green-300 text-sm">{condition.condition}</h5>
                      {condition.notes && <p className="text-xs text-green-200 mt-1">{condition.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      <button
                        onClick={() => {
                          // Реактивуємо проблему
                          const updatedHealthProfile = {
                            ...safeHealthProfile,
                            conditions: safeHealthProfile.conditions.map(c =>
                              c.id === condition.id
                                ? { ...c, isActive: true, resolvedDate: undefined }
                                : c
                            )
                          };
                          
                          const finalHealthProfile = HealthProfileService.updateCurrentLimitations(updatedHealthProfile);
                          const updatedProfile = {
                            ...currentProfile,
                            healthProfile: finalHealthProfile
                          };
                          
                          setCurrentProfile(updatedProfile);
                          
                          // Зберігаємо в БД
                          try {
                            onDirectSave(updatedProfile);
                          } catch (error) {
                            console.error('Помилка при реактивації проблеми:', error);
                            alert('Помилка при збереженні. Зміни застосовано локально.');
                          }
                        }}
                        className="text-yellow-400 hover:text-yellow-300 text-xs px-1 py-0.5 rounded border border-yellow-400 hover:border-yellow-300"
                        title="Повернути як активну проблему"
                      >
                        ↩️ Повернулась
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Видалити "${condition.condition}" назавжди? Цю дію неможливо скасувати!`)) {
                            handleDeleteCondition(condition.id!);
                          }
                        }}
                        className="text-red-400 hover:text-red-300 text-xs px-1 py-0.5 rounded border border-red-400 hover:border-red-300"
                        title="Видалити назавжди"
                      >
                        🗑️ Видалити
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Розумна кнопка врахування в плані тренувань */}
      {(() => {
        const hasActiveConditions = activeConditions.length > 0;
        const hasInactiveConditions = inactiveConditions.length > 0;
        const hasCurrentLimitations = safeHealthProfile.currentLimitations.length > 0;
        const hasSystemMemory = safeHealthProfile.systemMemory.rememberedFacts.length > 0 || 
                                safeHealthProfile.systemMemory.adaptationHistory.length > 0;
        
        // Визначаємо стан системи
        let buttonText = '';
        let buttonColor = '';
        let description = '';
        let shouldShow = false;
        
        // Перевіряємо статус адаптації плану
        const adaptationStatus = safeHealthProfile.planAdaptationStatus;
        const isAlreadyAdapted = adaptationStatus && 
          !adaptationStatus.needsReAdaptation &&
          adaptationStatus.adaptedConditions.length > 0 &&
          activeConditions.every(c => adaptationStatus.adaptedConditions.includes(c.condition));
        
        // Кнопка показується тільки якщо є існуючий план і є проблеми для врахування
        if (!hasExistingPlan) {
          // Якщо немає існуючого плану - кнопка не показується
          // При генерації нового плану проблеми здоров'я автоматично враховуються
          shouldShow = false;
        } else if (isAlreadyAdapted) {
          // Якщо план вже адаптовано під поточні проблеми - кнопка не показується
          shouldShow = false;
        } else if (hasActiveConditions && hasCurrentLimitations) {
          // Є активні проблеми та обмеження - потрібно адаптувати існуючий план
          buttonText = '🔄 Адаптувати існуючий план';
          buttonColor = 'bg-orange-600 hover:bg-orange-700';
          description = `Є ${activeConditions.length} активних проблем здоров'я. Натисніть для адаптації існуючого плану тренувань.`;
          shouldShow = true;
        } else if (hasActiveConditions && !hasCurrentLimitations) {
          // Є активні проблеми, але немає обмежень - потрібно адаптувати план
          buttonText = '⚠️ Врахувати проблеми здоров\'я в плані';
          buttonColor = 'bg-yellow-600 hover:bg-yellow-700';
          description = `Виявлено ${activeConditions.length} проблем здоров'я. Натисніть для адаптації існуючого плану.`;
          shouldShow = true;
        } else if (!hasActiveConditions && hasInactiveConditions && hasCurrentLimitations) {
          // Немає активних, є вирішені, але залишились обмеження - потрібно очистити план
          buttonText = '🧹 Очистити застарілі обмеження з плану';
          buttonColor = 'bg-green-600 hover:bg-green-700';
          description = `Всі проблеми вирішено, але залишились старі обмеження. Натисніть для оновлення плану.`;
          shouldShow = true;
        } else if (!hasActiveConditions && hasInactiveConditions && hasSystemMemory) {
          // Немає активних, є вирішені та є пам'ять системи
          buttonText = '✨ Оновити план (враховуючи досвід)';
          buttonColor = 'bg-blue-600 hover:bg-blue-700';
          description = `Проблеми вирішено. Система пам'ятає ваш досвід і може адаптувати план для профілактики.`;
          shouldShow = true;
        } else if (hasActiveConditions || hasCurrentLimitations) {
          // Загальний випадок - є щось для врахування в існуючому плані
          buttonText = '📋 Врахувати в існуючому плані';
          buttonColor = 'bg-blue-600 hover:bg-blue-700';
          description = 'Натисніть для врахування поточного стану здоров\'я в існуючому плані тренувань.';
          shouldShow = true;
        }
        
        if (!shouldShow) return null;
        
        return (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <button
              className={`w-full py-3 px-4 text-white rounded-lg transition-colors text-sm font-medium ${buttonColor}`}
              onClick={() => {
                // Показуємо користувачу що відбувається
                const confirmMessage = hasActiveConditions 
                  ? `Адаптувати існуючий план під ${activeConditions.length} активних проблем здоров'я?`
                  : hasCurrentLimitations 
                  ? 'Адаптувати існуючий план з урахуванням поточних обмежень?'
                  : 'Адаптувати існуючий план тренувань?';
                
                if (confirm(confirmMessage)) {
                  console.log('🎯 [HealthProfileManager] Користувач підтвердив адаптацію існуючого плану');
                  console.log('📋 [HealthProfileManager] Передаємо профіль для адаптації:', {
                    name: currentProfile.name,
                    healthConditions: safeHealthProfile.conditions.filter(c => c.isActive).length,
                    currentLimitations: safeHealthProfile.currentLimitations.length,
                    activeConditionsDetails: safeHealthProfile.conditions
                      .filter(c => c.isActive)
                      .map(c => ({ condition: c.condition, severity: c.severity, areas: c.affectedAreas }))
                  });
                  
                  // Використовуємо onAdaptExistingPlan для адаптації існуючого плану
                  if (onAdaptExistingPlan) {
                    onAdaptExistingPlan(currentProfile);
                  } else {
                    // Fallback на onUpdateProfile якщо onAdaptExistingPlan не доступний
                    onUpdateProfile(currentProfile);
                  }
                  
                  // Показуємо повідомлення про успіх
                  setTimeout(() => {
                    if (hasActiveConditions) {
                      alert(`✅ Існуючий план адаптовано з урахуванням ${activeConditions.length} проблем здоров'я!`);
                    } else {
                      alert('✅ Існуючий план успішно адаптовано!');
                    }
                  }, 1000);
                } else {
                  console.log('❌ [HealthProfileManager] Користувач скасував адаптацію плану');
                  return; // Зупиняємо виконання якщо користувач скасував
                }
              }}
            >
              {buttonText}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {description}
            </p>
            
            {/* Додаткова інформація для користувача */}
            {hasInactiveConditions && (
              <div className="mt-2 p-2 bg-gray-700/30 rounded text-xs text-gray-300">
                💡 <strong>Порада:</strong> У вас є {inactiveConditions.length} вирішених проблем. 
                Якщо вони повернулись, не забудьте позначити їх як активні.
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
