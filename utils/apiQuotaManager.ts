/**
 * API Quota Management System for Gemini API
 * Prevents quota exhaustion and implements intelligent retry logic
 */

interface QuotaStatus {
  requestCount: number;
  lastReset: number;
  dailyLimit: number;
  isExceeded: boolean;
  retryAfter?: number;
  serviceOverloaded?: boolean;
  lastOverloadTime?: number;
}

interface RetryInfo {
  shouldRetry: boolean;
  delayMs: number;
  attemptsLeft: number;
}

class ApiQuotaManager {
  private static instance: ApiQuotaManager;
  private readonly STORAGE_KEY = 'gemini_quota_status';
  private readonly DEFAULT_DAILY_LIMIT = 200; // Підвищуємо ліміт для Flash моделей (250 RPD)
  private readonly RESET_HOUR = 0; // Reset at midnight

  private constructor() {}

  static getInstance(): ApiQuotaManager {
    if (!ApiQuotaManager.instance) {
      ApiQuotaManager.instance = new ApiQuotaManager();
    }
    return ApiQuotaManager.instance;
  }

  /**
   * Get current quota status
   */
  getQuotaStatus(): QuotaStatus {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    
    if (!stored) {
      return this.createNewQuotaStatus();
    }

    try {
      const status: QuotaStatus = JSON.parse(stored);
      
      // Check if we should reset the quota (new day)
      if (this.shouldResetQuota(status.lastReset)) {
        return this.createNewQuotaStatus();
      }

      // Auto-reset exceeded status if retry period has passed and request count is reasonable
      if (status.isExceeded && status.retryAfter && Date.now() >= status.retryAfter) {
        console.log('🔄 [QUOTA] Auto-resetting exceeded status - retry period expired');
        status.isExceeded = false;
        status.retryAfter = undefined;
        this.saveQuotaStatus(status);
      }

      // Additional auto-fix: if exceeded flag is set but we're clearly under limit
      if (status.isExceeded && status.requestCount < (status.dailyLimit * 0.8)) {
        console.log('🔧 [QUOTA] Auto-fixing exceeded flag - request count well below limit:', {
          count: status.requestCount,
          limit: status.dailyLimit,
          percentage: Math.round((status.requestCount / status.dailyLimit) * 100)
        });
        status.isExceeded = false;
        status.retryAfter = undefined;
        this.saveQuotaStatus(status);
      }

      return status;
    } catch (error) {
      console.error('Error parsing quota status:', error);
      return this.createNewQuotaStatus();
    }
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(): boolean {
    const status = this.getQuotaStatus();
    
    // SIMPLIFIED LOGIC: Primary check is just request count vs limit
    const basicCheck = status.requestCount < status.dailyLimit;
    
    // Auto-fix any stuck "exceeded" flags when request count is clearly below limit
    if (status.isExceeded && status.requestCount < (status.dailyLimit * 0.9)) {
      console.warn('🔧 [QUOTA] Auto-fixing stuck exceeded flag - request count too low:', {
        requestCount: status.requestCount,
        limit: status.dailyLimit,
        percentage: Math.round((status.requestCount / status.dailyLimit) * 100)
      });
      status.isExceeded = false;
      status.retryAfter = undefined;
      this.saveQuotaStatus(status);
    }
    
    // Check retry-after only if we have a future timestamp
    const retryCheck = !status.retryAfter || Date.now() >= status.retryAfter;
    
    const canMake = basicCheck && !status.isExceeded && retryCheck;
    
    console.log('🔍 [QUOTA] Simple quota check:', {
      requestCount: status.requestCount,
      dailyLimit: status.dailyLimit,
      percentage: Math.round((status.requestCount / status.dailyLimit) * 100),
      isExceeded: status.isExceeded,
      retryAfter: status.retryAfter ? new Date(status.retryAfter).toLocaleTimeString() : null,
      basicCheck,
      retryCheck,
      finalDecision: canMake
    });
    
    return canMake;
  }

  /**
   * Record a successful API request
   */
  recordRequest(): void {
    const status = this.getQuotaStatus();
    const oldCount = status.requestCount;
    status.requestCount++;
    
    // Only mark as exceeded if we go significantly over the limit (more conservative)
    const wasExceeded = status.isExceeded;
    // Only mark exceeded if we go 20+ requests over the limit (was 15)
    status.isExceeded = status.requestCount >= (status.dailyLimit + 20);
    
    console.log('✓ [QUOTA] Request recorded:', {
      oldCount,
      newCount: status.requestCount,
      dailyLimit: status.dailyLimit,
      percentage: Math.round((status.requestCount / status.dailyLimit) * 100),
      wasExceeded,
      nowExceeded: status.isExceeded
    });
    
    this.saveQuotaStatus(status);
  }

  /**
   * Record a quota exceeded error
   */
  recordQuotaExceeded(retryAfterSeconds?: number): void {
    const status = this.getQuotaStatus();
    status.isExceeded = true;
    status.retryAfter = retryAfterSeconds ? Date.now() + (retryAfterSeconds * 1000) : undefined;
    
    console.error('😱 QUOTA EXCEEDED recorded:', {
      requestCount: status.requestCount,
      retryAfterSeconds,
      retryAfterTime: status.retryAfter ? new Date(status.retryAfter).toLocaleString() : null
    });
    
    this.saveQuotaStatus(status);
  }

  /**
   * Record a service overload error (503)
   */
  recordServiceOverload(): void {
    const status = this.getQuotaStatus();
    status.serviceOverloaded = true;
    status.lastOverloadTime = Date.now();
    this.saveQuotaStatus(status);
  }

  /**
   * Check if service is currently considered overloaded
   */
  isServiceOverloaded(): boolean {
    const status = this.getQuotaStatus();
    
    if (!status.serviceOverloaded || !status.lastOverloadTime) {
      return false;
    }
    
    // Consider service overloaded for 10 minutes after last 503 error (increased from 5)
    const OVERLOAD_COOLDOWN = 10 * 60 * 1000; // 10 minutes
    return Date.now() - status.lastOverloadTime < OVERLOAD_COOLDOWN;
  }

  /**
   * Clear service overload status
   */
  clearServiceOverload(): void {
    const status = this.getQuotaStatus();
    status.serviceOverloaded = false;
    status.lastOverloadTime = undefined;
    this.saveQuotaStatus(status);
  }

  /**
   * Get retry information for failed requests
   */
  getRetryInfo(attempt: number = 1, isServiceOverload: boolean = false): RetryInfo {
    const status = this.getQuotaStatus();
    
    if (!status.isExceeded && !isServiceOverload) {
      return { shouldRetry: false, delayMs: 0, attemptsLeft: 0 };
    }

    const maxAttempts = isServiceOverload ? 2 : 3; // Fewer retries for service overload
    const attemptsLeft = Math.max(0, maxAttempts - attempt);
    
    if (attemptsLeft === 0) {
      return { shouldRetry: false, delayMs: 0, attemptsLeft: 0 };
    }

    // Calculate delay based on error type
    let delayMs = 60000; // Default 1 minute
    
    if (isServiceOverload) {
      // For service overload: 30s, 2min (shorter delays, fewer retries)
      delayMs = attempt === 1 ? 30000 : 120000;
    } else if (status.retryAfter && status.retryAfter > Date.now()) {
      delayMs = status.retryAfter - Date.now();
    } else {
      // Exponential backoff for quota errors: 1min, 5min, 15min
      delayMs = Math.min(60000 * Math.pow(3, attempt - 1), 900000);
    }

    return {
      shouldRetry: true,
      delayMs,
      attemptsLeft
    };
  }

  /**
   * Get time until quota reset
   */
  getTimeUntilReset(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.RESET_HOUR, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(): string {
    const status = this.getQuotaStatus();
    
    if (this.isServiceOverloaded()) {
      return 'AI service temporarily overloaded. Some features may be limited.';
    }
    
    if (!status.isExceeded) {
      const remaining = status.dailyLimit - status.requestCount;
      return `${remaining} AI requests remaining today`;
    }

    const resetTime = this.getTimeUntilReset();
    const hours = Math.floor(resetTime / (1000 * 60 * 60));
    const minutes = Math.floor((resetTime % (1000 * 60 * 60)) / (1000 * 60));
    
    return `API quota exceeded. Resets in ${hours}h ${minutes}m`;
  }

  /**
   * Reset quota manually (for testing or admin purposes)
   */
  resetQuota(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('Quota status reset manually');
  }

  /**
   * Force clear quota exceeded status (emergency reset)
   */
  clearQuotaExceeded(): void {
    const status = this.getQuotaStatus();
    status.isExceeded = false;
    status.retryAfter = undefined;
    status.serviceOverloaded = false;
    status.lastOverloadTime = undefined;
    // Reset request count to allow some requests
    status.requestCount = Math.max(0, status.requestCount - 10);
    this.saveQuotaStatus(status);
    console.log('Quota exceeded status cleared manually');
  }

  private createNewQuotaStatus(): QuotaStatus {
    const status: QuotaStatus = {
      requestCount: 0,
      lastReset: Date.now(),
      dailyLimit: this.DEFAULT_DAILY_LIMIT,
      isExceeded: false
    };
    this.saveQuotaStatus(status);
    return status;
  }

  private shouldResetQuota(lastReset: number): boolean {
    const now = new Date();
    const lastResetDate = new Date(lastReset);
    
    // Reset if it's a new day after midnight
    return now.getDate() !== lastResetDate.getDate() || 
           now.getMonth() !== lastResetDate.getMonth() ||
           now.getFullYear() !== lastResetDate.getFullYear();
  }

  private saveQuotaStatus(status: QuotaStatus): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(status));
    } catch (error) {
      console.error('Error saving quota status:', error);
    }
  }
}

