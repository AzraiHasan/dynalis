// server/api/sites/batch-upload.post.ts
import { useSitesRepository } from '../../repositories/sitesRepository'
import type { Site } from '~/types/dbsql'

// Define input type for better type safety
interface SiteInput {
  site_id?: string;
  exp_date?: string | null;
  total_rental?: number | string;
  total_payment_to_pay?: number | string;
  deposit?: number | string;
}

export default defineEventHandler(async (event) => {
  try {
    // Enforce authentication requirement
    await requireUserSession(event)
    
    // Extract and validate the request body
    const body = await readBody(event)
    
    if (!Array.isArray(body.sites)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid request: sites array is required'
      })
    }
    
    // Transform data to match repository format
    const transformedSites = body.sites.map((site: SiteInput) => ({
      site_id: site.site_id || 'NO ID',
      exp_date: site.exp_date || null,
      total_rental: Number(site.total_rental || 0),
      total_payment_to_pay: Number(site.total_payment_to_pay || 0),
      deposit: Number(site.deposit || 0)
    }))
    
    // Use the repository for batch operations
    const sitesRepo = useSitesRepository()
    const batchSize = 50
    let processedCount = 0
    
    // Process in manageable batches with transaction isolation
    for (let i = 0; i < transformedSites.length; i += batchSize) {
      const batch = transformedSites.slice(i, i + batchSize)
      const batchResult = await sitesRepo.batchUpsert(batch)
      processedCount += batchResult
    }
    
    return {
      success: true,
      count: processedCount,
      message: `Processed ${processedCount} site records successfully`
    }
  } catch (error) {
    console.error('Batch upload error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to process batch upload'
    })
  }
})