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
  const dragHandleRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  // Native touch event handlers to avoid passive listener issues
  const attachTouchEvents = useCallback((element: HTMLDivElement, index: number) => {
    if (!element || disabled) return;
    
    const handleTouchStart = (e: TouchEvent) => {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (error) {
        // Silently handle preventDefault errors
      }
      
      const touch = e.touches[0];
      setTouchDraggedIndex(index);
      setTouchStartY(touch.clientY);
      setTouchCurrentY(touch.clientY);
      setDragOverIndex(null);
      setIsDragging(true);
      
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
      
      console.log('Touch start on index:', index, 'at Y:', touch.clientY);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (touchDraggedIndex === null) return;
      
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (error) {
        // Silently handle preventDefault errors
      }
      
      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - touchStartY);
      
      if (deltaY > 8) {
        setTouchCurrentY(touch.clientY);
        
        // Find all exercise elements in the page
        const allExerciseElements = document.querySelectorAll('[data-exercise-index]');
        let targetIndex = null;
        
        // Check which exercise element the touch is over
        for (const exerciseEl of allExerciseElements) {
          const rect = exerciseEl.getBoundingClientRect();
          
          if (touch.clientX >= rect.left && 
              touch.clientX <= rect.right &&
              touch.clientY >= rect.top && 
              touch.clientY <= rect.bottom) {
            
            const elementIndex = parseInt((exerciseEl as HTMLElement).dataset.exerciseIndex || '-1');
            if (elementIndex !== -1 && elementIndex !== touchDraggedIndex) {
              targetIndex = elementIndex;
              break;
            }
          }
        }
        
        // Update drag over index if changed
        if (targetIndex !== null && targetIndex !== dragOverIndex) {
          setDragOverIndex(targetIndex);
          console.log('Touch drag over index:', targetIndex);
          
          if ('vibrate' in navigator) {
            navigator.vibrate(20);
          }
        } else if (targetIndex === null && dragOverIndex !== null) {
          // Clear drag over when not over any exercise
          setDragOverIndex(null);
        }
      }
    };
    
    const handleTouchEnd = () => {
      if (touchDraggedIndex === null) return;
      
      console.log('Touch end - draggedIndex:', touchDraggedIndex, 'dragOverIndex:', dragOverIndex);
      
      if (dragOverIndex !== null && dragOverIndex !== touchDraggedIndex) {
        const deltaY = Math.abs(touchCurrentY - touchStartY);
        
        if (deltaY > 8) {
          const newExercises = [...exercises];
          const draggedExercise = newExercises[touchDraggedIndex];
          
          newExercises.splice(touchDraggedIndex, 1);
          newExercises.splice(dragOverIndex, 0, draggedExercise);
          
          onReorder(newExercises);
          
          if ('vibrate' in navigator) {
            navigator.vibrate([50, 50, 50]);
          }
        }
      }
      
      setTouchDraggedIndex(null);
      setDragOverIndex(null);
      setTouchStartY(0);
      setTouchCurrentY(0);
      setIsDragging(false);
      touchItemRef.current = null;
    };
    
    // Add non-passive event listeners with error handling
    try {
      element.addEventListener('touchstart', handleTouchStart, { passive: false });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd, { passive: false });
    } catch (error) {
      // Fallback to passive listeners if non-passive fails
      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchmove', handleTouchMove);
      element.addEventListener('touchend', handleTouchEnd);
    }
    
    // Store cleanup function
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, touchDraggedIndex, touchStartY, touchCurrentY, dragOverIndex, exercises, onReorder]);

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
      ref: (element: HTMLDivElement | null) => {
        if (element) {
          dragHandleRefs.current.set(index, element);
          
          // Clean up old listeners
          const existingCleanup = element.dataset.cleanup;
          if (existingCleanup) {
            // Remove old listeners if they exist
            dragHandleRefs.current.delete(index);
          }
          
          // Attach new listeners
          const cleanup = attachTouchEvents(element, index);
          if (cleanup) {
            element.dataset.cleanup = 'true';
          }
        }
      },
      style: {
        touchAction: 'none' as const,
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        msUserSelect: 'none' as const,
        MozUserSelect: 'none' as const
      }
    };
  }, [disabled, attachTouchEvents]);

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
              ${compactMode && isDragging ? 'h-12' : ''}
            `}
          >
            {/* Compact mode overlay during dragging - show for ALL items when dragging */}
            {compactMode && isDragging && (
              <div className={`absolute inset-0 bg-gray-900/95 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg ${
                isDropTarget ? 'border-2 border-purple-400' : 'border border-purple-400/50'
              }`}>
                <div className="text-center px-3 py-2 max-w-full">
                  <div className="flex items-center justify-center space-x-2">
                    <i className={`fas fa-arrows-alt-v text-sm ${isDraggedItem ? 'text-purple-300' : 'text-purple-400'}`}></i>
                    <p className={`font-medium text-sm leading-tight break-words ${isDraggedItem ? 'text-white' : 'text-purple-300'}`}>{exercise.name}</p>
                  </div>
                </div>
              </div>
            )}
            
            {!disabled && (
              <div className={`absolute left-2 top-1/2 transform -translate-y-1/2 z-20 ${compactMode && isDragging ? 'opacity-0 pointer-events-none' : ''}`}>
                <div 
                  {...getDragHandleTouchProps(index)}
                  className="flex flex-col items-center justify-center w-12 h-16 cursor-grab active:cursor-grabbing hover:bg-gray-600/30 rounded transition-colors select-none" 
                  title="Перетягніть для зміни порядку"
                  style={{
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    msUserSelect: 'none',
                    MozUserSelect: 'none'
                  }}
                >
                  <div className="flex flex-col space-y-1 pointer-events-none">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
            <div className={`${!disabled ? 'ml-14 sm:ml-12' : ''} ${compactMode && isDragging ? 'opacity-0 pointer-events-none' : ''}`}>
              {children(exercise, index, getDragHandleProps(index))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DraggableExerciseList;