import { Exercise, WeightType, LoggedExercise } from '../types';

/**
 * Типи рухів для вправ
 */
export enum MovementPattern {
  VERTICAL_PULL = 'vertical_pull',      // Підтягування, тяга вертикального блоку
  HORIZONTAL_PULL = 'horizontal_pull',  // Тяга в нахилі, тяга горизонтального блоку
  VERTICAL_PUSH = 'vertical_push',      // Жим над головою, віджимання на брусах
  HORIZONTAL_PUSH = 'horizontal_push',  // Жим лежачи, віджимання
  SQUAT = 'squat',                      // Присідання, жим ногами
  HINGE = 'hinge',                      // Станова тяга, румунська тяга
  LUNGE = 'lunge',                      // Випади
  ISOLATION = 'isolation',              // Згинання/розгинання, ізоляційні
  CARDIO = 'cardio',                    // Кардіо вправи
  CORE = 'core'                         // Прес, планка
}

/**
 * Визначає патерн руху на основі назви вправи
 */
export const detectMovementPattern = (exerciseName: string): MovementPattern => {
  const name = exerciseName.toLowerCase();
  
  // Вертикальні тяги
  if (
    name.includes('підтягуван') ||
    name.includes('pull-up') ||
    name.includes('вертикальн') ||
    name.includes('pulldown') ||
    name.includes('тяга вертикальн')
  ) {
    return MovementPattern.VERTICAL_PULL;
  }
  
  // Горизонтальні тяги
  if (
    name.includes('тяга') && (
      name.includes('горизонтальн') ||
      name.includes('row') ||
      name.includes('нахил') ||
      name.includes('пояс') ||
      name.includes('гантел') && name.includes('тяга')
    ) &&
    !name.includes('станова') &&
    !name.includes('румунськ')
  ) {
    return MovementPattern.HORIZONTAL_PULL;
  }
  
  // Станова тяга та румунська (hinge pattern)
  if (
    name.includes('станова') ||
    name.includes('deadlift') ||
    name.includes('румунськ') ||
    name.includes('romanian')
  ) {
    return MovementPattern.HINGE;
  }
  
  // Вертикальні жими
  if (
    name.includes('жим') && (
      name.includes('над головою') ||
      name.includes('overhead') ||
      name.includes('стоячи') ||
      name.includes('сидячи') && name.includes('над')
    ) ||
    name.includes('віджимання на брусах') ||
    name.includes('dips')
  ) {
    return MovementPattern.VERTICAL_PUSH;
  }
  
  // Горизонтальні жими
  if (
    name.includes('жим') && (
      name.includes('лежачи') ||
      name.includes('bench') ||
      name.includes('на лаві')
    ) ||
    name.includes('віджимання') && !name.includes('брусах')
  ) {
    return MovementPattern.HORIZONTAL_PUSH;
  }
  
  // Присідання
  if (
    name.includes('присідання') ||
    name.includes('squat') ||
    name.includes('жим ногами') ||
    name.includes('leg press')
  ) {
    return MovementPattern.SQUAT;
  }
  
  // Випади
  if (
    name.includes('випад') ||
    name.includes('lunge') ||
    name.includes('крок')
  ) {
    return MovementPattern.LUNGE;
  }
  
  // Ізоляційні вправи
  if (
    name.includes('згинання') ||
    name.includes('curl') ||
    name.includes('розгинання') ||
    name.includes('extension') ||
    name.includes('розведення') ||
    name.includes('fly') ||
    name.includes('махи')
  ) {
    return MovementPattern.ISOLATION;
  }
  
  // Прес та кора
  if (
    name.includes('прес') ||
    name.includes('планка') ||
    name.includes('скручуван') ||
    name.includes('підйом ніг') ||
    name.includes('core') ||
    name.includes('абс')
  ) {
    return MovementPattern.CORE;
  }
  
  // Кардіо
  if (
    name.includes('кардіо') ||
    name.includes('біг') ||
    name.includes('ходьба') ||
    name.includes('велосипед') ||
    name.includes('еліптичний') ||
    name.includes('бігова доріжка')
  ) {
    return MovementPattern.CARDIO;
  }
  
  // За замовчуванням - ізоляція
  return MovementPattern.ISOLATION;
};

