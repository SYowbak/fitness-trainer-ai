import React from 'react';

interface SpinnerProps {
  message?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ message = "Завантаження..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] sm:min-h-[300px] p-4 text-center my-6">
      <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-purple-400 border-t-transparent border-solid rounded-full animate-spin mb-4"></div>
      <p className="text-lg sm:text-xl text-gray-300">{message}</p>
    </div>
  );
};

export default Spinner;