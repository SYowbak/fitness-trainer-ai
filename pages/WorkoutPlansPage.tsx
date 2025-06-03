import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DailyWorkoutPlan } from '../types';
import { UI_TEXT } from '../constants';
import WorkoutPlans from '../components/WorkoutPlans';
import { generateWorkoutPlan } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { useUserProfile } from '../contexts/UserProfileContext';

const WorkoutPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  const [plans, setPlans] = useState<DailyWorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const savedPlans = localStorage.getItem('workoutPlans');
        if (savedPlans) {
          setPlans(JSON.parse(savedPlans));
        } else {
          const generatedPlans = await generateWorkoutPlan(userProfile);
          setPlans(generatedPlans);
          localStorage.setItem('workoutPlans', JSON.stringify(generatedPlans));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Помилка завантаження планів тренувань');
      } finally {
        setIsLoading(false);
      }
    };

    loadPlans();
  }, [userProfile]);

  const handleUpdatePlans = (updatedPlans: DailyWorkoutPlan[]) => {
    setPlans(updatedPlans);
    localStorage.setItem('workoutPlans', JSON.stringify(updatedPlans));
  };

  if (isLoading) {
    return <Spinner message={UI_TEXT.generatingWorkoutPlan} />;
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500"
        >
          {UI_TEXT.backToHome}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-purple-300">{UI_TEXT.workoutPlans}</h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
        >
          {UI_TEXT.backToHome}
        </button>
      </div>

      <WorkoutPlans
        plans={plans}
        userProfile={userProfile}
        onUpdatePlans={handleUpdatePlans}
      />
    </div>
  );
};

export default WorkoutPlansPage; 