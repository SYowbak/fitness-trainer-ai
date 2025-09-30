import { HealthProfile, HealthCondition, UserProfile, WellnessCheck } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Сервіс для управління профілем здоров'я користувача
 */
export class HealthProfileService {
  
  /**
   * Створює початковий профіль здоров'я для користувача
   */
  static createInitialHealthProfile(): HealthProfile {
    return {
      conditions: [],
      currentLimitations: [],
      recoveryProgress: {},
      systemMemory: {
        rememberedFacts: [],
        adaptationHistory: []
      }
    };
  }

  /**
   * Додає нове захворювання/травму до профілю
   */
  static addHealthCondition(
    healthProfile: HealthProfile,
    condition: Omit<HealthCondition, 'id'>
  ): HealthProfile {
    const newCondition: HealthCondition = {
      ...condition,
      id: uuidv4()
    };

    const updatedProfile = {
      ...healthProfile,
      conditions: [...healthProfile.conditions, newCondition]
    };

    // Оновлюємо поточні обмеження
    return HealthProfileService.updateCurrentLimitations(updatedProfile);
  }

  /**
   * Оновлює стан захворювання (наприклад, прогрес відновлення)
   */
  static updateConditionProgress(
    healthProfile: HealthProfile,
    conditionId: string,
    progressPercentage: number,
    milestones: string[] = []
  ): HealthProfile {
    const updatedProfile = {
      ...healthProfile,
      recoveryProgress: {
        ...healthProfile.recoveryProgress,
        [conditionId]: {
          progressPercentage,
          lastUpdated: new Date(),
          milestones: [
            ...(healthProfile.recoveryProgress[conditionId]?.milestones || []),
            ...milestones
          ]
        }
      }
    };

    return HealthProfileService.updateCurrentLimitations(updatedProfile);
  }

  /**
   * Деактивує захворювання (користувач одужав)
   */
  static deactivateCondition(
    healthProfile: HealthProfile,
    conditionId: string
  ): HealthProfile {
    const updatedProfile = {
      ...healthProfile,
      conditions: healthProfile.conditions.map(condition =>
        condition.id === conditionId
          ? { ...condition, isActive: false }
          : condition
      )
    };

    return HealthProfileService.updateCurrentLimitations(updatedProfile);
  }

  /**
   * Оновлює поточні обмеження на основі активних захворювань
   */
  static updateCurrentLimitations(healthProfile: HealthProfile): HealthProfile {
    const activeConditions = healthProfile.conditions.filter(c => c.isActive);
    const limitations: string[] = [];

    activeConditions.forEach(condition => {
      // Додаємо тільки основні області ураження
      limitations.push(...condition.affectedAreas);
      
      // Додаємо модифікатори тільки для серйозних випадків
      if (condition.severity === 'severe' && condition.type === 'chronic') {
        // Для хронічних серйозних - додаємо один комбінований модифікатор
        limitations.push(`серйозна хронічна ${condition.affectedAreas[0]}`);
      } else if (condition.severity === 'severe') {
        // Для серйозних - додаємо модифікатор тяжкості
        limitations.push(`серйозна ${condition.affectedAreas[0]}`);
      }
    });

    return {
      ...healthProfile,
      currentLimitations: [...new Set(limitations)] // видаляємо дублікати
    };
  }

  /**
   * Аналізує нотатки самопочуття та виявляє тимчасові проблеми
   */
  static analyzeWellnessNotes(notes: string): string[] {
    if (!notes) return [];

    const lowerNotes = notes.toLowerCase();
    const temporaryIssues: string[] = [];

    // Мапа ключових слів для виявлення проблем
    const issueKeywords = {
      'спина': ['спина', 'спину', 'спині', 'поперек', 'хребет'],
      'коліно': ['коліно', 'коліна', 'колін'],
      'плече': ['плече', 'плечі', 'плечей'],
      'шия': ['шия', 'шию', 'шиї'],
      'голова': ['голова', 'головний біль', 'мігрень'],
      'втома': ['втома', 'втомлений', 'втомлена', 'виснажений'],
      'біль': ['болить', 'біль', 'болючий', 'болюча']
    };

    Object.entries(issueKeywords).forEach(([issue, keywords]) => {
      if (keywords.some(keyword => lowerNotes.includes(keyword))) {
        temporaryIssues.push(issue);
      }
    });

    return temporaryIssues;
  }

  /**
   * Додає запис до пам'яті системи
   */
  static addToSystemMemory(
    healthProfile: HealthProfile,
    fact: string,
    adaptationReason?: string,
    adaptations?: string[]
  ): HealthProfile {
    const updatedMemory = {
      rememberedFacts: [...healthProfile.systemMemory.rememberedFacts],
      adaptationHistory: [...healthProfile.systemMemory.adaptationHistory]
    };

    // Додаємо факт, якщо його ще немає
    if (!updatedMemory.rememberedFacts.includes(fact)) {
      updatedMemory.rememberedFacts.push(fact);
    }

    // Додаємо запис про адаптацію
    if (adaptationReason && adaptations) {
      updatedMemory.adaptationHistory.push({
        date: new Date(),
        reason: adaptationReason,
        adaptations
      });
    }

    return {
      ...healthProfile,
      systemMemory: updatedMemory
    };
  }