/**
 * Шаблони рекомендацій для різних патернів рухів
 */
interface RecommendationTemplate {
  success: {
    text: (sets: number, reps: number, weight: number, weightType: WeightType) => string;
    weightIncrement: (weightType: WeightType) => number;
    action: 'increase_weight' | 'increase_reps' | 'maintain';
  };
  difficulty: {
    text: (sets: number, reps: number, weight: number, weightType: WeightType) => string;
    action: 'focus_technique' | 'decrease_weight' | 'maintain';
  };
  base: {
    text: (weightType: WeightType) => string;
    weightIncrement: (weightType: WeightType) => string;
  };
}

const recommendationTemplates: Record<MovementPattern, RecommendationTemplate> = {
  [MovementPattern.VERTICAL_PULL]: {
    success: {
      text: (sets, reps, weight, weightType) => 
        `Відмінно виконано! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте опускання, повна амплітуда руху.`,
      weightIncrement: (wt) => wt === 'single' ? 1.25 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте опускання, зосередьтеся на повній амплітуді руху.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Контролюйте опускання, повна амплітуда руху. Збільшуйте вагу на 2.5кг кожні 1-2 тижні.',
      weightIncrement: () => '2.5кг'
    }
  },
  
  [MovementPattern.HORIZONTAL_PULL]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Відмінно! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте спину прямою, тягніть до пояса.`,
      weightIncrement: (wt) => wt === 'single' ? 1.25 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте спину прямою, тягніть до пояса, зосередьтеся на техніці.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Тримайте спину прямою, тягніть до пояса. Збільшуйте вагу на 2.5кг кожні 1-2 тижні.',
      weightIncrement: () => '2.5кг'
    }
  },
  
  [MovementPattern.HINGE]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Добре виконано! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте спину прямою, рух починайте з ніг.`,
      weightIncrement: (wt) => wt === 'single' ? 1.25 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте спину прямою, рух починайте з ніг. Зосередьтеся на техніці.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Тримайте спину прямою, починайте рух з ніг. Збільшуйте вагу на 2.5кг кожні 1-2 тижні.',
      weightIncrement: () => '2.5кг'
    }
  },
  
  [MovementPattern.VERTICAL_PUSH]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Відмінно! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте опускання, повна амплітуда руху.`,
      weightIncrement: (wt) => wt === 'single' ? 1.25 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте опускання, зосередьтеся на техніці.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Контролюйте опускання, повна амплітуда руху. Прогресуйте на 1.25-2.5кг щотижня.',
      weightIncrement: () => '1.25-2.5кг'
    }
  },
  
  [MovementPattern.HORIZONTAL_PUSH]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Відмінно! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте опускання, повна амплітуда руху.`,
      weightIncrement: (wt) => wt === 'single' ? 1.25 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте опускання, зосередьтеся на техніці.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Контролюйте опускання, повна амплітуда руху. Прогресуйте на 1.25-2.5кг щотижня.',
      weightIncrement: () => '1.25-2.5кг'
    }
  },
  
  [MovementPattern.SQUAT]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Відмінно виконано! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Фокусуйтесь на глибині присідань та правильній постановці ніг.`,
      weightIncrement: (wt) => wt === 'single' ? 1.25 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Зосередьтеся на глибині присідань та правильній постановці ніг.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Фокусуйтесь на глибині присідань та правильній постановці ніг. Поступово збільшуйте вагу на 2.5-5кг щотижня.',
      weightIncrement: () => '2.5-5кг'
    }
  },
  
  [MovementPattern.LUNGE]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Добре виконано! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте корпус прямо, контролюйте баланс.`,
      weightIncrement: (wt) => wt === 'single' ? 1 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте корпус прямо, зосередьтеся на балансі та техніці.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Тримайте корпус прямо, контролюйте баланс. Збільшуйте вагу на 2.5кг кожні 1-2 тижні.',
      weightIncrement: () => '2.5кг'
    }
  },
  
  [MovementPattern.ISOLATION]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Добре виконано! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте темп, повна амплітуда.`,
      weightIncrement: (wt) => wt === 'single' ? 1 : 2.5,
      action: 'increase_weight'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Контролюйте темп, зосередьтеся на повній амплітуді.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Контролюйте темп виконання, повна амплітуда руху. Збільшуйте вагу на 1-2.5кг кожні 1-2 тижні.',
      weightIncrement: () => '1-2.5кг'
    }
  },
  
  [MovementPattern.CORE]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Відмінно! ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте тіло напруженим, контролюйте дихання.`,
      weightIncrement: () => 0,
      action: 'increase_reps'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень${weight > 0 ? ` з ${weight}${weightType === 'single' ? 'кг в кожній руці' : 'кг'}` : ''}. Тримайте тіло напруженим, зосередьтеся на техніці.`,
      action: 'focus_technique'
    },
    base: {
      text: () => 'Тримайте тіло напруженим, контролюйте дихання. Збільшуйте час утримання або кількість повторень поступово.',
      weightIncrement: () => 'поступово'
    }
  },
  
  [MovementPattern.CARDIO]: {
    success: {
      text: (sets, reps, weight, weightType) =>
        `Відмінно! ${sets} підходів по ${reps} повторень. Контролюйте темп, зберігайте рівномірне дихання.`,
      weightIncrement: () => 0,
      action: 'increase_reps'
    },
    difficulty: {
      text: (sets, reps, weight, weightType) =>
        `Виконано з труднощами. ${sets} підходів по ${reps} повторень. Зосередьтеся на рівномірному темпі та диханні.`,
      action: 'maintain'
    },
    base: {
      text: () => 'Контролюйте темп виконання, зберігайте рівномірне дихання. Збільшуйте тривалість або інтенсивність поступово.',
      weightIncrement: () => 'поступово'
    }
  }
};

/**
 * Генерує рекомендацію для вправи на основі патерну руху та виконання
 */
export const generateExerciseRecommendation = (
  exercise: Exercise | LoggedExercise,
  loggedExercise?: LoggedExercise,
  isSuccessful: boolean = true
): {
  text: string;
  suggestedWeight?: number;
  action: 'increase_weight' | 'decrease_weight' | 'increase_reps' | 'decrease_reps' | 'maintain' | 'focus_technique';
} => {
  // Отримуємо назву вправи (Exercise має 'name', LoggedExercise має 'exerciseName')
  const exerciseName = 'name' in exercise ? exercise.name : exercise.exerciseName;
  const movementPattern = detectMovementPattern(exerciseName);
  const weightType = 'weightType' in exercise ? exercise.weightType : 'total';
  const template = recommendationTemplates[movementPattern];
  
  if (loggedExercise) {
    // Рекомендація на основі виконання
    const avgWeight = loggedExercise.loggedSets?.reduce((sum, set) => sum + (set.weightUsed || 0), 0) / (loggedExercise.loggedSets?.length || 1) || 0;
    const avgReps = Math.round(loggedExercise.loggedSets?.reduce((sum, set) => sum + (set.repsAchieved || 0), 0) / (loggedExercise.loggedSets?.length || 1) || 0);
    const totalSets = loggedExercise.loggedSets?.length || 0;
    
    if (isSuccessful) {
      const increment = template.success.weightIncrement(weightType);
      const suggestedWeight = avgWeight > 0 && increment > 0 ? Math.round(avgWeight + increment) : undefined;
      
      return {
        text: template.success.text(totalSets, avgReps, Math.round(avgWeight), weightType),
        suggestedWeight,
        action: template.success.action
      };
    } else {
      return {
        text: template.difficulty.text(totalSets, avgReps, Math.round(avgWeight), weightType),
        action: template.difficulty.action
      };
    }
  } else {
    // Базова рекомендація (без виконання)
    return {
      text: template.base.text(weightType),
      action: 'maintain'
    };
  }
};

