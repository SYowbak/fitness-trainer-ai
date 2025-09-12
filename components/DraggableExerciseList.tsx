import React, { useState, useCallback } from 'react';
import { Exercise } from '../types';

interface DraggableExerciseListProps {
  exercises: Exercise[];
  onReorder: (exercises: Exercise[]) => void;
  children: (exercise: Exercise, index: number, dragHandleProps?: any) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const DraggableExerciseList: React.FC<DraggableExerciseListProps> = ({
  exercises,
  onReorder,
  children,
  disabled = false,
  className = ''
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (disabled) return;
    
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
    
    // Add a custom drag image
    if (e.currentTarget instanceof HTMLElement) {
      const rect = e.currentTarget.getBoundingClientRect();
      e.dataTransfer.setDragImage(e.currentTarget, rect.width / 2, rect.height / 2);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (index !== draggedIndex) {
      setDragOverIndex(index);
    }
  }, [disabled, draggedIndex]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    
    // Only clear dragOverIndex if we're actually leaving the droppable area
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    if (disabled || draggedIndex === null) return;
    
    e.preventDefault();
    
    if (draggedIndex !== dropIndex) {
      const newExercises = [...exercises];
      const draggedExercise = newExercises[draggedIndex];
      
      // Remove the dragged exercise
      newExercises.splice(draggedIndex, 1);
      
      // Insert it at the new position
      newExercises.splice(dropIndex, 0, draggedExercise);
      
      onReorder(newExercises);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [disabled, draggedIndex, exercises, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const getDragHandleProps = useCallback((index: number) => {
    if (disabled) return {};
    
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, index),
      onDragEnd: handleDragEnd,
      style: {
        cursor: disabled ? 'default' : 'grab',
        opacity: draggedIndex === index ? 0.5 : 1,
        transform: dragOverIndex === index && draggedIndex !== null && draggedIndex !== index 
          ? `translateY(${draggedIndex < index ? '-4px' : '4px'})` 
          : 'translateY(0)',
        transition: 'transform 0.2s ease, opacity 0.2s ease'
      }
    };
  }, [disabled, draggedIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd]);

  return (
    <div className={`space-y-4 ${className}`}>
      {exercises.map((exercise, index) => (
        <div
          key={exercise.id}
          {...getDragHandleProps(index)}
          className={`
            relative
            ${!disabled ? 'hover:shadow-lg transition-shadow duration-200' : ''}
            ${draggedIndex === index ? 'z-10' : ''}
            ${dragOverIndex === index && draggedIndex !== null && draggedIndex !== index 
              ? 'ring-2 ring-purple-400 ring-opacity-50' 
              : ''
            }
          `}
        >
          {!disabled && (
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20">
              <div className="flex flex-col items-center justify-center w-6 h-8 cursor-grab active:cursor-grabbing hover:bg-gray-600/30 rounded transition-colors">
                <div className="w-1 h-1 bg-gray-400 rounded-full mb-1"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full mb-1"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              </div>
            </div>
          )}
          <div className={!disabled ? 'ml-8' : ''}>
            {children(exercise, index, getDragHandleProps(index))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DraggableExerciseList;