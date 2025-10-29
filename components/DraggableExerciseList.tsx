import React, { useState, useCallback, useRef } from 'react';
import { Exercise } from '../types';

interface DraggableExerciseListProps {
  exercises: Exercise[];
  onReorder: (exercises: Exercise[]) => void;
  children: (exercise: Exercise, index: number, dragHandleProps?: any) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  compactMode?: boolean; // Новий проп для компактного режиму перетягування
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
  const [isDragging, setIsDragging] = useState<boolean>(false); // Новий стан для відстеження активного перетягування
  
  // Дані для підтримки роботи з торканням (touch)
  const [touchDraggedIndex, setTouchDraggedIndex] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [touchCurrentY, setTouchCurrentY] = useState<number>(0);
  const [lastVibrationIndex, setLastVibrationIndex] = useState<number | null>(null);
  const touchItemRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (disabled) return;
    
    setDraggedIndex(index);
  setIsDragging(true); // Встановлюємо стан перетягування
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
    
  // Додаємо кастомне зображення під час перетягування
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
    
    // Очищуємо dragOverIndex тільки якщо користувач дійсно залишив зону перетягування
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
      
  // Видаляємо перетягувану вправу
      newExercises.splice(draggedIndex, 1);
      
  // Вставляємо її на нову позицію
      newExercises.splice(dropIndex, 0, draggedExercise);
      