/**
 * Wrapper function for API calls with quota management
 */
export async function withQuotaManagement<T>(
  apiCall: () => Promise<T>,
  fallbackValue?: T,
  options: {
    priority?: 'high' | 'medium' | 'low';
    skipOnQuotaExceeded?: boolean;
    bypassQuotaInDev?: boolean; // New option for development
  } = {}
): Promise<T> {
  const quotaManager = ApiQuotaManager.getInstance();
  const { skipOnQuotaExceeded = false, bypassQuotaInDev = false } = options;

  console.log('🚀 API call starting:', {
    priority: options.priority,
    skipOnQuotaExceeded,
    hasFallback: fallbackValue !== undefined,
    bypassQuotaInDev
  });

  // Development bypass mode
  if (import.meta.env.DEV && bypassQuotaInDev) {
    console.log('🚑 Development bypass mode - ignoring all quota checks');
    try {
      const result = await apiCall();
      console.log('✅ API call successful (bypassed)');
      return result;
    } catch (error: any) {
      console.warn('⚠️ API call failed even with bypass:', error.message);
      if (fallbackValue !== undefined) {
        console.log('🔄 Using fallback value due to API error');
        return fallbackValue;
      }
      throw error;
    }
  }

  // Check if service is overloaded before making any request
  if (quotaManager.isServiceOverloaded()) {
    console.warn('⚠️ Service overloaded detected');
    // For low/medium priority features, immediately return fallback during service overload
    if ((options.priority === 'low' || options.priority === 'medium') && skipOnQuotaExceeded && fallbackValue !== undefined) {
      console.warn('AI service overloaded, skipping non-critical feature');
      return fallbackValue;
    }
    // For high priority features, allow one attempt but with longer delay
    if (options.priority !== 'high') {
      throw new Error('AI service is temporarily overloaded. Please try again in a few minutes.');
    }
  }

  // Check if we can make the request
  if (!quotaManager.canMakeRequest()) {
    console.warn('❌ Cannot make request due to quota');
    if (skipOnQuotaExceeded && fallbackValue !== undefined) {
      console.warn('Skipping API call due to quota exceeded, using fallback');
      return fallbackValue;
    }
    throw new Error(`API quota exceeded. ${quotaManager.getStatusMessage()}`);
  }

  let attempt = 1;
  const maxAttempts = 3;

  while (attempt <= maxAttempts) {
    console.log(`🗺️ Attempt ${attempt}/${maxAttempts}`);
    try {
      const result = await apiCall();
      console.log('✅ API call successful');
      quotaManager.recordRequest();
      
      // Clear service overload status on successful request
      if (quotaManager.isServiceOverloaded()) {
        quotaManager.clearServiceOverload();
      }
      
      return result;
    } catch (error: any) {
      console.error(`🚨 API call failed (attempt ${attempt}):`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      // Check if it's a quota error - improved detection for Google API errors
      const errorMessage = error.message || '';
      const errorStr = error.toString() || '';
      
      // More precise quota error detection
      const isQuotaError = 
        error.status === 429 || 
        error.status === 403 ||
        errorMessage.includes('429') || 
        errorMessage.includes('403') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('Too Many Requests') ||
        errorMessage.includes('Quota exceeded') ||
        errorMessage.includes('QUOTA_EXCEEDED') ||
        errorMessage.includes('Resource has been exhausted') ||
        errorStr.includes('429') ||
        (errorMessage.includes('generativelanguage.googleapis.com') && 
         (errorMessage.includes('limit') || errorMessage.includes('exceeded')));
      
      // More precise service overload detection
      const isServiceOverloadError = 
        error.status === 503 ||
        errorMessage.includes('503') ||
        errorMessage.includes('Service Unavailable') ||
        errorMessage.includes('overload') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('temporarily unavailable');

      console.log('🔍 Error classification:', {
        isQuotaError,
        isServiceOverloadError,
        errorMessage: errorMessage.substring(0, 200),
        errorStatus: error.status
      });

      if (isQuotaError) {
        console.error('Quota error detected:', {
          message: errorMessage,
          status: error.status,
          attempt: attempt,
          maxAttempts: maxAttempts
        });
        
        // Extract retry-after from error message if available
        const retryMatch = errorMessage.match(/retryDelay[":]\s*["']?(\d+)s?["']?/i) ||
                          errorMessage.match(/retry[\s-]?after[":]\s*["']?(\d+)["']?/i) ||
                          errorMessage.match(/(\d+)\s*seconds?/i);
        const retryAfter = retryMatch ? parseInt(retryMatch[1]) : undefined;
        
        quotaManager.recordQuotaExceeded(retryAfter);
        
        // For 429 errors with retry delays, fail immediately (don't retry)
        if (retryAfter || error.status === 429) {
          console.warn('Google API rate limit exceeded with retry delay, failing immediately');
          if (skipOnQuotaExceeded && fallbackValue !== undefined) {
            console.warn('API quota exceeded, using fallback value');
            return fallbackValue;
          }
          throw new Error('AI service rate limit exceeded. Please try again in a few minutes.');
        }
        
        if (skipOnQuotaExceeded && fallbackValue !== undefined) {
          console.warn('API quota exceeded, using fallback value');
          return fallbackValue;
        }
      }
      
      if (isServiceOverloadError) {
        quotaManager.recordServiceOverload();
        
        // For any priority feature during service overload, use fallback immediately
        if (skipOnQuotaExceeded && fallbackValue !== undefined) {
          console.warn('AI service overloaded, using fallback instead of retrying');
          return fallbackValue;
        }
        
        // If no fallback available, don't retry on service overload - fail fast
        throw new Error('AI service is temporarily overloaded. Please try again in a few minutes.');
      }

      const retryInfo = quotaManager.getRetryInfo(attempt, isServiceOverloadError);
      
      if (!retryInfo.shouldRetry || attempt >= maxAttempts) {
        throw error;
      }

      console.warn(`API call failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(retryInfo.delayMs/1000)}s...`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryInfo.delayMs));
      attempt++;
    }
  }

  throw new Error('Max retry attempts exceeded');
}

