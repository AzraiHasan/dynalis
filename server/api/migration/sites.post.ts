// server/api/migration/sites.post.ts
import { migrateSitesToSQLite, checkMigrationNeeded } from '../../utils/migrationUtils'

export default defineEventHandler(async (event) => {
  try {
    // Check if migration is needed
    const migrationNeeded = await checkMigrationNeeded()
    
    if (!migrationNeeded) {
      return {
        success: false,
        message: 'Migration not needed - SQLite database already contains data'
      }
    }
    
    // Require authentication for this sensitive operation
    await requireUserSession(event)
    
    // Start migration
    const result = await migrateSitesToSQLite()
    
    return {
      success: result.failed === 0,
      message: `Migration completed: ${result.successful}/${result.total} sites migrated successfully`,
      details: result
    }
  } catch (error) {
    console.error('Migration API error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Migration failed'
    })
  }
})