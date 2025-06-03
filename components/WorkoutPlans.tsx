import React, { useState } from 'react';
import { DailyWorkoutPlan } from '../types';
import WorkoutPlan from './WorkoutPlan';
import { UI_TEXT } from '../constants';

interface WorkoutPlansProps {
  plans: DailyWorkoutPlan[];
  userProfile: any;
  onUpdatePlans: (updatedPlans: DailyWorkoutPlan[]) => void;
}

const WorkoutPlans: React.FC<WorkoutPlansProps> = ({ plans, userProfile, onUpdatePlans }) => {
  const [activeDay, setActiveDay] = useState<number>(plans[0]?.day || 1);

  const handleUpdatePlan = (updatedPlan: DailyWorkoutPlan) => {
    const updatedPlans = plans.map(plan => 
      plan.day === updatedPlan.day ? updatedPlan : plan
    );
    onUpdatePlans(updatedPlans);
  };

  const activePlan = plans.find(plan => plan.day === activeDay);

  if (!activePlan) {
    return <div className="text-center text-gray-400">{UI_TEXT.noWorkoutPlan}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {plans.map(plan => (
          <button
            key={plan.day}
            onClick={() => setActiveDay(plan.day)}
            className={`px-4 py-2 rounded ${
              activeDay === plan.day
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {plan.day}
          </button>
        ))}
      </div>

      <WorkoutPlan
        plan={activePlan}
        userProfile={userProfile}
        onUpdatePlan={handleUpdatePlan}
      />
    </div>
  );
};

export default WorkoutPlans; 