/**
 * Check if feature should be enabled based on quota
 */
export function shouldEnableAIFeature(feature: 'variations' | 'analysis' | 'chat' | 'recommendations'): boolean {
  const quotaManager = ApiQuotaManager.getInstance();
  const status = quotaManager.getQuotaStatus();
  
  // If service is overloaded, disable all non-essential features
  if (quotaManager.isServiceOverloaded()) {
    const essentialFeatures: string[] = ['chat']; // Keep chat available even during overload
    return essentialFeatures.includes(feature);
  }
  
  // Смарт-логіка для Free Tier: зберігаємо запити для важливих функцій
  const usagePercent = (status.requestCount / status.dailyLimit) * 100;
  
  // Пріоритетні функції за важливістю
  const highPriorityFeatures = ['chat']; // Чат - найважливіше
  const mediumPriorityFeatures = ['analysis']; // Аналіз - середній пріоритет
  const lowPriorityFeatures = ['variations', 'recommendations']; // Низький пріоритет
  
  // Чат завжди доступний (навіть при 90% використання)
  if (highPriorityFeatures.includes(feature)) {
    return usagePercent < 95;
  }
  
  // Аналіз доступний до 70% використання
  if (mediumPriorityFeatures.includes(feature)) {
    return usagePercent < 70;
  }
  
  // Низькопріоритетні до 50%
  if (lowPriorityFeatures.includes(feature)) {
    return usagePercent < 50;
  }
  
  return usagePercent < 80; // За замовчуванням
}

