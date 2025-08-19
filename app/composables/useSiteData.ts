// composables/useSiteData.ts (UPDATED)
import type { Site } from '~/types/dbsql'

// This composable uses SQLite for data management
export const useSiteData = () => {
  const cachedData = useState<Site[] | null>('site-data', () => null)
  const isLoading = useState<boolean>('site-data-loading', () => false)
  const error = useState<Error | null>('site-data-error', () => null)
  const lastFetched = useState<number>('site-data-timestamp', () => 0)
  
  const fetchData = async (force = false) => {
    const now = Date.now()
    const cacheExpiry = 5 * 60 * 1000 // 5 minutes
    
    if (force || !cachedData.value || (now - lastFetched.value) > cacheExpiry) {
      isLoading.value = true
      error.value = null
      
      try {
        // Fetch from our SQLite API endpoint
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
        console.error('Error fetching site data:', err)
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