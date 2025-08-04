// server/api/jobs/[id]/cancel.post.ts
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
    
    // Get job repository
    const jobsRepo = useJobsRepository()
    
    // Check if job exists
    const job = await jobsRepo.getById(jobId)
    if (!job) {
      throw createError({
        statusCode: 404,
        message: `Job with ID ${jobId} not found`
      })
    }
    
    // Only allow cancellation of jobs that are not completed or already failed
    if (job.status === 'complete' || job.status === 'error' || job.status === 'cancelled') {
      throw createError({
        statusCode: 400,
        message: `Cannot cancel job with status: ${job.status}`
      })
    }
    
    // Cancel the job
    const updatedJob = await jobsRepo.updateProgress(jobId, {
      status: 'cancelled',
      error_message: 'Job cancelled by user'
    })
    
    return {
      success: true,
      job: updatedJob
    }
  } catch (error) {
    console.error('Error cancelling job:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to cancel job'
    })
  }
})