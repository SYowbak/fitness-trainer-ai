import React from 'react';
import { UserProfile, WorkoutLog } from '../types';
import UserProfileForm from '../components/UserProfileForm';
import WorkoutLogForm from '../components/WorkoutLogForm';
import WorkoutPlan from '../components/WorkoutPlan';
import TrainerChat from '../components/TrainerChat';
import { UI_TEXT } from '../constants';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">{UI_TEXT.welcome}</h1>
        <p className="text-center text-gray-500">Ця сторінка більше не використовується. Всі дані зберігаються у Firestore.</p>
      </div>
    </div>
  );
};

export default Home; 