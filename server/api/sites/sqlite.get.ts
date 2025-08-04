// server/api/sites/sqlite.get.ts
import { useSitesRepository } from '../../repositories/sitesRepository'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication for this endpoint
    await requireUserSession(event)
    
    const sitesRepo = useSitesRepository()
    const sites = await sitesRepo.findAll()
    
    return {
      sites,
      count: sites.length,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error fetching SQLite sites:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to fetch sites data'
    })
  }
})