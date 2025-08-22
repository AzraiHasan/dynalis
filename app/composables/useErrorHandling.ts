// composables/useErrorHandling.ts
import { ref } from 'vue'

// Standard error types for consistent error categorization
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface StandardError {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  details?: unknown
  timestamp: number
  context?: string
  recoverable: boolean
  userMessage?: string
}

export interface ServiceResponse<T = unknown> {
  success: boolean
  data?: T
  error?: StandardError
  metadata?: {
    timestamp: number
    requestId?: string
    performanceMetrics?: {
      duration: number
      memoryUsage?: number
    }
  }
}

/**
 * Standardized error handling composable
 * Provides consistent error handling patterns across all services
 */
export const useErrorHandling = () => {
  const currentError = ref<StandardError | null>(null)
  const errorHistory = ref<StandardError[]>([])
  
  /**
   * Creates a standardized error object
   */
  const createError = (
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: {
      details?: unknown
      context?: string
      recoverable?: boolean
      userMessage?: string
    } = {}
  ): StandardError => {
    const error: StandardError = {
      type,
      severity,
      message,
      details: options.details,
      timestamp: Date.now(),
      context: options.context,
      recoverable: options.recoverable ?? false,
      userMessage: options.userMessage || message
    }
    
    // Add to error history for debugging
    errorHistory.value.push(error)
    
    // Keep only last 50 errors to prevent memory leaks
    if (errorHistory.value.length > 50) {
      errorHistory.value = errorHistory.value.slice(-50)
    }
    
    return error
  }
  
  /**
   * Converts native Error objects to StandardError
   */
  const normalizeError = (
    error: unknown,
    context?: string,
    type: ErrorType = ErrorType.UNKNOWN
  ): StandardError => {
    if (error instanceof Error) {
      return createError(
        error.message,
        type,
        ErrorSeverity.MEDIUM,
        {
          details: error.stack,
          context,
          recoverable: false
        }
      )
    }
    
    return createError(
      String(error),
      type,
      ErrorSeverity.MEDIUM,
      {
        context,
        recoverable: false
      }
    )
  }
  
  /**
   * Categorizes errors based on common patterns
   */
  const categorizeError = (error: unknown): ErrorType => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorType.NETWORK
    }
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorType.AUTHENTICATION
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorType.AUTHORIZATION
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION
    }
    
    if (message.includes('server') || message.includes('internal')) {
      return ErrorType.SERVER
    }
    
    return ErrorType.CLIENT
  }
  
  /**
   * Safe wrapper for async operations with standardized error handling
   */
  const wrapAsync = async <T>(
    operation: () => Promise<T>,
    context: string,
    options: {
      retries?: number
      timeout?: number
      fallback?: T
    } = {}
  ): Promise<ServiceResponse<T>> => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    for (let attempt = 0; attempt <= (options.retries || 0); attempt++) {
      try {
        // Add timeout if specified
        let result: T
        if (options.timeout) {
          result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Operation timeout')), options.timeout)
            )
          ])
        } else {
          result = await operation()
        }
        
        const duration = Date.now() - startTime
        
        return {
          success: true,
          data: result,
          metadata: {
            timestamp: Date.now(),
            requestId,
            performanceMetrics: {
              duration
            }
          }
        }
      } catch (error) {
        const isLastAttempt = attempt === (options.retries || 0)
        
        if (isLastAttempt) {
          const standardError = normalizeError(
            error,
            `${context} (attempt ${attempt + 1}/${(options.retries || 0) + 1})`,
            categorizeError(error)
          )
          
          currentError.value = standardError
          
          const duration = Date.now() - startTime
          
          return {
            success: false,
            error: standardError,
            data: options.fallback,
            metadata: {
              timestamp: Date.now(),
              requestId,
              performanceMetrics: {
                duration
              }
            }
          }
        }
        
        // Wait before retry with exponential backoff
        if (options.retries && attempt < options.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // This should never be reached, but TypeScript requires it
    const fallbackError = createError(
      'Unexpected error in wrapAsync',
      ErrorType.UNKNOWN,
      ErrorSeverity.HIGH,
      { context, recoverable: false }
    )
    
    return {
      success: false,
      error: fallbackError,
      data: options.fallback
    }
  }
  
  /**
   * Clear current error
   */
  const clearError = () => {
    currentError.value = null
  }
  
  /**
   * Get user-friendly error message
   */
  const getUserMessage = (error: StandardError): string => {
    if (error.userMessage) {
      return error.userMessage
    }
    
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.'
      case ErrorType.AUTHENTICATION:
        return 'Authentication required. Please sign in and try again.'
      case ErrorType.AUTHORIZATION:
        return 'You do not have permission to perform this action.'
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.'
      case ErrorType.SERVER:
        return 'Server error. Please try again later.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }
  
  return {
    // State
    currentError: readonly(currentError),
    errorHistory: readonly(errorHistory),
    
    // Error creation and normalization
    createError,
    normalizeError,
    categorizeError,
    
    // Async operation wrapper
    wrapAsync,
    
    // Utility functions
    clearError,
    getUserMessage,
    
    // Types for external use
    ErrorType,
    ErrorSeverity
  }
}

// Export types for use in other composables
export type { StandardError, ServiceResponse }