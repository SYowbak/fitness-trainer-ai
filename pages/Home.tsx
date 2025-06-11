import React, { useState, useEffect } from 'react';
import { UserProfile, WorkoutLog } from '../types';
import UserProfileForm from '../components/UserProfileForm';
import WorkoutLogForm from '../components/WorkoutLogForm';
import WorkoutPlan from '../components/WorkoutPlan';
import TrainerChat from '../components/TrainerChat';
import { UI_TEXT } from '../constants';

const Home: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [lastWorkoutLog, setLastWorkoutLog] = useState<WorkoutLog | null>(null);
  const [previousWorkoutLogs, setPreviousWorkoutLogs] = useState<WorkoutLog[]>([]);

  useEffect(() => {
    // Завантаження профілю користувача
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    }

    // Завантаження логів тренувань
    const savedLogs = localStorage.getItem('workoutLogs');
    if (savedLogs) {
      const logs = JSON.parse(savedLogs);
      setLastWorkoutLog(logs[0] || null);
      setPreviousWorkoutLogs(logs.slice(1));
    }
  }, []);

  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
  };

  const handleDeleteProfile = () => {
    setUserProfile(null);
    localStorage.removeItem('userProfile');
  };

  const handleSaveWorkoutLog = (log: WorkoutLog) => {
    const updatedLogs = [log, ...(lastWorkoutLog ? [lastWorkoutLog] : []), ...previousWorkoutLogs];
    setLastWorkoutLog(log);
    setPreviousWorkoutLogs(updatedLogs.slice(1));
    localStorage.setItem('workoutLogs', JSON.stringify(updatedLogs));
  };

  const handleDeleteWorkoutLog = (logId: string) => {
    const updatedLogs = [lastWorkoutLog, ...previousWorkoutLogs].filter(log => log.id !== logId);
    setLastWorkoutLog(updatedLogs[0] || null);
    setPreviousWorkoutLogs(updatedLogs.slice(1));
    localStorage.setItem('workoutLogs', JSON.stringify(updatedLogs));
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">{UI_TEXT.welcome}</h1>
          <UserProfileForm
            userProfile={userProfile}
            onSave={handleSaveProfile}
            onDelete={handleDeleteProfile}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <UserProfileForm
              userProfile={userProfile}
              onSave={handleSaveProfile}
              onDelete={handleDeleteProfile}
            />
            <WorkoutLogForm
              userProfile={userProfile}
              onSave={handleSaveWorkoutLog}
              onDelete={handleDeleteWorkoutLog}
            />
          </div>
          <div className="space-y-8">
            <WorkoutPlan
              userProfile={userProfile}
              lastWorkoutLog={lastWorkoutLog}
              previousWorkoutLogs={previousWorkoutLogs}
            />
            <TrainerChat
              userProfile={userProfile}
              lastWorkoutLog={lastWorkoutLog}
              previousWorkoutLogs={previousWorkoutLogs}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 