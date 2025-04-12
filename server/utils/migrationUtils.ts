// server/utils/migrationUtils.ts
import { useSiteService } from '~/utils/supabaseService'
import { useSitesRepository } from '../repositories/sitesRepository'
import type { Site } from '~/types/supabase'

interface MigrationResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ siteId: string; error: string }>;
  timeElapsed: number;
}

/**
 * Migrates site data from Supabase to SQLite database
 * Uses batch processing to handle large datasets efficiently
 */
export const migrateSitesToSQLite = async (): Promise<MigrationResult> => {
  const startTime = Date.now()
  const result: MigrationResult = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [],
    timeElapsed: 0
  }

  try {
    // 1. Get the site service to fetch data from Supabase
    const siteService = useSiteService()
    
    // 2. Get the site repository for SQLite operations
    const sitesRepo = useSitesRepository()
    
    // 3. Fetch all sites from current storage
    console.log('Fetching sites from Supabase...')
    const sites = await siteService.fetchSiteData()
    
    result.total = sites.length
    console.log(`Found ${sites.length} sites to migrate`)
    
    // 4. Process in batches for memory efficiency
    const batchSize = 50
    const batches = Math.ceil(sites.length / batchSize)
    
    for (let i = 0; i < batches; i++) {
      const startIdx = i * batchSize
      const endIdx = Math.min(startIdx + batchSize, sites.length)
      const batchData = sites.slice(startIdx, endIdx)
      
      console.log(`Processing batch ${i + 1}/${batches} (${startIdx} to ${endIdx})`)
      
      // 5. Transform and insert each site using the repository
      for (const site of batchData) {
        try {
          // Transform the site to match the repository format
          const siteData = {
            site_id: site.site_id,
            exp_date: site.exp_date,
            total_rental: site.total_rental,
            total_payment_to_pay: site.total_payment_to_pay,
            deposit: site.deposit
          }
          
          // Insert into SQLite
          await sitesRepo.upsert(siteData)
          result.successful++
        } catch (error) {
          result.failed++
          result.errors.push({
            siteId: site.site_id,
            error: error instanceof Error ? error.message : String(error)
          })
          console.error(`Error migrating site ${site.site_id}:`, error)
        }
      }
      
      // Report progress after each batch
      console.log(`Progress: ${result.successful}/${result.total} sites migrated successfully`)
    }
  } catch (error) {
    console.error('Migration failed:', error)
    result.failed = result.total - result.successful
  } finally {
    result.timeElapsed = Date.now() - startTime
    console.log(`Migration completed in ${result.timeElapsed}ms`)
    console.log(`Results: ${result.successful} successful, ${result.failed} failed`)
  }

  return result
}

/**
 * Checks if migration is needed by verifying if SQLite database is empty
 */
export const checkMigrationNeeded = async (): Promise<boolean> => {
  const sitesRepo = useSitesRepository()
  
  // Check if the SQLite database already has data
  const existingSites = await sitesRepo.findAll()
  return existingSites.length === 0
}