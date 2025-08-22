-- Manual migration script for adding user tracking to upload_jobs
-- Run this directly in your Supabase database console or PostgreSQL client

-- 1. Add user tracking columns to upload_jobs table
ALTER TABLE public.upload_jobs 
ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
ADD COLUMN IF NOT EXISTS created_by_username TEXT;

-- 2. Add indexes for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_by_user_id ON public.upload_jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_by_username ON public.upload_jobs(created_by_username);

-- 3. Update the job_queue_status view to include user information
CREATE OR REPLACE VIEW public.job_queue_status AS
SELECT 
  j.id,
  j.filename,
  j.status,
  j.progress_percentage,
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
  j.processing_duration_seconds,
  j.created_by_user_id,
  j.created_by_username,
  EXTRACT(EPOCH FROM (NOW() - j.last_heartbeat))::INTEGER as seconds_since_heartbeat
FROM public.upload_jobs j
ORDER BY j.created_at DESC;

-- 4. Add comments for documentation
COMMENT ON COLUMN public.upload_jobs.created_by_user_id IS 'UUID of the user who created this upload job';
COMMENT ON COLUMN public.upload_jobs.created_by_username IS 'Username/display name of the user who created this upload job';

-- 5. Grant necessary permissions
GRANT SELECT ON public.job_queue_status TO authenticated;