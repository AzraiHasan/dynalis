-- Corrected migration script for adding user tracking to upload_jobs
-- This version uses the actual columns that exist in the upload_jobs table

-- 1. Add user tracking columns to upload_jobs table (if not already added)
ALTER TABLE public.upload_jobs 
ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
ADD COLUMN IF NOT EXISTS created_by_username TEXT;

-- 2. Add indexes for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_by_user_id ON public.upload_jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_by_username ON public.upload_jobs(created_by_username);

-- 3. Update the job_queue_status view to include user information
-- Note: Using actual columns that exist in the table based on migration files
CREATE OR REPLACE VIEW public.job_queue_status AS
SELECT 
  j.id,
  j.filename,
  j.status,
  -- Calculate progress percentage from chunks_received and total_chunks
  CASE 
    WHEN j.total_chunks > 0 
    THEN ROUND((j.chunks_received::DECIMAL / j.total_chunks::DECIMAL) * 100, 2)
    ELSE 0
  END as progress_percentage,
  j.processed_records,
  j.total_chunks,
  j.created_at,
  j.updated_at,
  j.completed_at,
  j.processing_started_at,
  j.last_heartbeat,
  j.retry_count,
  j.max_retries,
  j.priority,
  -- Calculate processing duration in seconds
  CASE 
    WHEN j.processing_started_at IS NOT NULL AND j.completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (j.completed_at - j.processing_started_at))::INTEGER
    WHEN j.processing_started_at IS NOT NULL AND j.completed_at IS NULL
    THEN EXTRACT(EPOCH FROM (NOW() - j.processing_started_at))::INTEGER
    ELSE NULL
  END as processing_duration_seconds,
  j.created_by_user_id,
  j.created_by_username,
  -- Calculate seconds since last heartbeat
  CASE 
    WHEN j.last_heartbeat IS NOT NULL
    THEN EXTRACT(EPOCH FROM (NOW() - j.last_heartbeat))::INTEGER
    ELSE NULL
  END as seconds_since_heartbeat
FROM public.upload_jobs j
ORDER BY j.created_at DESC;

-- 4. Add comments for documentation
COMMENT ON COLUMN public.upload_jobs.created_by_user_id IS 'UUID of the user who created this upload job';
COMMENT ON COLUMN public.upload_jobs.created_by_username IS 'Username/display name of the user who created this upload job';

-- 5. Grant necessary permissions
GRANT SELECT ON public.job_queue_status TO authenticated;