export const quotaManager = ApiQuotaManager.getInstance();

/**
 * Розумний вибір моделі на основі поточного використання квоти
 * При наближенні до ліміту перемикаємось на більш економні моделі
 */
export function getSmartModel(preferredModel: string): string {
  const status = quotaManager.getQuotaStatus();
  const usagePercent = (status.requestCount / status.dailyLimit) * 100;
  
  // Якщо використано менше 50% - використовуємо оригінальну модель
  if (usagePercent < 50) {
    return preferredModel;
  }
  
  // При 50-80% використання - перемикаємось на Flash-Lite для некритичних задач
  if (usagePercent >= 50 && usagePercent < 80) {
    // Тільки чат залишається на оригінальній моделі
    if (preferredModel === 'gemini-2.5-flash' && 
        (preferredModel !== 'gemini-2.5-flash' /* чат */)) {
      return 'gemini-2.5-flash-lite'; // Перемикаємось на Lite
    }
    return preferredModel;
  }
  
  // При 80%+ - все крім чату на Flash-Lite
  if (usagePercent >= 80) {
    return 'gemini-2.5-flash-lite'; // Найекономніша модель
  }
  
  return preferredModel;
}

/**
 * Force clear quota exceeded status and reset to usable state
 * Use this when quota gets stuck showing green but blocking requests
 */
