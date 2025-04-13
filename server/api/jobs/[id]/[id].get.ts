// server/api/jobs/[id].get.ts
import { useJobsRepository } from '../../../repositories/jobsRepository'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event)
    
    // Get job ID from URL
    const jobId = getRouterParam(event, 'id')
    if (!jobId) {
      throw createError({
        statusCode: 400,
        message: 'Job ID is required'
      })
    }
    
    // Get job details
    const jobsRepo = useJobsRepository()
    const job = await jobsRepo.getById(jobId)
    
    if (!job) {
      throw createError({
        statusCode: 404,
        message: `Job with ID ${jobId} not found`
      })
    }
    
    // Calculate progress percentage
    const progress = job.total_chunks > 0 
      ? Math.round((job.chunks_received / job.total_chunks) * 100) 
      : 0
    
    return {
      ...job,
      progress
    }
  } catch (error) {
    console.error('Job status error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to get job status'
    })
  }
})
