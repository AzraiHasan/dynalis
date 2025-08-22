// composables/useSiteData.ts
import { useSiteService } from '~/utils/supabaseService'
import { useServiceBase } from './useServiceBase'
import { useErrorHandling, ErrorType, ErrorSeverity } from './useErrorHandling'
import type { Site } from '~/types/supabase'
import type { ServiceResponse } from './useErrorHandling'

// Define the site data type
type SiteData = Site[]

export const useSiteData = () => {
  const siteService = useSiteService()
  const serviceBase = useServiceBase<SiteData>('siteData', {
    cacheTimeout: 5 * 60 * 1000, // 5 minutes cache
    retries: 2,
    timeout: 15000,
    enableCache: true
  })
  const errorHandler = useErrorHandling()
  
  const fetchData = async (force = false): Promise<ServiceResponse<SiteData>> => {
    return serviceBase.execute(
      async () => {
        try {
          const data = await siteService.fetchSiteData()
          return data
        } catch (err) {
          throw errorHandler.createError(
            'Failed to fetch site data',
            ErrorType.SERVER,
            ErrorSeverity.MEDIUM,
            {
              details: err,
              context: 'fetchSiteData',
              recoverable: true,
              userMessage: 'Unable to load site data. Please try again.'
            }
          )
        }
      },
      {
        context: 'siteData-fetch',
        skipCache: force
      }
    )
  }
  
  const refreshData = async (): Promise<ServiceResponse<SiteData>> => {
    return serviceBase.refresh(
      async () => {
        try {
          const data = await siteService.fetchSiteData()
          return data
        } catch (err) {
          throw errorHandler.createError(
            'Failed to refresh site data',
            ErrorType.SERVER,
            ErrorSeverity.MEDIUM,
            {
              details: err,
              context: 'refreshSiteData',
              recoverable: true,
              userMessage: 'Unable to refresh site data. Please try again.'
            }
          )
        }
      },
      'siteData-refresh'
    )
  }
  
  return {
    // Data access
    fetchData,
    refreshData,
    
    // Service base functionality (standardized state and operations)
    ...serviceBase,
    
    // Legacy compatibility (computed from serviceBase state)
    cachedData: serviceBase.data,
    lastFetched: computed(() => serviceBase.state.value.lastFetched)
  }
}