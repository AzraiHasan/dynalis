// composables/useServiceBase.ts
import { ref, computed, type Ref } from 'vue'
import { useErrorHandling, type ServiceResponse, type StandardError } from './useErrorHandling'

// Standard loading states
export interface LoadingState {
  isLoading: boolean
  isIdle: boolean
  hasError: boolean
  hasData: boolean
}

// Standard service state
export interface ServiceState<T = unknown> {
  data: T | null
  error: StandardError | null
  isLoading: boolean
  lastFetched: number
  requestId: string | null
}

// Standard service configuration
export interface ServiceConfig {
  cacheTimeout?: number // Cache timeout in milliseconds
  retries?: number
  timeout?: number
  enableCache?: boolean
}

/**
 * Base composable for all services providing standardized patterns
 */
export const useServiceBase = <T>(
  serviceName: string,
  defaultConfig: ServiceConfig = {}
) => {
  const errorHandler = useErrorHandling()
  
  // Default configuration
  const config = {
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    retries: 2,
    timeout: 30000, // 30 seconds
    enableCache: true,
    ...defaultConfig
  }
  
  // Service state
  const state = ref<ServiceState<T>>({
    data: null,
    error: null,
    isLoading: false,
    lastFetched: 0,
    requestId: null
  })
  
  // Computed properties for standardized access
  const isLoading = computed(() => state.value.isLoading)
  const hasError = computed(() => state.value.error !== null)
  const hasData = computed(() => state.value.data !== null)
  const isIdle = computed(() => !isLoading.value && !hasError.value)
  const isCacheValid = computed(() => {
    if (!config.enableCache || state.value.lastFetched === 0) return false
    return (Date.now() - state.value.lastFetched) < config.cacheTimeout!
  })
  
  const loadingState = computed<LoadingState>(() => ({
    isLoading: isLoading.value,
    isIdle: isIdle.value,
    hasError: hasError.value,
    hasData: hasData.value
  }))
  
  /**
   * Execute an operation with standardized error handling and state management
   */
  const execute = async <R = T>(
    operation: () => Promise<R>,
    options: {
      skipCache?: boolean
      updateState?: boolean
      context?: string
      retries?: number
      timeout?: number
    } = {}
  ): Promise<ServiceResponse<R>> => {
    const operationOptions = {
      skipCache: false,
      updateState: true,
      context: serviceName,
      retries: config.retries,
      timeout: config.timeout,
      ...options
    }
    
    // Check cache if enabled and valid
    if (
      !operationOptions.skipCache && 
      config.enableCache && 
      isCacheValid.value && 
      operationOptions.updateState
    ) {
      return {
        success: true,
        data: state.value.data as R,
        metadata: {
          timestamp: Date.now(),
          requestId: state.value.requestId || undefined
        }
      }
    }
    
    // Set loading state
    if (operationOptions.updateState) {
      state.value.isLoading = true
      state.value.error = null
      state.value.requestId = crypto.randomUUID()
    }
    
    try {
      const response = await errorHandler.wrapAsync(
        operation,
        operationOptions.context,
        {
          retries: operationOptions.retries,
          timeout: operationOptions.timeout
        }
      )
      
      if (operationOptions.updateState) {
        if (response.success) {
          state.value.data = response.data as T
          state.value.error = null
          state.value.lastFetched = Date.now()
        } else {
          state.value.error = response.error || null
        }
        state.value.isLoading = false
      }
      
      return response as ServiceResponse<R>
    } catch (error) {
      // This should not happen with wrapAsync, but just in case
      const standardError = errorHandler.normalizeError(error, operationOptions.context)
      
      if (operationOptions.updateState) {
        state.value.error = standardError
        state.value.isLoading = false
      }
      
      return {
        success: false,
        error: standardError
      }
    }
  }
  
  /**
   * Reset service state
   */
  const reset = () => {
    state.value = {
      data: null,
      error: null,
      isLoading: false,
      lastFetched: 0,
      requestId: null
    }
    errorHandler.clearError()
  }
  
  /**
   * Clear error state
   */
  const clearError = () => {
    state.value.error = null
    errorHandler.clearError()
  }
  
  /**
   * Force refresh (bypass cache)
   */
  const refresh = async <R = T>(
    operation: () => Promise<R>,
    context?: string
  ): Promise<ServiceResponse<R>> => {
    return execute(operation, {
      skipCache: true,
      context: context || `${serviceName}-refresh`
    })
  }
  
  /**
   * Set data without making a request (useful for optimistic updates)
   */
  const setData = (newData: T) => {
    state.value.data = newData
    state.value.lastFetched = Date.now()
    state.value.error = null
  }
  
  /**
   * Update data using a function (reactive updates)
   */
  const updateData = (updater: (current: T | null) => T) => {
    const newData = updater(state.value.data)
    setData(newData)
  }
  
  return {
    // State (read-only)
    state: readonly(state) as Readonly<Ref<ServiceState<T>>>,
    data: computed(() => state.value.data),
    error: computed(() => state.value.error),
    loadingState,
    
    // Computed properties
    isLoading,
    hasError,
    hasData,
    isIdle,
    isCacheValid,
    
    // Operations
    execute,
    refresh,
    reset,
    clearError,
    
    // Data management
    setData,
    updateData,
    
    // Configuration
    config,
    serviceName
  }
}

// Utility type for creating typed service composables
export type ServiceComposable<T> = ReturnType<typeof useServiceBase<T>>

// Export types for external use
export type { ServiceState, LoadingState, ServiceConfig }