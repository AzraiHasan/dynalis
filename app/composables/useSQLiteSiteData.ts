// app/composables/useSQLiteSiteData.ts
import { useState } from '#app'
import type { Site } from '~/types/supabase'

// This composable provides the same interface as useSiteData but uses SQLite instead
export const useSQLiteSiteData = () => {
  const cachedData = useState<Site[] | null>('sqlite-site-data', () => null)
  const isLoading = useState<boolean>('sqlite-site-data-loading', () => false)
  const error = useState<Error | null>('sqlite-site-data-error', () => null)
  const lastFetched = useState<number>('sqlite-site-data-timestamp', () => 0)
  
  const fetchData = async (force = false) => {
    const now = Date.now()
    const cacheExpiry = 5 * 60 * 1000 // 5 minutes
    
    if (force || !cachedData.value || (now - lastFetched.value) > cacheExpiry) {
      isLoading.value = true
      error.value = null
      
      try {
        // Fetch from our new API endpoint that uses SQLite
        const response = await fetch('/api/sites/sqlite')
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`)
        }
        
        const result = await response.json()
        cachedData.value = result.sites
        lastFetched.value = now
        return cachedData.value
      } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err))
        console.error('Error fetching SQLite site data:', err)
        throw err
      } finally {
        isLoading.value = false
      }
    }
    
    return cachedData.value
  }
  
  return {
    fetchData,
    cachedData,
    isLoading,
    error,
    lastFetched
  }
}