export const forceResetQuota = () => {
  const quotaManager = ApiQuotaManager.getInstance();
  const status = quotaManager.getQuotaStatus();
  
  console.log('🔧 [QUOTA] Force resetting quota to clear stuck state');
  console.log('🔍 [QUOTA] Before reset:', {
    requestCount: status.requestCount,
    dailyLimit: status.dailyLimit,
    isExceeded: status.isExceeded,
    retryAfter: status.retryAfter
  });
  
  // Force clear all blocking conditions
  status.isExceeded = false;
  status.retryAfter = undefined;
  status.serviceOverloaded = false;
  status.lastOverloadTime = undefined;
  
  // Reset count to ensure we're well below limit
  if (status.requestCount > status.dailyLimit * 0.8) {
    status.requestCount = Math.floor(status.dailyLimit * 0.5); // Reset to 50% of limit
  }
  
  // Save the corrected status
  localStorage.setItem('gemini_quota_status', JSON.stringify(status));
  
  console.log('✅ [QUOTA] After reset:', {
    requestCount: status.requestCount,
    dailyLimit: status.dailyLimit,
    isExceeded: status.isExceeded,
    retryAfter: status.retryAfter,
    canMakeRequest: quotaManager.canMakeRequest()
  });
  
  return status;
};

/**
 * Emergency function to clear quota exceeded status
 * Use this when the quota manager gets stuck in exceeded state
 */
