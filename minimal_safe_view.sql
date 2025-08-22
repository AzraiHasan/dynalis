-- Create minimal job_queue_status view using only core columns that definitely exist
-- Based on the original upload_jobs table structure

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
  j.error_message,
  -- Add user tracking columns (we just added these)
  j.created_by_user_id,
  j.created_by_username,
  -- Calculate progress percentage
  CASE 
    WHEN j.total_chunks > 0 
    THEN ROUND((j.chunks_received::DECIMAL / j.total_chunks::DECIMAL) * 100, 2)
    ELSE 0
  END as progress_percentage,
  -- Set defaults for missing columns that the frontend expects
  NULL::INTEGER as retry_count,
  3 as max_retries,
  5 as priority,
  NULL::INTEGER as processing_duration_seconds,
  NULL::INTEGER as seconds_since_heartbeat,
  NULL::TIMESTAMPTZ as processing_started_at,
  NULL::TIMESTAMPTZ as last_heartbeat
FROM public.upload_jobs j
ORDER BY j.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.job_queue_status TO authenticated;