import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Exercise } from '../types';

interface DraggableExerciseListProps {
  exercises: Exercise[];
  onReorder: (exercises: Exercise[]) => void;
  children: (exercise: Exercise, index: number, isCompact: boolean) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}

// Портал для елемента, який летить за пальцем (Overlay)
const DragOverlay = ({ children, x, y, width, height }: any) => {
  return ReactDOM.createPortal(
    <div
      className="fixed z-[9999] pointer-events-none shadow-2xl rounded-lg overflow-hidden ring-2 ring-fitness-gold-400 bg-gray-800"
      style={{
        left: x,
        top: y,
        width: width,
        height: height,
        transform: 'scale(1.02) rotate(1deg)',
        opacity: 0.95,
      }}
    >
      {children}
    </div>,
    document.body
  );
};

const DraggableExerciseList: React.FC<DraggableExerciseListProps> = ({
  exercises,
  onReorder,
  children,
  disabled = false,
  className = '',
}) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  
  // Координати та розміри
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragDimensions, setDragDimensions] = useState({ width: 0, height: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const listRef = useRef<HTMLDivElement>(null);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);
  const itemsRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // === Початок перетягування ===
  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (disabled) return;
    
    // Блокуємо стандартну поведінку браузера (скрол/виділення) ТІЛЬКИ на ручці
    e.preventDefault();
    
    const target = e.currentTarget as HTMLElement;
    const cardElement = itemsRefs.current.get(index);
    
    if (!cardElement) return;

    // Дозволяємо ловити події pointermove за межами елемента
    target.releasePointerCapture(e.pointerId);

    const rect = cardElement.getBoundingClientRect();

    setDraggingIndex(index);
    setPlaceholderIndex(index);
    
    // Встановлюємо висоту компактного елемента (60px)
    setDragDimensions({ width: rect.width, height: 60 }); 
    
    // Центруємо елемент під пальцем по вертикалі (30px = половина від 60px)
    setDragOffset({
      x: e.clientX - rect.left,
      y: 30 
    });
    
    setDragPosition({
      x: rect.left,
      y: rect.top
    });

    if (navigator.vibrate) navigator.vibrate(50);
  };

  // === Обробка руху ===
  useEffect(() => {
    if (draggingIndex === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();

      const currentX = e.clientX - dragOffset.x;
      const currentY = e.clientY - dragOffset.y;
      setDragPosition({ x: currentX, y: currentY });

      handleAutoScroll(e.clientY);
      findNewIndex(e.clientY);
    };

    const handlePointerUp = () => {
      stopAutoScroll();

      if (draggingIndex !== null && placeholderIndex !== null && draggingIndex !== placeholderIndex) {
        const newExercises = [...exercises];
        const [movedItem] = newExercises.splice(draggingIndex, 1);
        newExercises.splice(placeholderIndex, 0, movedItem);
        onReorder(newExercises);
      }

      setDraggingIndex(null);
      setPlaceholderIndex(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    
    // Глобальне блокування виділення під час активного перетягування
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      stopAutoScroll();
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
      document.body.style.cursor = '';
    };
  }, [draggingIndex, placeholderIndex, dragOffset, exercises]);

  // === Автоскрол ===
  const handleAutoScroll = (clientY: number) => {
    const viewportHeight = window.innerHeight;
    const scrollZone = 100;
    const baseSpeed = 20;

    stopAutoScroll();

    if (clientY < scrollZone) {
      scrollInterval.current = setInterval(() => window.scrollBy(0, -baseSpeed), 16);
    } else if (clientY > viewportHeight - scrollZone) {
      scrollInterval.current = setInterval(() => window.scrollBy(0, baseSpeed), 16);
    }
  };

  const stopAutoScroll = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  // === Розрахунок позиції вставки ===
  const findNewIndex = (y: number) => {
    // Перевірка на null для TypeScript
    if (draggingIndex === null) return;

    let closestIndex = -1;
    const items = Array.from(itemsRefs.current.entries());
    let closestDistance = Number.MAX_VALUE;

    items.forEach(([index, element]) => {
      if (index === draggingIndex) return;

      const rect = element.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(y - centerY);

      if (distance < closestDistance) {
        closestDistance = distance;
        if (y < centerY) closestIndex = index;
        else closestIndex = index + 1;
      }
    });

    if (closestIndex !== -1) {
        let finalIndex = closestIndex;
        
        if (draggingIndex < finalIndex) finalIndex -= 1; 
        
        const lastItem = itemsRefs.current.get(exercises.length - 1);
        if (lastItem && y > lastItem.getBoundingClientRect().bottom) {
            finalIndex = exercises.length;
        }

        finalIndex = Math.max(0, Math.min(finalIndex, exercises.length));
        
        if (finalIndex !== placeholderIndex) {
            setPlaceholderIndex(finalIndex);
            if (navigator.vibrate) navigator.vibrate(15);
        }
    }
  };

  // Компонент компактного рядка
  const CompactRowContent = ({ name }: { name: string }) => (
    <div className="flex items-center justify-between w-full h-full px-4">
      <span className="text-lg font-bold text-gray-300 truncate">
        {name}
      </span>
      <i className="fas fa-bars text-gray-600 ml-2"></i>
    </div>
  );

  return (
    <div className={`relative flex flex-col gap-2 ${className}`} ref={listRef}>
      {exercises.map((exercise, index) => {
        const isGlobalDragging = draggingIndex !== null;
        const isBeingDragged = draggingIndex === index;
        const isHidden = isBeingDragged;
        const isCompact = isGlobalDragging;

        return (
          <div 
             key={exercise.id} 
             className="transition-all duration-200 ease-out"
          >
            {/* === PLACEHOLDER === */}
            {placeholderIndex === index && isGlobalDragging && (
               <div className="h-[60px] w-full bg-fitness-gold-400/10 border-2 border-dashed border-fitness-gold-400/50 rounded-lg mb-2 flex items-center justify-center">
                 <span className="text-fitness-gold-400/50 text-sm font-medium">Сюди</span>
               </div>
            )}

            {/* === КАРТКА === */}
            <div
              ref={(el) => {
                if (el) itemsRefs.current.set(index, el);
                else itemsRefs.current.delete(index);
              }}
              className={`
                relative bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-700
                flex flex-row items-stretch select-none
                ${isHidden ? 'opacity-0 h-0 border-0 m-0 p-0 overflow-hidden' : ''}
              `}
              style={{
                 height: isHidden ? 0 : (isCompact ? '60px' : 'auto'),
                 transition: 'height 0.2s ease',
                 // [FIX] Дозволяємо вертикальний скрол на самій картці
                 touchAction: 'pan-y' 
              }}
            >
              
              {/* [FIX] Вузька ручка перетягування (w-8) */}
              {!disabled && (
                <div
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  className={`
                    w-5 flex-shrink-0 cursor-grab active:cursor-grabbing
                    bg-gray-700/30 hover:bg-fitness-gold-500/10 transition-colors
                    flex flex-col items-center justify-center
                    border-r border-gray-700
                  `}
                  style={{
                    // [FIX] Забороняємо скрол ТІЛЬКИ на цій ручці, щоб спрацював drag
                    touchAction: 'none' 
                  }}
                >
                    <div className="flex flex-col gap-1 pointer-events-none opacity-40">
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    </div>
                </div>
              )}

              {/* Контент картки */}
              <div className="flex-grow min-w-0 flex flex-col justify-center">
                 {isCompact ? (
                    <CompactRowContent name={exercise.name} />
                 ) : (
                    <div className="p-0">
                       {children(exercise, index, isCompact)}
                    </div>
                 )}
              </div>
            </div>
            
            {/* End Placeholder */}
            {placeholderIndex === exercises.length && index === exercises.length - 1 && isGlobalDragging && (
               <div className="h-[60px] w-full bg-fitness-gold-400/10 border-2 border-dashed border-fitness-gold-400/50 rounded-lg mt-2 flex items-center justify-center">
                 <span className="text-fitness-gold-400/50 text-sm font-medium">В кінець</span>
               </div>
            )}
          </div>
        );
      })}

      {/* === OVERLAY (Летюча картка) === */}
      {draggingIndex !== null && (
        <DragOverlay
          x={dragPosition.x}
          y={dragPosition.y}
          width={dragDimensions.width}
          height={dragDimensions.height}
        >
            <div className="flex h-full bg-gray-800">
                {/* [FIX] Ручка в Overlay теж вузька (w-8) */}
                <div className="w-8 flex items-center justify-center bg-fitness-gold-500 text-black border-r border-gray-600">
                    <i className="fas fa-grip-lines"></i>
                </div>
                <div className="flex-1 flex items-center px-4 overflow-hidden bg-gray-900">
                     <span className="text-lg font-bold truncate text-fitness-gold-400">
                        {exercises[draggingIndex].name}
                     </span>
                </div>
            </div>
        </DragOverlay>
      )}
    </div>
  );
};

export default DraggableExerciseList;