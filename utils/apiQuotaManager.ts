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
  private readonly DEFAULT_DAILY_LIMIT = 45; // Conservative limit (below 50)
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
    return !status.isExceeded && status.requestCount < status.dailyLimit;
  }

  /**
   * Record a successful API request
   */
  recordRequest(): void {
    const status = this.getQuotaStatus();
    status.requestCount++;
    status.isExceeded = status.requestCount >= status.dailyLimit;
    this.saveQuotaStatus(status);
  }

  /**
   * Record a quota exceeded error
   */
  recordQuotaExceeded(retryAfterSeconds?: number): void {
    const status = this.getQuotaStatus();
    status.isExceeded = true;
    status.retryAfter = retryAfterSeconds ? Date.now() + (retryAfterSeconds * 1000) : undefined;
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
  } = {}
): Promise<T> {
  const quotaManager = ApiQuotaManager.getInstance();
  const { skipOnQuotaExceeded = false } = options;

  // Check if service is overloaded before making any request
  if (quotaManager.isServiceOverloaded()) {
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
    if (skipOnQuotaExceeded && fallbackValue !== undefined) {
      console.warn('Skipping API call due to quota exceeded, using fallback');
      return fallbackValue;
    }
    throw new Error(`API quota exceeded. ${quotaManager.getStatusMessage()}`);
  }

  let attempt = 1;
  const maxAttempts = 3;

  while (attempt <= maxAttempts) {
    try {
      const result = await apiCall();
      quotaManager.recordRequest();
      
      // Clear service overload status on successful request
      if (quotaManager.isServiceOverloaded()) {
        quotaManager.clearServiceOverload();
      }
      
      return result;
    } catch (error: any) {
      // Check if it's a quota error
      const isQuotaError = error.message?.includes('429') || 
                          error.message?.includes('quota') ||
                          error.message?.includes('Too Many Requests');
      
      // Check if it's a service overload error
      const isServiceOverloadError = error.message?.includes('503') ||
                                    error.message?.includes('Service Unavailable') ||
                                    error.message?.includes('overload') ||
                                    error.message?.includes('overloaded');

      if (isQuotaError) {
        // Extract retry-after from error message if available
        const retryMatch = error.message.match(/retryDelay":"(\d+)s/);
        const retryAfter = retryMatch ? parseInt(retryMatch[1]) : undefined;
        
        quotaManager.recordQuotaExceeded(retryAfter);
        
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
    const essentialFeatures: string[] = []; // No features are considered essential during overload
    return essentialFeatures.includes(feature);
  }
  
  if (!status.isExceeded) return true;
  
  // Priority features that should work even with limited quota
  const highPriorityFeatures = ['chat'];
  const remaining = status.dailyLimit - status.requestCount;
  
  if (highPriorityFeatures.includes(feature) && remaining > 0) {
    return true;
  }
  
  return false;
}

export const quotaManager = ApiQuotaManager.getInstance();
export default ApiQuotaManager;