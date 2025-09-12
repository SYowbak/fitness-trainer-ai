import React, { useState, useCallback, useRef } from 'react';
import { Exercise } from '../types';

interface DraggableExerciseListProps {
  exercises: Exercise[];
  onReorder: (exercises: Exercise[]) => void;
  children: (exercise: Exercise, index: number, dragHandleProps?: any) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  compactMode?: boolean; // New prop for compact dragging mode
}

const DraggableExerciseList: React.FC<DraggableExerciseListProps> = ({
  exercises,
  onReorder,
  children,
  disabled = false,
  className = '',
  compactMode = false
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false); // New state to track if we're actively dragging
  
  // Touch support state
  const [touchDraggedIndex, setTouchDraggedIndex] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [touchCurrentY, setTouchCurrentY] = useState<number>(0);
  const touchItemRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (disabled) return;
    
    setDraggedIndex(index);
    setIsDragging(true); // Set dragging state
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
    setIsDragging(false); // Reset dragging state
  }, []);

  // Touch event handlers with improved mobile support
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    if (disabled) return;
    
    // Prevent default to stop scrolling when starting drag
    e.preventDefault();
    
    const touch = e.touches[0];
    setTouchDraggedIndex(index);
    setTouchStartY(touch.clientY);
    setTouchCurrentY(touch.clientY);
    setDragOverIndex(null); // Reset drag over state
    setIsDragging(true); // Set dragging state for compact mode
    
    console.log('Touch start on index:', index);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || touchDraggedIndex === null) return;
    
    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    // Only start dragging if moved more than 5px vertically (reduced threshold)
    if (deltaY > 5) {
      setTouchCurrentY(touch.clientY);
      
      // Find which element we're over
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const exerciseElement = elementBelow?.closest('[data-exercise-index]') as HTMLElement;
      
      if (exerciseElement) {
        const overIndex = parseInt(exerciseElement.dataset.exerciseIndex || '-1');
        if (overIndex !== -1 && overIndex !== touchDraggedIndex) {
          setDragOverIndex(overIndex);
          console.log('Touch drag over index:', overIndex);
        }
      }
      
      // Prevent scrolling when actively dragging
      e.preventDefault();
      e.stopPropagation();
    }
  }, [disabled, touchDraggedIndex, touchStartY]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    if (disabled || touchDraggedIndex === null) return;
    
    console.log('Touch end - draggedIndex:', touchDraggedIndex, 'dragOverIndex:', dragOverIndex);
    
    // Only reorder if we actually moved and have a valid drop target
    if (dragOverIndex !== null && dragOverIndex !== touchDraggedIndex) {
      const deltaY = Math.abs(touchCurrentY - touchStartY);
      
      // Only reorder if we moved significantly (more than 5px, reduced threshold)
      if (deltaY > 5) {
        console.log('Reordering from', touchDraggedIndex, 'to', dragOverIndex);
        const newExercises = [...exercises];
        const draggedExercise = newExercises[touchDraggedIndex];
        
        // Remove the dragged exercise
        newExercises.splice(touchDraggedIndex, 1);
        
        // Insert it at the new position
        newExercises.splice(dragOverIndex, 0, draggedExercise);
        
        onReorder(newExercises);
        console.log('Reorder completed');
      }
    }
    
    // Reset all touch state
    setTouchDraggedIndex(null);
    setDragOverIndex(null);
    setTouchStartY(0);
    setTouchCurrentY(0);
    setIsDragging(false); // Reset dragging state
    touchItemRef.current = null;
  }, [disabled, touchDraggedIndex, dragOverIndex, exercises, onReorder, touchCurrentY, touchStartY]);

  const getDragHandleProps = useCallback((index: number) => {
    if (disabled) return {};
    
    const isDragging = draggedIndex === index || touchDraggedIndex === index;
    const isOver = dragOverIndex === index && (draggedIndex !== null || touchDraggedIndex !== null) && !isDragging;
    
    return {
      draggable: true,
      'data-exercise-index': index,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, index),
      onDragEnd: handleDragEnd,
      style: {
        cursor: disabled ? 'default' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        transform: isOver ? `translateY(${(draggedIndex !== null || touchDraggedIndex !== null) && (draggedIndex || touchDraggedIndex)! < index ? '-4px' : '4px'})` : 
                   (touchDraggedIndex === index ? `translateY(${touchCurrentY - touchStartY}px)` : 'translateY(0)'),
        transition: touchDraggedIndex === index ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
        touchAction: disabled ? 'auto' : 'manipulation' // Better touch handling
      }
    };
  }, [disabled, draggedIndex, dragOverIndex, touchDraggedIndex, touchStartY, touchCurrentY, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd]);

  // Separate touch event handlers for the drag handle only
  const getDragHandleTouchProps = useCallback((index: number) => {
    if (disabled) return {};
    
    return {
      onTouchStart: (e: React.TouchEvent) => {
        // Only start drag from the handle area
        e.stopPropagation();
        handleTouchStart(e, index);
      },
      onTouchMove: (e: React.TouchEvent) => {
        e.stopPropagation();
        handleTouchMove(e);
      },
      onTouchEnd: (e: React.TouchEvent) => {
        e.stopPropagation();
        handleTouchEnd(e);
      },
      style: {
        touchAction: 'none'
      }
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div className={`space-y-4 ${className}`} style={{ touchAction: disabled ? 'auto' : 'pan-y' }}>
      {exercises.map((exercise, index) => {
        const isDraggedItem = draggedIndex === index || touchDraggedIndex === index;
        const isDropTarget = dragOverIndex === index && (draggedIndex !== null || touchDraggedIndex !== null) && !isDraggedItem;
        
        return (
          <div
            key={exercise.id}
            {...getDragHandleProps(index)}
            className={`
              relative
              ${!disabled ? 'hover:shadow-lg transition-shadow duration-200' : ''}
              ${isDraggedItem ? 'z-50' : ''}
              ${isDropTarget ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}
            `}
          >
            {/* Compact mode overlay during dragging */}
            {compactMode && isDragging && !isDraggedItem && (
              <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg border border-purple-400/50">
                <div className="text-center">
                  <i className="fas fa-arrows-alt-v text-purple-400 text-xl mb-2"></i>
                  <p className="text-purple-300 font-semibold text-lg">{exercise.name}</p>
                  <p className="text-gray-400 text-sm">Drop here to reorder</p>
                </div>
              </div>
            )}
            
            {!disabled && (
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20">
                <div 
                  {...getDragHandleTouchProps(index)}
                  className="flex flex-col items-center justify-center w-8 h-10 cursor-grab active:cursor-grabbing hover:bg-gray-600/30 rounded transition-colors select-none" 
                  title="Перетягніть для зміни порядку"
                >
                  <div className="flex flex-col space-y-1 pointer-events-none">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  </div>
                  {/* Mobile hint */}
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap opacity-60 sm:hidden pointer-events-none">
                    Утримайте
                  </div>
                </div>
              </div>
            )}
            <div className={!disabled ? 'ml-10 sm:ml-8' : ''}>
              {children(exercise, index, getDragHandleProps(index))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DraggableExerciseList;