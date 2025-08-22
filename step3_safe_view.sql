-- Step 3: Safe view creation - check first, then replace
-- First, let's check if the view exists and what it contains

-- Check if view exists:
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'job_queue_status'
);

-- If you want to see the current view definition:
-- SELECT definition FROM pg_views WHERE schemaname = 'public' AND viewname = 'job_queue_status';

-- Only run the CREATE OR REPLACE below if you're sure:
/*
CREATE OR REPLACE VIEW public.job_queue_status AS
SELECT 
  j.id,
  j.filename,
  j.status,
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
  CASE 
    WHEN j.processing_started_at IS NOT NULL AND j.completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (j.completed_at - j.processing_started_at))::INTEGER
    WHEN j.processing_started_at IS NOT NULL AND j.completed_at IS NULL
    THEN EXTRACT(EPOCH FROM (NOW() - j.processing_started_at))::INTEGER
    ELSE NULL
  END as processing_duration_seconds,
  j.created_by_user_id,
  j.created_by_username,
  CASE 
    WHEN j.last_heartbeat IS NOT NULL
    THEN EXTRACT(EPOCH FROM (NOW() - j.last_heartbeat))::INTEGER
    ELSE NULL
  END as seconds_since_heartbeat
FROM public.upload_jobs j
ORDER BY j.created_at DESC;
*/