export const clearQuotaExceeded = () => {
  quotaManager.clearQuotaExceeded();
};

/**
 * Disable quota checks entirely (for development/testing)
 */
export const disableQuotaChecks = () => {
  const status = quotaManager.getQuotaStatus();
  status.requestCount = 0;
  status.isExceeded = false;
  status.dailyLimit = 99999; // Very high limit
  status.serviceOverloaded = false;
  status.lastOverloadTime = undefined;
  status.retryAfter = undefined;
  // Use localStorage directly since saveQuotaStatus is private
  localStorage.setItem('gemini_quota_status', JSON.stringify(status));
  console.log('✅ Quota checks disabled - all AI features should work');
};

/**
 * Get current quota status for debugging
 */
export const getQuotaStatus = () => {
  return quotaManager.getQuotaStatus();
};

/**
 * Emergency bypass - completely disable quota system
 */
export const emergencyBypass = () => {
  // Override the canMakeRequest method to always return true
  (quotaManager as any).canMakeRequest = () => {
    console.log('🚑 Emergency bypass active - quota checks disabled');
    return true;
  };
  
  // Clear localStorage
  localStorage.removeItem('gemini_quota_status');
  
  // Create a clean state
  const cleanStatus = {
    requestCount: 0,
    lastReset: Date.now(),
    dailyLimit: 999999,
    isExceeded: false,
    retryAfter: undefined,
    serviceOverloaded: false,
    lastOverloadTime: undefined
  };
  localStorage.setItem('gemini_quota_status', JSON.stringify(cleanStatus));
  
  console.log('🚑 Emergency bypass activated - all quota restrictions removed');
  return cleanStatus;
};

// Make quota functions available globally in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).quotaDebug = {
    getStatus: getQuotaStatus,
    clearQuotaExceeded,
    disableQuotaChecks,
    emergencyBypass,
    forceResetQuota, // Add the new force reset function
    resetQuota: () => quotaManager.resetQuota(),
    manager: quotaManager,
    // Add new debug functions
    inspectLocalStorage: () => {
      const stored = localStorage.getItem('gemini_quota_status');
      console.log('🔍 LocalStorage content:', stored);
      return stored ? JSON.parse(stored) : null;
    },
    forceAllowRequests: () => {
      const status = quotaManager.getQuotaStatus();
      status.isExceeded = false;
      status.requestCount = 0;
      status.retryAfter = undefined;
      status.serviceOverloaded = false;
      status.lastOverloadTime = undefined;
      localStorage.setItem('gemini_quota_status', JSON.stringify(status));
      console.log('✅ Forced all requests to be allowed');
      return status;
    },
    manualTest: () => {
      console.log('🧪 Testing quota logic manually...');
      console.log('canMakeRequest():', quotaManager.canMakeRequest());
      console.log('getQuotaStatus():', quotaManager.getQuotaStatus());
      console.log('isServiceOverloaded():', quotaManager.isServiceOverloaded());
    }
  };
  console.log('🛠️ Quota debug functions available at window.quotaDebug');
  console.log('🐛 To fix stuck quota: window.quotaDebug.forceResetQuota()');
  console.log('🐛 To disable quota entirely: window.quotaDebug.disableQuotaChecks()');
  console.log('🚑 Emergency bypass: window.quotaDebug.emergencyBypass()');
  console.log('🔧 Current quota status:', getQuotaStatus());
  
  // Auto-fix any stuck quota on page load in development
  console.log('🛠️ Development mode: Auto-fixing any stuck quota states');
  setTimeout(() => {
    const currentStatus = getQuotaStatus();
    // If quota shows as exceeded but count is reasonable, auto-fix it
    if (currentStatus.isExceeded && currentStatus.requestCount < (currentStatus.dailyLimit * 0.9)) {
      console.log('🔧 Auto-fixing stuck quota in development');
      forceResetQuota();
    }
    console.log('📊 Final quota status:', getQuotaStatus());
  }, 1000);
}

export default ApiQuotaManager;