// composables/useSiteData.ts
import { useState } from '#app'
import { useSiteService } from '~/utils/supabaseService'

// Define the site data type
type SiteData = any[] | null

export const useSiteData = () => {
  const cachedData = useState<SiteData>('site-data', () => null)
  const isLoading = useState<boolean>('site-data-loading', () => false)
  const error = useState<Error | null>('site-data-error', () => null)
  const lastFetched = useState<number>('site-data-timestamp', () => 0)
  const siteService = useSiteService()
  
  const fetchData = async (force = false) => {
    const now = Date.now()
    const cacheExpiry = 5 * 60 * 1000 // 5 minutes
    
    if (force || !cachedData.value || (now - lastFetched.value) > cacheExpiry) {
      isLoading.value = true
      error.value = null
      
      try {
        const data = await siteService.fetchSiteData()
        cachedData.value = data
        lastFetched.value = now
        return data
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