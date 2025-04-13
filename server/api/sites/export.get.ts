// server/api/sites/export.get.ts - UPDATED
import { useSitesRepository } from '../../repositories/sitesRepository'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event)
    
    // Use SQLite repository instead of Supabase
    const sitesRepo = useSitesRepository()
    const sites = await sitesRepo.findAll()
    
    console.log(`Exported ${sites.length} sites from SQLite`)
    return sites || []
  } catch (error) {
    console.error('Error in sites export:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Export operation failed'
    })
  }
})