// server/utils/migrationUtils.ts

import { useSitesRepository } from '../repositories/sitesRepository';
import type { Site } from '~/types/supabase';

// Create an interface for migration results
interface MigrationResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ siteId: string; error: string }>;
  timeElapsed: number;
}

/**
 * Checks if migration is needed by verifying if SQLite database has data
 * This function doesn't depend on Supabase, so it's safe to use
 */
export const checkMigrationNeeded = async (): Promise<boolean> => {
  try {
    const sitesRepo = useSitesRepository();
    
    // Check if the SQLite database already has data
    const existingSites = await sitesRepo.findAll();
    return existingSites.length === 0;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return true; // Assume migration is needed if we can't check
  }
};

/**
 * Implementation of the migration utility using direct HTTP fetch
 * instead of the Supabase client to avoid import issues
 */
export const migrateSitesToSQLite = async (): Promise<MigrationResult> => {
  const startTime = Date.now();
  const result: MigrationResult = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [],
    timeElapsed: 0
  };

  try {
    // Get the site repository once and use it throughout
    const sitesRepo = useSitesRepository();
    
    // Fetch sites directly from SQLite repository
    console.log('Fetching sites from SQLite repository...');
    const sites = await sitesRepo.findAll();
    
    result.total = sites.length;
    console.log(`Found ${sites.length} sites to migrate`);
    
    // Rest of processing remains the same
    const batchSize = 50;
    const batches = Math.ceil(sites.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, sites.length);
      const batchData = sites.slice(startIdx, endIdx);
      
      console.log(`Processing batch ${i + 1}/${batches} (${startIdx} to ${endIdx})`);
      
      for (const site of batchData) {
        try {
          const siteData = {
            site_id: site.site_id,
            exp_date: site.exp_date,
            total_rental: site.total_rental,
            total_payment_to_pay: site.total_payment_to_pay,
            deposit: site.deposit
          };
          
          await sitesRepo.upsert(siteData);
          result.successful++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            siteId: site.site_id,
            error: error instanceof Error ? error.message : String(error)
          });
          console.error(`Error migrating site ${site.site_id}:`, error);
        }
      }
      
      console.log(`Progress: ${result.successful}/${result.total} sites migrated successfully`);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    result.failed = result.total - result.successful;
  } finally {
    result.timeElapsed = Date.now() - startTime;
    console.log(`Migration completed in ${result.timeElapsed}ms`);
    console.log(`Results: ${result.successful} successful, ${result.failed} failed`);
  }

  return result;
};

/**
 * Create a new API endpoint that will provide the site data for migration
 * This allows us to decouple the migration logic from direct Supabase dependencies
 */
// server/api/sites/export.get.ts (implement separately)