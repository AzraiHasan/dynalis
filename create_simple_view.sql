-- Create a simple job_queue_status view with just the essential columns
-- This is safe and non-destructive since the view doesn't exist yet

CREATE VIEW public.job_queue_status AS
SELECT 
  j.id,
  j.filename,
  j.status,
  j.total_chunks,
  j.chunks_received,
  j.processed_records,
  j.created_at,
  j.updated_at,
  j.completed_at,
  j.processing_started_at,
  j.last_heartbeat,
  j.retry_count,
  j.max_retries,
  j.priority,
  j.created_by_user_id,
  j.created_by_username,
  -- Calculate progress percentage
  CASE 
    WHEN j.total_chunks > 0 
    THEN ROUND((j.chunks_received::DECIMAL / j.total_chunks::DECIMAL) * 100, 2)
    ELSE 0
  END as progress_percentage,
  -- Calculate processing duration in seconds
  CASE 
    WHEN j.processing_started_at IS NOT NULL AND j.completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (j.completed_at - j.processing_started_at))::INTEGER
    WHEN j.processing_started_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (NOW() - j.processing_started_at))::INTEGER
    ELSE NULL
  END as processing_duration_seconds,
  -- Calculate seconds since last heartbeat
  CASE 
    WHEN j.last_heartbeat IS NOT NULL
    THEN EXTRACT(EPOCH FROM (NOW() - j.last_heartbeat))::INTEGER
    ELSE NULL
  END as seconds_since_heartbeat
FROM public.upload_jobs j
ORDER BY j.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.job_queue_status TO authenticated;