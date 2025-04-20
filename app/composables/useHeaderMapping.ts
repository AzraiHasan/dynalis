// app/composables/useHeaderMapping.ts

import { ref, computed } from 'vue'
import type { SystemField, MappingConfiguration } from '~/types/mapping'

interface MappingSuggestion {
  header: string
  systemFieldId: string
  confidence: number // 0-100 score
}

export const useHeaderMapping = () => {
  const systemFields = ref<SystemField[]>([])
  const mappingConfigurations = ref<MappingConfiguration[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  
  // Fetch available system fields
  async function fetchSystemFields() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch('/api/mapping/system-fields')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch system fields: ${response.statusText}`)
      }
      
      const result = await response.json()
      systemFields.value = result.fields || []
      
      return systemFields.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw error.value
    } finally {
      isLoading.value = false
    }
  }
  
  // Get mapping suggestions for file headers
  async function getSuggestions(headers: string[]): Promise<Record<string, MappingSuggestion>> {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch('/api/mapping/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ headers })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to get mapping suggestions: ${response.statusText}`)
      }
      
      const result = await response.json()
      return result.suggestions || {}
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw error.value
    } finally {
      isLoading.value = false
    }
  }
  
  // Save mapping configuration
  async function saveMapping(
    name: string, 
    headers: string[], 
    mappings: Record<string, string>
  ): Promise<MappingConfiguration> {
    isLoading.value = true
    error.value = null
    
    try {
      // Get the user session for the user ID
      const userSession = useCookie('auth-session').value
      
      // Format the data for the API
      const session = JSON.parse(userSession || '{}')
      const userId = session?.user?.id || 'anonymous'
      
      const response = await fetch('/api/mapping/index.post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'createFromHeaders',
          data: {
            headers,
            configName: name,
            userId,
            mappings
          }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to save mapping: ${response.statusText}`)
      }
      
      const result = await response.json()
      return result.config
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw error.value
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    systemFields,
    mappingConfigurations,
    isLoading,
    error,
    fetchSystemFields,
    getSuggestions,
    saveMapping
  }
}