      onReorder(newExercises);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [disabled, draggedIndex, exercises, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  setIsDragging(false); // Скидаємо стан перетягування
  }, []);

  // Нативні обробники подій торкання — щоб уникнути проблем з passive-listeners
  const attachTouchEvents = useCallback((element: HTMLDivElement, index: number) => {
    if (!element || disabled) return;
    
    const handleTouchStart = (e: TouchEvent) => {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (error) {
  // Тихо обробляємо можливі помилки preventDefault
      }
      
      const touch = e.touches[0];
      
      setTouchDraggedIndex(index);
      setTouchStartY(touch.clientY);
      setTouchCurrentY(touch.clientY);
      setDragOverIndex(null);
      setLastVibrationIndex(null);
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
  // Тихо обробляємо можливі помилки preventDefault
      }
      
      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - touchStartY);
      
      if (deltaY > 8) {
        setTouchCurrentY(touch.clientY);
        
  // Функціональність автопрокрутки під час перетягування
  const scrollThreshold = 100; // пікселів від краю
  const scrollSpeed = 10; // пікселів за крок прокрутки
        const viewportHeight = window.innerHeight;
        
  // Прибираємо існуючу автопрокрутку
        if (autoScrollInterval.current) {
          clearInterval(autoScrollInterval.current);
          autoScrollInterval.current = null;
        }
        
  // Перевіряємо, чи потрібно прокручувати вгору
        if (touch.clientY < scrollThreshold) {
          autoScrollInterval.current = setInterval(() => {
            window.scrollBy(0, -scrollSpeed);
          }, 16); // приблизно 60 кадрів/сек
        }
  // Перевіряємо, чи потрібно прокручувати вниз
        else if (touch.clientY > viewportHeight - scrollThreshold) {
          autoScrollInterval.current = setInterval(() => {
            window.scrollBy(0, scrollSpeed);
          }, 16);
        }
        
  // Знаходимо всі елементи вправ на сторінці
        const allExerciseElements = document.querySelectorAll('[data-exercise-index]');
        let targetIndex = null;
        
  // Перевіряємо, над яким елементом вправи знаходиться торкання
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
        
  // Оновлюємо індекс зони перетягування, якщо він змінився
        if (targetIndex !== null && targetIndex !== dragOverIndex) {
          setDragOverIndex(targetIndex);
          console.log('Touch drag over index:', targetIndex);
          
          // Вібруємо лише при переході на НОВУ позицію вправи
          if (targetIndex !== lastVibrationIndex && 'vibrate' in navigator) {
            navigator.vibrate(20);
            setLastVibrationIndex(targetIndex);
          }
        } else if (targetIndex === null && dragOverIndex !== null) {
          // Очищаємо dragOverIndex, коли торкання не над жодною вправою
          setDragOverIndex(null);
        }
      }
    };
    
    const handleTouchEnd = () => {
      if (touchDraggedIndex === null) return;
      
  // Зупиняємо автопрокрутку
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
      
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
      setLastVibrationIndex(null);
      setIsDragging(false);
      touchItemRef.current = null;
    };
    
  // Додаємо непасивні слухачі подій з обробкою помилок
    try {
      element.addEventListener('touchstart', handleTouchStart, { passive: false });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd, { passive: false });
    } catch (error) {
  // Якщо не вдається додати непасивні слухачі — використовуємо пасивні
      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchmove', handleTouchMove);
      element.addEventListener('touchend', handleTouchEnd);
    }
    
  // Зберігаємо функцію очищення (cleanup)
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
    
  // Побудова стилю динамічно — щоб НЕ додавати transform (навіть translateY(0))
  // для звичайних елементів. Transform створює новий stacking context, що
  // може ламати фіксовані/оверлейні елементи всередині карток (причина проблеми
  // коли модальне вікно логування перекривалося).
    const style: React.CSSProperties = {
      cursor: disabled ? 'default' : 'grab',
      opacity: isDragging ? 0.5 : 1,
      transition: touchDraggedIndex === index ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
  touchAction: disabled ? 'auto' : 'manipulation', // Краще оброблення торкань
  zIndex: touchDraggedIndex === index ? 1000 : undefined // Піднімаємо поточний елемент поверх під час торкання
    };

  // Задаємо transform лише коли елемент активно перетягують або він — ціль
  // для дропу. Уникаємо transform: 'translateY(0)' для нерухомих елементів.
    if (isOver) {
  // Визначаємо який індекс вважати «активним» (dragged або touchDragged)
      const activeIndex = draggedIndex !== null ? draggedIndex : (touchDraggedIndex !== null ? touchDraggedIndex : -1);
      const sign = activeIndex < index ? '-4px' : '4px';
      style.transform = `translateY(${sign})`;
    } else if (touchDraggedIndex === index) {
      style.transform = `translateY(${touchCurrentY - touchStartY}px)`;
    }

    return {
      draggable: true,
      'data-exercise-index': index,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, index),
      onDragEnd: handleDragEnd,
      style
    };
  }, [disabled, draggedIndex, dragOverIndex, touchDraggedIndex, touchStartY, touchCurrentY, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd]);

  // Окремі обробники подій торкання тільки для рукоятки перетягування
  const getDragHandleTouchProps = useCallback((index: number) => {
    if (disabled) return {};
    
    return {
      ref: (element: HTMLDivElement | null) => {
        if (element) {
          dragHandleRefs.current.set(index, element);
          
          // Очищаємо старі слухачі подій
          const existingCleanup = element.dataset.cleanup;
          if (existingCleanup) {
            // Видаляємо старі слухачі, якщо вони існують
            dragHandleRefs.current.delete(index);
          }
          
          // Додаємо нові слухачі
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
            key={`${exercise.id}-${index}`}
            {...getDragHandleProps(index)}
            className={`
              relative
              ${!disabled ? 'hover:shadow-lg transition-shadow duration-200' : ''}
              ${isDraggedItem ? 'z-50' : ''}
              ${isDropTarget ? 'ring-2 ring-fitness-gold-400 ring-opacity-50' : ''}
              ${compactMode && isDragging ? 'h-12' : ''}
            `}
          >
            {/* Compact mode overlay during dragging - show for ALL items when dragging */}
            {compactMode && isDragging && (
              <div className={`absolute inset-0 bg-gray-900/95 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg ${
                isDropTarget ? 'border-2 border-fitness-gold-400' : 'border border-fitness-gold-400/50'
              }`}>
                <div className="text-center px-3 py-2 max-w-full">
                  <div className="flex items-center justify-center space-x-2">
                    <i className={`fas fa-arrows-alt-v text-sm ${isDraggedItem ? 'text-fitness-gold-300' : 'text-fitness-gold-400'}`}></i>
                    <p className={`font-medium text-sm leading-tight break-words ${isDraggedItem ? 'text-white' : 'text-fitness-gold-300'}`}>{exercise.name}</p>
                  </div>
                </div>
              </div>
            )}
            
            {!disabled && (
              <div className={`absolute left-1 top-1/2 transform -translate-y-1/2 z-20 ${compactMode && isDragging ? 'opacity-0 pointer-events-none' : ''}`}>
                <div 
                  {...getDragHandleTouchProps(index)}
                  className="flex flex-col items-center justify-center w-8 h-12 cursor-grab active:cursor-grabbing hover:bg-gray-600/30 rounded transition-colors select-none" 
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
                  <div className="flex flex-col space-y-0.5 pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
            <div className={`${!disabled ? 'ml-10' : ''} ${compactMode && isDragging ? 'opacity-0 pointer-events-none' : ''}`}>
              {children(exercise, index, getDragHandleProps(index))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DraggableExerciseList;