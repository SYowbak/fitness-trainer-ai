import React, { useState, useEffect } from 'react';
import { UserProfile, Gender, BodyType, FitnessGoal, MuscleGroup, ExperienceLevel } from '../types';
import { GENDER_OPTIONS, BODY_TYPE_OPTIONS, FITNESS_GOAL_OPTIONS, TRAINING_FREQUENCY_OPTIONS, MUSCLE_GROUP_OPTIONS, DEFAULT_TRAINING_FREQUENCY, UI_TEXT, EXPERIENCE_LEVEL_OPTIONS } from '../constants';

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
  const [height, setHeight] = useState<number>(170);
  const [weight, setWeight] = useState<number>(70);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(ExperienceLevel.BEGINNER);

  useEffect(() => {
    if (existingProfile) {
      setName(existingProfile.name || '');
      setGender(existingProfile.gender);
      setBodyType(existingProfile.bodyType);
      setGoal(existingProfile.goal);
      setTrainingFrequency(existingProfile.trainingFrequency);
      setTargetMuscleGroups(existingProfile.targetMuscleGroups || []);
      setHeight(existingProfile.height || 170);
      setWeight(existingProfile.weight || 70);
      setExperienceLevel(existingProfile.experienceLevel || ExperienceLevel.BEGINNER);
    } else {
      setName('');
      setGender(GENDER_OPTIONS[0].value);
      setBodyType(BODY_TYPE_OPTIONS[0].value);
      setGoal(FITNESS_GOAL_OPTIONS[0].value);
      setTrainingFrequency(DEFAULT_TRAINING_FREQUENCY);
      setTargetMuscleGroups([]);
      setHeight(170);
      setWeight(70);
      setExperienceLevel(ExperienceLevel.BEGINNER);
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
      experienceLevel
    });
  };

  const handleMuscleGroupChange = (muscleGroup: MuscleGroup) => {
    setTargetMuscleGroups(prev => {
      if (prev.includes(muscleGroup)) {
        return prev.filter(group => group !== muscleGroup);
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
          <label htmlFor="height" className={commonLabelClasses}>{UI_TEXT.heightLabel}</label>
          <input
            type="number"
            id="height"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className={commonSelectClasses}
            min="100"
            max="250"
            step="1"
          />
        </div>
        <div>
          <label htmlFor="weight" className={commonLabelClasses}>{UI_TEXT.weightLabel}</label>
          <input
            type="number"
            id="weight"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className={commonSelectClasses}
            min="30"
            max="300"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="experienceLevel" className={commonLabelClasses}>{UI_TEXT.experienceLevelLabel}</label>
          <select 
            id="experienceLevel" 
            value={experienceLevel} 
            onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)} 
            className={commonSelectClasses}
          >
            {EXPERIENCE_LEVEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={commonLabelClasses}>{UI_TEXT.targetMuscleGroupsLabel}</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {MUSCLE_GROUP_OPTIONS.map(option => (
              <label 
                key={option.value} 
                className={`flex items-center p-3 rounded-md cursor-pointer transition-colors
                  ${targetMuscleGroups.includes(option.value as MuscleGroup) 
                    ? 'bg-purple-600/30 border-purple-500' 
                    : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                  } border`}
              >
                <input
                  type="checkbox"
                  checked={targetMuscleGroups.includes(option.value as MuscleGroup)}
                  onChange={() => handleMuscleGroupChange(option.value as MuscleGroup)}
                  className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 rounded"
                />
                <span className="text-gray-200">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-2">Виберіть одну або кілька груп м'язів для акценту</p>
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