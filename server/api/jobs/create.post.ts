// server/api/jobs/create.post.ts
import { useJobsRepository } from '../../repositories/jobsRepository'
import { useSitesRepository } from '../../repositories/sitesRepository'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event)
    
    // Get request body
    const body = await readBody(event)
    
    if (!body.sites || !Array.isArray(body.sites)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid request: sites array is required'
      })
    }
    
    const filename = body.filename || 'upload.csv'
    const sites = body.sites
    
    // Create a new job
    const jobsRepo = useJobsRepository()
    const job = await jobsRepo.create({
      filename,
      total_chunks: Math.ceil(sites.length / 100),
      status: 'queued'
    })
    
    // Store relevant info in event context for background processing
    event.context.job = {
      id: job.id,
      sites,
      batchSize: 100
    }
    
    // Start background processing (async)
    processJobInBackground(event.context.job)
      .catch(error => console.error(`Background processing error for job ${job.id}:`, error))
    
    return { 
      success: true,
      jobId: job.id,
      message: `Job created with ID: ${job.id}`
    }
  } catch (error) {
    console.error('Job creation error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to create job'
    })
  }
})

// Background processing function (runs asynchronously)
async function processJobInBackground(jobContext: { id: string, sites: any[], batchSize: number }) {
  try {
    const { id: jobId, sites, batchSize } = jobContext
    
    // Get repositories
    const jobsRepo = useJobsRepository()
    const sitesRepo = useSitesRepository()
    
    // Update job status to processing
    await jobsRepo.updateProgress(jobId, { status: 'processing' })
    
    // Process in batches
    let processedRecords = 0
    const batches = Math.ceil(sites.length / batchSize)
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize
      const end = Math.min(start + batchSize, sites.length)
      const batch = sites.slice(start, end)
      
      // Process batch with transaction support
      const batchCount = await sitesRepo.batchUpsert(batch)
      processedRecords += batchCount
      
      // Update job progress
      await jobsRepo.updateProgress(jobId, {
        chunks_received: i + 1,
        processed_records: processedRecords
      })
    }
    
    // Complete the job
    await jobsRepo.completeJob(jobId, processedRecords)
    
    return { success: true, processedRecords }
  } catch (error) {
    // Get job repository again since this runs in a different context
    const jobsRepo = useJobsRepository()
    
    // Update job status to error
    await jobsRepo.updateProgress(jobContext.id, {
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error)
    })
    
    throw error
  }
}