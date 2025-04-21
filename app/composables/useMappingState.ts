// app/composables/useMappingState.ts
import { ref, computed } from 'vue'
import type { SystemField, MappingConfiguration } from '~/types/mapping'

export const useMappingState = () => {
  // State tracking
  const isInitialized = ref(false)
  const isInitializing = ref(false)
  const isChecking = ref(false)
  const systemFields = ref<SystemField[]>([])
  const currentMappingConfig = ref<MappingConfiguration | null>(null)
  const error = ref<Error | null>(null)
  const lastChecked = ref<Date | null>(null)
  
  // Computed properties
  const hasSystemFields = computed(() => systemFields.value.length > 0)
  const hasMappingConfig = computed(() => currentMappingConfig.value !== null)
  
  // Start initialization process
  const startInitialization = () => {
    isInitializing.value = true
    error.value = null
  }
  
  // Set as initialized with system fields
  const setInitialized = (fields: SystemField[]) => {
    isInitialized.value = true
    systemFields.value = fields
    isInitializing.value = false
    lastChecked.value = new Date()
  }
  
  // Start checking initialization status
  const startChecking = () => {
    isChecking.value = true
    error.value = null
  }
  
  // Complete checking with results
  const finishChecking = (initialized: boolean, fields: SystemField[] = []) => {
    isChecking.value = false
    isInitialized.value = initialized
    if (fields.length > 0) {
      systemFields.value = fields
    }
    lastChecked.value = new Date()
  }
  
  // Set error state
  const setError = (err: Error) => {
    error.value = err
    isInitializing.value = false
    isChecking.value = false
  }
  
  // Reset state (for cleanup)
  const reset = () => {
    isInitialized.value = false
    isInitializing.value = false
    isChecking.value = false
    systemFields.value = []
    currentMappingConfig.value = null
    error.value = null
    lastChecked.value = null
  }
  
  // Set current mapping configuration
  const setMappingConfig = (config: MappingConfiguration) => {
    currentMappingConfig.value = config
  }
  
  return {
    // State
    isInitialized,
    isInitializing,
    isChecking,
    systemFields,
    currentMappingConfig,
    error,
    lastChecked,
    hasSystemFields,
    hasMappingConfig,
    
    // Functions
    startInitialization,
    setInitialized,
    startChecking,
    finishChecking,
    setError,
    setMappingConfig,
    reset
  }
}