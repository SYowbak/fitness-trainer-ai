import React, { useState, useEffect } from 'react';
import { UserProfile, Gender, BodyType, FitnessGoal, MuscleGroup, ExperienceLevel } from '../types';
import { GENDER_OPTIONS, BODY_TYPE_OPTIONS, FITNESS_GOAL_OPTIONS, TRAINING_FREQUENCY_OPTIONS, MUSCLE_GROUP_OPTIONS, DEFAULT_TRAINING_FREQUENCY, UI_TEXT, EXPERIENCE_LEVEL_OPTIONS } from '../constants';
import { HealthProfileManager } from './HealthProfileManager';
import { useAuth } from '../hooks/useAuth';

interface UserProfileFormProps {
  existingProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  onUpdateProfile?: (profile: UserProfile) => void; // Новий проп для оновлення без генерації
  onAdaptExistingPlan?: (profile: UserProfile) => void; // Новий проп для адаптації існуючого плану
  hasExistingPlan?: boolean; // Чи є існуючий план тренувань
  apiKeyMissing: boolean;
  isLoading: boolean;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
}

const UserProfileForm: React.FC<UserProfileFormProps> = ({
  existingProfile,
  onSave,
  onUpdateProfile,
  onAdaptExistingPlan,
  hasExistingPlan = false,
  apiKeyMissing,
  isLoading,
  onLogout,
  onDeleteAccount
}) => {
  const { user } = useAuth();
  const [name, setName] = useState<string>('');
  const [gender, setGender] = useState<Gender>(GENDER_OPTIONS[0].value);
  const [bodyType, setBodyType] = useState<BodyType>(BODY_TYPE_OPTIONS[0].value);
  const [goal, setGoal] = useState<FitnessGoal>(FITNESS_GOAL_OPTIONS[0].value);
  const [trainingFrequency, setTrainingFrequency] = useState<number>(DEFAULT_TRAINING_FREQUENCY);
  const [targetMuscleGroups, setTargetMuscleGroups] = useState<MuscleGroup[]>([]);
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(ExperienceLevel.BEGINNER);
  const [pendingHealthProfile, setPendingHealthProfile] = useState<any>(null);

  useEffect(() => {
    if (existingProfile) {
      setName(existingProfile.name || '');
      setGender(existingProfile.gender);
      setBodyType(existingProfile.bodyType);
      setGoal(existingProfile.goal);
      setTrainingFrequency(existingProfile.trainingFrequency);
      setTargetMuscleGroups(existingProfile.targetMuscleGroups || []);
      setHeight(existingProfile.height ? existingProfile.height.toString() : '');
      setWeight(existingProfile.weight ? existingProfile.weight.toString() : '');
      setAge(existingProfile.age ? existingProfile.age.toString() : '');
      setExperienceLevel(existingProfile.experienceLevel || ExperienceLevel.BEGINNER);
    } else {
      setName('');
      setGender(GENDER_OPTIONS[0].value);
      setBodyType(BODY_TYPE_OPTIONS[0].value);
      setGoal(FITNESS_GOAL_OPTIONS[0].value);
      setTrainingFrequency(DEFAULT_TRAINING_FREQUENCY);
      setTargetMuscleGroups([]);
      setHeight('');
      setAge('');
      setExperienceLevel(ExperienceLevel.BEGINNER);
    }
  }, [existingProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (apiKeyMissing) {
      alert('Будь ласка, введіть API ключ у налаштуваннях');
      return;
    }

    const profileToSave: UserProfile = {
      name: name || 'Користувач',
      gender,
      bodyType,
      goal,
      trainingFrequency,
      height: height ? parseFloat(height) : 170,
      weight: weight ? parseFloat(weight) : 70,
      age: age ? parseInt(age) : 25,
      experienceLevel,
      targetMuscleGroups: targetMuscleGroups || [],
      ...(pendingHealthProfile ? { healthProfile: pendingHealthProfile } : {})
    };

    onSave(profileToSave);
  };

  const handleMuscleGroupChange = (muscleGroup: MuscleGroup) => {
    setTargetMuscleGroups(prev => 
      prev.includes(muscleGroup) 
        ? prev.filter(group => group !== muscleGroup)
        : [...prev, muscleGroup]
    );
  };
  
  const commonSelectClasses = "w-full p-3 md:p-4 bg-gray-700 border border-gray-600 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500 text-gray-200 placeholder-gray-400 text-base";
  const commonLabelClasses = "block text-sm font-medium text-purple-300 mb-2";

  return (
    <div className="max-w-4xl mx-auto px-4">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        👤 {UI_TEXT.tabProfile}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div>
          <label htmlFor="name" className={commonLabelClasses}>{UI_TEXT.nameLabel}</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={commonSelectClasses}
            placeholder="Ваше ім'я або нікнейм"
          />
        </div>
        <div>
          <label htmlFor="gender" className={commonLabelClasses}>{UI_TEXT.genderLabel}</label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={commonSelectClasses}>
            {GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bodyType" className={commonLabelClasses}>{UI_TEXT.bodyTypeLabel}</label>
          
          {/* Випадаючий список з картками */}
          <details className="bg-gray-700/50 border border-gray-600 rounded-lg">
            <summary className="p-4 cursor-pointer hover:bg-gray-700 rounded-lg transition-colors flex items-center">
              <span className="text-gray-200 font-medium">
                {bodyType ? 
                  `Тип статури: ${BODY_TYPE_OPTIONS.find(opt => opt.value === bodyType)?.label}` : 
                  'Обрати тип статури'
                }
              </span>
            </summary>
            <div className="p-4 pt-0 space-y-3 max-h-80 overflow-y-auto">
              {BODY_TYPE_OPTIONS.map(option => (
                <label 
                  key={option.value} 
                  className={`flex flex-col p-3 rounded-lg cursor-pointer transition-colors
                    ${bodyType === option.value
                      ? 'bg-purple-600/30 border-purple-500 ring-2 ring-purple-500/50' 
                      : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                    } border`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="bodyType"
                      checked={bodyType === option.value}
                      onChange={() => setBodyType(option.value)}
                      className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600"
                    />
                    <span className="text-gray-200 font-medium text-sm">{option.label}</span>
                  </div>
                  <span className="text-xs text-gray-400 mt-1 ml-7">{option.hint}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        <div>
          <label htmlFor="goal" className={commonLabelClasses}>{UI_TEXT.goalLabel}</label>
          <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as FitnessGoal)} className={commonSelectClasses}>
            {FITNESS_GOAL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="trainingFrequency" className={commonLabelClasses}>{UI_TEXT.frequencyLabel}</label>
          <select id="trainingFrequency" value={trainingFrequency} onChange={(e) => setTrainingFrequency(Number(e.target.value))} className={commonSelectClasses}>
            {TRAINING_FREQUENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="height" className={commonLabelClasses}>{UI_TEXT.heightLabel}</label>
          <input
            type="number"
            id="height"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className={commonSelectClasses}
            placeholder="170"
            min="100"
            max="250"
            step="1"
          />
          <p className="text-sm text-gray-400 mt-1">Введіть ваш зріст у сантиметрах (100-250 см)</p>
        </div>
        <div>
          <label htmlFor="weight" className={commonLabelClasses}>{UI_TEXT.weightLabel}</label>
          <input
            type="number"
            id="weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={commonSelectClasses}
            placeholder="70"
            min="30"
            max="300"
            step="0.1"
          />
          <p className="text-sm text-gray-400 mt-1">Введіть вашу вагу у кілограмах (30-300 кг)</p>
        </div>
        <div>
          <label htmlFor="age" className={commonLabelClasses}>{UI_TEXT.ageLabel}</label>
          <input
            type="number"
            id="age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={commonSelectClasses}
            placeholder="25"
            min="16"
            max="100"
            step="1"
          />
          <p className="text-sm text-gray-400 mt-1">Введіть ваш вік у роках (16-100 років)</p>
        </div>
        <div>
          <label htmlFor="experienceLevel" className={commonLabelClasses}>{UI_TEXT.experienceLevelLabel}</label>
          
          {/* Випадаючий список з картками */}
          <details className="bg-gray-700/50 border border-gray-600 rounded-lg">
            <summary className="p-4 cursor-pointer hover:bg-gray-700 rounded-lg transition-colors flex items-center">
              <span className="text-gray-200 font-medium">
                {experienceLevel ? 
                  `Рівень підготовки: ${EXPERIENCE_LEVEL_OPTIONS.find(opt => opt.value === experienceLevel)?.label}` : 
                  'Обрати рівень підготовки'
                }
              </span>
            </summary>
            <div className="p-4 pt-0 space-y-3 max-h-80 overflow-y-auto">
              {EXPERIENCE_LEVEL_OPTIONS.map(option => (
                <label 
                  key={option.value} 
                  className={`flex flex-col p-3 rounded-lg cursor-pointer transition-colors
                    ${experienceLevel === option.value
                      ? 'bg-purple-600/30 border-purple-500 ring-2 ring-purple-500/50' 
                      : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                    } border`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="experienceLevel"
                      checked={experienceLevel === option.value}
                      onChange={() => setExperienceLevel(option.value)}
                      className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600"
                    />
                    <span className="text-gray-200 font-medium text-sm">{option.label}</span>
                  </div>
                  <span className="text-xs text-gray-400 mt-1 ml-7">{option.hint}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        <div>
          <label className={commonLabelClasses}>{UI_TEXT.targetMuscleGroupsLabel}</label>
          
          {/* Випадаючий список з картками */}
          <details className="bg-gray-700/50 border border-gray-600 rounded-lg">
            <summary className="p-4 cursor-pointer hover:bg-gray-700 rounded-lg transition-colors flex items-center">
              <span className="text-gray-200 font-medium">
                {targetMuscleGroups.filter(group => Boolean(group) && group !== '' as any).length > 0 ? 
                  `Акцент на групи м'язів (${targetMuscleGroups.filter(group => Boolean(group) && group !== '' as any).length} обрано)` : 
                  'Обрати групи м\'язів для акценту'
                }
              </span>
            </summary>
            
            {/* Показуємо обрані групи всередині */}
            {targetMuscleGroups.filter(group => Boolean(group) && group !== '' as any).length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {targetMuscleGroups.filter(group => Boolean(group) && group !== '' as any).map(group => {
                  const option = MUSCLE_GROUP_OPTIONS.find(opt => opt.value === group);
                  return (
                    <span 
                      key={group}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-purple-600/20 text-purple-200 border border-purple-500/50"
                    >
                      {option?.label}
                      <button
                        type="button"
                        onClick={() => handleMuscleGroupChange(group)}
                        className="ml-1 text-purple-300 hover:text-purple-100 text-sm"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="p-4 pt-0 space-y-3 max-h-80 overflow-y-auto">
              {MUSCLE_GROUP_OPTIONS.filter(option => option.value !== '').map(option => (
                <label 
                  key={option.value} 
                  className={`flex flex-col p-3 rounded-lg cursor-pointer transition-colors
                    ${targetMuscleGroups.includes(option.value as MuscleGroup) 
                      ? 'bg-purple-600/30 border-purple-500 ring-2 ring-purple-500/50' 
                      : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                    } border`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={targetMuscleGroups.includes(option.value as MuscleGroup)}
                      onChange={() => handleMuscleGroupChange(option.value as MuscleGroup)}
                      className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 rounded"
                    />
                    <span className="text-gray-200 font-medium text-sm">{option.label}</span>
                  </div>
                  <span className="text-xs text-gray-400 mt-1 ml-7">{option.hint}</span>
                </label>
              ))}
            </div>
          </details>
          
          <p className="text-sm text-gray-400 mt-3">
            Якщо нічого не обрано - буде загальний розвиток всіх груп м'язів
          </p>
        </div>
        
        {/* Менеджер профілю здоров'я - перед кнопкою генерації */}
        <HealthProfileManager
          existingProfile={existingProfile}
          userProfile={{
            ...(existingProfile || {
              name: name || 'Користувач',
              gender,
              bodyType,
              goal,
              trainingFrequency,
              targetMuscleGroups: targetMuscleGroups || [],
              height: height ? parseFloat(height) : 170,
              weight: weight ? parseFloat(weight) : 70,
              age: age ? parseInt(age) : 25,
              experienceLevel
            }),
            healthProfile: pendingHealthProfile || existingProfile?.healthProfile || { conditions: [] }
          } as UserProfile}
          onAdaptExistingPlan={onAdaptExistingPlan}
          hasExistingPlan={hasExistingPlan}
          onUpdateProfile={(updatedProfile) => {
            // Create a clean profile object with default values
            const baseProfile = {
              name: name || 'Користувач',
              gender: gender || 'other',
              bodyType: bodyType || 'ectomorph',
              goal: goal || 'general_fitness',
              trainingFrequency: trainingFrequency || 3,
              targetMuscleGroups: targetMuscleGroups || [],
              height: height ? parseFloat(height) : 170,
              weight: weight ? parseFloat(weight) : 70,
              age: age ? parseInt(age) : 25,
              experienceLevel: experienceLevel || 'beginner',
              healthProfile: updatedProfile.healthProfile || {}
            };

            // Simple and reliable way to remove undefined values
            const cleanProfile = JSON.parse(JSON.stringify(baseProfile, (key, value) => 
              value === undefined ? null : value
            ));
            
            // Update the pending health profile state
            setPendingHealthProfile(cleanProfile.healthProfile);
            
            // Use onUpdateProfile if available, otherwise use onSave
            if (onUpdateProfile) {
              onUpdateProfile(cleanProfile);
            } else {
              console.log('Health profile updated locally:', cleanProfile);
              setPendingHealthProfile(cleanProfile.healthProfile);
            }
          }}
          onDirectSave={async (profile: UserProfile) => {
            console.log('🔵 [UserProfileForm.onDirectSave] Початок збереження:', profile.healthProfile?.conditions?.length || 0, 'умов');
            
            // Create a complete profile with all fields
            const updatedProfile = {
              ...(existingProfile || {
                name: name || 'Користувач',
                gender,
                bodyType,
                goal,
                trainingFrequency,
                targetMuscleGroups,
                height: height ? parseFloat(height) : 170,
                weight: weight ? parseFloat(weight) : 70,
                age: age ? parseInt(age) : 25,
                experienceLevel,
                healthProfile: { conditions: [] } // Ensure healthProfile exists
              }),
              healthProfile: profile.healthProfile,
              updatedAt: new Date().toISOString() // Add timestamp
            };

            // Update local state immediately for better UX
            setPendingHealthProfile(profile.healthProfile);
            console.log('🟡 [UserProfileForm.onDirectSave] Оновлено локальний стан pendingHealthProfile');
            
            if (user) {
              // User is authenticated - save to Firebase
              try {
                console.log('🟢 [UserProfileForm.onDirectSave] Користувач авторизований - зберігаємо в Firebase');
                
                if (onUpdateProfile) {
                  console.log('🔄 [UserProfileForm.onDirectSave] Викликаємо onUpdateProfile');
                  await onUpdateProfile(updatedProfile);
                  console.log('✅ [UserProfileForm.onDirectSave] Профіль здоров\'я успішно оновлено в Firebase');
                } else {
                  console.log('🔄 [UserProfileForm.onDirectSave] Викликаємо onSave');
                  await onSave(updatedProfile);
                  console.log('✅ [UserProfileForm.onDirectSave] Профіль успішно збережено в Firebase');
                }
              } catch (error) {
                console.error('❌ [UserProfileForm.onDirectSave] Помилка при збереженні в Firebase:', error);
                alert('Помилка при збереженні профілю здоров\'я. Будь ласка, спробуйте ще раз.');
              }
            } else {
              // User is not authenticated - save locally
              console.log('🟡 [UserProfileForm.onDirectSave] Користувач не авторизований - зберігаємо локально');
              try {
                // Save to localStorage for unregistered users
                localStorage.setItem('fitness_trainer_profile', JSON.stringify(updatedProfile));
                console.log('✅ [UserProfileForm.onDirectSave] Профіль здоров\'я збережено локально');
              } catch (error) {
                console.error('❌ [UserProfileForm.onDirectSave] Помилка при локальному збереженні:', error);
                alert('Помилка при локальному збереженні профілю здоров\'я.');
              }
            }
          }}
        />
        
        {/* Кнопка генерації плану тренувань */}
        <button 
          type="submit" 
          disabled={apiKeyMissing || isLoading}
          className={`w-full font-semibold py-4 px-6 rounded-lg shadow-md transition duration-300 ease-in-out text-white flex items-center justify-center text-base md:text-lg
                      ${apiKeyMissing || isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 active:scale-95'}`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Обробка...
            </>
          ) : (
            <>Згенерувати план тренувань</>
          )}
        </button>
        {apiKeyMissing && <p className="text-red-400 text-sm mt-3 text-center"><i className="fas fa-exclamation-triangle mr-1"></i>{UI_TEXT.apiKeyMissing}</p>}

        {/* Кнопки виходу та видалення акаунту */}
        <div className="mt-8 pt-6 border-t border-gray-700 space-y-3">
          <button
            type="button"
            onClick={onLogout}
            className="w-full font-semibold py-4 px-6 rounded-lg shadow-md transition duration-300 ease-in-out text-white flex items-center justify-center bg-red-600 hover:bg-red-700 active:scale-95 text-base"
          >
            Вийти з акаунту
          </button>
          <button
            type="button"
            onClick={onDeleteAccount}
            className="w-full font-semibold py-4 px-6 rounded-lg shadow-md transition duration-300 ease-in-out text-white flex items-center justify-center bg-gray-600 hover:bg-gray-700 border border-red-400 active:scale-95 text-base"
          >
            Видалити акаунт
          </button>
        </div>
      </form>
    </div>
  );
};

// Функція для збереження профілю здоров'я без генерації плану
const saveHealthProfileWithoutGeneratingPlan = (
  profile: UserProfile, 
  existingProfile: UserProfile | null, 
  onSave: (profile: UserProfile) => void,
  onUpdateProfile?: (profile: UserProfile) => void
) => {
  if (existingProfile) {
    // Оновлюємо профіль
    const updatedProfile = {
      ...existingProfile,
      ...profile,
      healthProfile: profile.healthProfile || existingProfile.healthProfile
    };
    
    // Використовуємо onUpdateProfile, якщо він доступний, інакше onSave
    if (onUpdateProfile) {
      onUpdateProfile(updatedProfile);
    } else {
      onSave(updatedProfile);
    }
  } else {
    // Якщо профілю немає, використовуємо звичайне збереження
    onSave(profile);
  }
};

export default UserProfileForm;