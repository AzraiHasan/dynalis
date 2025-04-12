// server/api/migration/status.get.ts
import { checkMigrationNeeded } from '../../utils/migrationUtils'
import { useSitesRepository } from '../../repositories/sitesRepository'
import { useSiteService } from '~/utils/supabaseService'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event)
    
    const migrationNeeded = await checkMigrationNeeded()
    const sitesRepo = useSitesRepository()
    const siteService = useSiteService()
    
    // Get counts from both sources
    const sqliteSites = await sitesRepo.findAll()
    const supabaseSites = await siteService.fetchSiteData()
    
    return {
      migrationNeeded,
      sqliteCount: sqliteSites.length,
      supabaseCount: supabaseSites.length,
      syncStatus: sqliteSites.length === supabaseSites.length ? 'in-sync' : 'out-of-sync',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Migration status check error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to check migration status'
    })
  }
})