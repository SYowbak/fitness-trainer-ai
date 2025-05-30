import React, { useState, useEffect } from 'react';
import { UserProfile, Gender, BodyType, FitnessGoal, MuscleGroup, UserLevel } from '../types';
import { GENDER_OPTIONS, BODY_TYPE_OPTIONS, FITNESS_GOAL_OPTIONS, TRAINING_FREQUENCY_OPTIONS, MUSCLE_GROUP_OPTIONS, USER_LEVEL_OPTIONS, DEFAULT_TRAINING_FREQUENCY, DEFAULT_USER_LEVEL, UI_TEXT } from '../constants';

interface UserProfileFormProps {
  existingProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  apiKeyMissing: boolean;
  isLoading: boolean;
}

const UserProfileForm: React.FC<UserProfileFormProps> = ({ existingProfile, onSave, apiKeyMissing, isLoading }) => {
  const [name, setName] = useState<string>('');
  const [gender, setGender] = useState<Gender>(GENDER_OPTIONS[0].value);
  const [bodyType, setBodyType] = useState<BodyType>(BODY_TYPE_OPTIONS[0].value);
  const [goal, setGoal] = useState<FitnessGoal>(FITNESS_GOAL_OPTIONS[0].value);
  const [trainingFrequency, setTrainingFrequency] = useState<number>(DEFAULT_TRAINING_FREQUENCY);
  const [targetMuscleGroups, setTargetMuscleGroups] = useState<MuscleGroup[]>([]);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [weight, setWeight] = useState<number | undefined>(undefined);
  const [level, setLevel] = useState<UserLevel>(DEFAULT_USER_LEVEL);

  useEffect(() => {
    if (existingProfile) {
      setName(existingProfile.name || '');
      setGender(existingProfile.gender);
      setBodyType(existingProfile.bodyType);
      setGoal(existingProfile.goal);
      setTrainingFrequency(existingProfile.trainingFrequency);
      setTargetMuscleGroups(existingProfile.targetMuscleGroups || []);
      setHeight(existingProfile.height);
      setWeight(existingProfile.weight);
      setLevel(existingProfile.level);
    } else {
      setName('');
      setGender(GENDER_OPTIONS[0].value);
      setBodyType(BODY_TYPE_OPTIONS[0].value);
      setGoal(FITNESS_GOAL_OPTIONS[0].value);
      setTrainingFrequency(DEFAULT_TRAINING_FREQUENCY);
      setTargetMuscleGroups([]);
      setHeight(undefined);
      setWeight(undefined);
      setLevel(DEFAULT_USER_LEVEL);
    }
  }, [existingProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeyMissing) {
      return;
    }
    onSave({ 
      name, 
      gender, 
      bodyType, 
      goal, 
      trainingFrequency, 
      targetMuscleGroups,
      height,
      weight,
      level
    });
  };

  const handleMuscleGroupChange = (muscleGroup: MuscleGroup) => {
    setTargetMuscleGroups(prev => {
      if (prev.includes(muscleGroup)) {
        return prev.filter(mg => mg !== muscleGroup);
      } else {
        return [...prev, muscleGroup];
      }
    });
  };
  
  const commonSelectClasses = "w-full p-3 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-gray-200 placeholder-gray-400";
  const commonLabelClasses = "block text-sm font-medium text-purple-300 mb-1";

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-gray-800/80 rounded-xl shadow-2xl backdrop-blur-sm">
      <h2 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        <i className="fas fa-id-card mr-3"></i>{UI_TEXT.tabProfile}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
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
          <select id="bodyType" value={bodyType} onChange={(e) => setBodyType(e.target.value as BodyType)} className={commonSelectClasses}>
            {BODY_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
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
          <label className={commonLabelClasses}>{UI_TEXT.targetMuscleGroupLabel}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {MUSCLE_GROUP_OPTIONS.map(option => (
              <div key={option.value} className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id={`muscle-${option.value}`}
                  checked={targetMuscleGroups.includes(option.value)}
                  onChange={() => handleMuscleGroupChange(option.value)}
                  className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 rounded bg-gray-700"
                />
                <div>
                  <label htmlFor={`muscle-${option.value}`} className="text-gray-200 cursor-pointer">
                    {option.label}
                  </label>
                  <p className="text-sm text-gray-400">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="height" className={commonLabelClasses}>{UI_TEXT.heightLabel}</label>
            <input
              type="number"
              id="height"
              value={height || ''}
              onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : undefined)}
              className={commonSelectClasses}
              placeholder="Наприклад: 175"
              min="100"
              max="250"
            />
          </div>
          <div>
            <label htmlFor="weight" className={commonLabelClasses}>{UI_TEXT.weightLabel}</label>
            <input
              type="number"
              id="weight"
              value={weight || ''}
              onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : undefined)}
              className={commonSelectClasses}
              placeholder="Наприклад: 70"
              min="30"
              max="300"
            />
          </div>
        </div>
        <div>
          <label htmlFor="level" className={commonLabelClasses}>{UI_TEXT.levelLabel}</label>
          <select 
            id="level" 
            value={level} 
            onChange={(e) => setLevel(e.target.value as UserLevel)} 
            className={commonSelectClasses}
          >
            {USER_LEVEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-400">
            {USER_LEVEL_OPTIONS.find(opt => opt.value === level)?.description}
          </p>
        </div>
        <button 
          type="submit" 
          disabled={apiKeyMissing || isLoading}
          className={`w-full font-semibold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 text-white flex items-center justify-center
                      ${apiKeyMissing || isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}`}
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
            <>
            <i className={`fas ${existingProfile ? 'fa-sync-alt' : 'fa-save'} mr-2`}></i>
            {existingProfile ? UI_TEXT.generateWorkout : UI_TEXT.saveProfile}
            </>
          )}
        </button>
        {apiKeyMissing && <p className="text-red-400 text-sm mt-3 text-center"><i className="fas fa-exclamation-triangle mr-1"></i>{UI_TEXT.apiKeyMissing}</p>}
      </form>
    </div>
  );
};

export default UserProfileForm;