  /**
   * Отримує всі поточні обмеження (постійні + тимчасові)
   */
  static getAllCurrentLimitations(
    userProfile: UserProfile,
    wellnessCheck?: WellnessCheck
  ): string[] {
    const limitations: string[] = [];

    // Додаємо застарілі обмеження для зворотньої сумісності
    if (userProfile.healthConstraints) {
      limitations.push(...userProfile.healthConstraints);
    }

    // Додаємо обмеження з нового профілю здоров'я
    if (userProfile.healthProfile) {
      // Додаємо поточні обмеження
      limitations.push(...userProfile.healthProfile.currentLimitations);
      
      // ВАЖЛИВО: Додаємо активні проблеми здоров'я як обмеження
      const activeConditions = userProfile.healthProfile.conditions?.filter(c => c.isActive) || [];
      activeConditions.forEach(condition => {
        // Додаємо назву проблеми
        limitations.push(condition.condition);
        // Додаємо уражені області
        limitations.push(...condition.affectedAreas);
      });
    }

    // Додаємо тимчасові обмеження з самопочуття
    if (wellnessCheck?.notes) {
      const temporaryIssues = this.analyzeWellnessNotes(wellnessCheck.notes);
      limitations.push(...temporaryIssues);
    }

    return [...new Set(limitations)]; // видаляємо дублікати
  }

  /**
   * Генерує текстовий опис стану здоров'я для AI
   */
  static generateHealthSummaryForAI(userProfile: UserProfile, wellnessCheck?: WellnessCheck): string {
    const limitations = this.getAllCurrentLimitations(userProfile, wellnessCheck);
    
    if (limitations.length === 0) {
      return "🏥 СТАН ЗДОРОВ'Я: Користувач не має відомих обмежень здоров'я.";
    }

    let summary = "🏥 КРИТИЧНО ВАЖЛИВО - СТАН ЗДОРОВ'Я:\n";
    
    // Активні проблеми здоров'я
    const activeConditions = userProfile.healthProfile?.conditions?.filter(c => c.isActive) || [];
    if (activeConditions.length > 0) {
      summary += `🚨 АКТИВНІ ПРОБЛЕМИ ЗДОРОВ'Я (${activeConditions.length}):\n`;
      activeConditions.forEach(condition => {
        const severityText = condition.severity === 'severe' ? '🔴 СЕРЙОЗНА' : 
                           condition.severity === 'moderate' ? '🟡 ПОМІРНА' : '🟢 ЛЕГКА';
        const typeText = condition.type === 'chronic' ? 'хронічна' : 
                        condition.type === 'temporary' ? 'тимчасова' : 'відновлення';
        
        summary += `• ${severityText} ${typeText}: "${condition.condition}"\n`;
        if (condition.affectedAreas.length > 0) {
          summary += `  Уражені області: ${condition.affectedAreas.join(', ')}\n`;
        }
        if (condition.notes) {
          summary += `  Примітки: ${condition.notes}\n`;
        }
      });
    }
    
    // Постійні обмеження
    const permanentLimitations = userProfile.healthProfile?.currentLimitations || userProfile.healthConstraints || [];
    if (permanentLimitations.length > 0) {
      summary += `• Постійні обмеження: ${permanentLimitations.join(', ')}\n`;
    }

    // Тимчасові обмеження
    if (wellnessCheck?.notes) {
      const temporaryIssues = this.analyzeWellnessNotes(wellnessCheck.notes);
      if (temporaryIssues.length > 0) {
        summary += `• Тимчасові (сьогодні): ${temporaryIssues.join(', ')}\n`;
        summary += `• Деталі: "${wellnessCheck.notes}"\n`;
      }
    }

    // Пам'ять системи
    if (userProfile.healthProfile?.systemMemory.rememberedFacts.length) {
      summary += `• Система пам'ятає: ${userProfile.healthProfile.systemMemory.rememberedFacts.join(', ')}\n`;
    }

    summary += `\n⚠️ ОБОВ'ЯЗКОВО: Адаптуй всі вправи з урахуванням цих проблем здоров'я!`;

    return summary;
  }

  /**
   * Очищає пам'ять системи (видаляє всі запам'ятовані факти та історію адаптацій)
   */
  static clearSystemMemory(healthProfile: HealthProfile): HealthProfile {
    return {
      ...healthProfile,
      systemMemory: {
        rememberedFacts: [],
        adaptationHistory: []
      }
    };
  }

  /**
   * Очищає тільки історію адаптацій, залишаючи запам'ятовані факти
   */
  static clearAdaptationHistory(healthProfile: HealthProfile): HealthProfile {
    return {
      ...healthProfile,
      systemMemory: {
        ...healthProfile.systemMemory,
        adaptationHistory: []
      }
    };
  }

  /**
   * Очищає тільки запам'ятовані факти, залишаючи історію адаптацій
   */
  static clearRememberedFacts(healthProfile: HealthProfile): HealthProfile {
    return {
      ...healthProfile,
      systemMemory: {
        ...healthProfile.systemMemory,
        rememberedFacts: []
      }
    };
  }

  /**
   * Мігрує старі healthConstraints в новий формат
   */
  static migrateOldHealthConstraints(userProfile: UserProfile): UserProfile {
    if (!userProfile.healthConstraints || userProfile.healthProfile) {
      return userProfile; // вже мігровано або немає що мігрувати
    }

    const healthProfile = this.createInitialHealthProfile();
    
    // Конвертуємо старі обмеження в нові умови
    userProfile.healthConstraints.forEach(constraint => {
      const condition: Omit<HealthCondition, 'id'> = {
        type: 'chronic', // припускаємо, що старі обмеження - хронічні
        condition: `проблема з ${constraint}`,
        severity: 'moderate',
        affectedAreas: [constraint],
        startDate: new Date(), // не знаємо точної дати
        isActive: true,
        notes: 'Мігровано зі старої системи'
      };

      healthProfile.conditions.push({
        ...condition,
        id: uuidv4()
      });
    });

    const updatedHealthProfile = HealthProfileService.updateCurrentLimitations(healthProfile);

    return {
      ...userProfile,
      healthProfile: updatedHealthProfile
    };
  }
}
