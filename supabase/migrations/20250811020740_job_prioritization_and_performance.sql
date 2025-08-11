-- Sprint 1.2: Background Job Performance Optimization
-- Add job prioritization, throttling, and performance indexing

-- 1. Add job prioritization and performance columns to upload_jobs
ALTER TABLE public.upload_jobs 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
ADD COLUMN IF NOT EXISTS estimated_size INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_concurrent_jobs INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 1800; -- 30 minutes default

-- 2. Add performance tracking columns
ALTER TABLE public.upload_jobs
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS batch_processing_time_ms INTEGER[],
ADD COLUMN IF NOT EXISTS memory_usage_mb INTEGER[];

-- 3. Create indexes for job status and priority querying
CREATE INDEX IF NOT EXISTS idx_upload_jobs_status_priority 
ON public.upload_jobs (status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_upload_jobs_processing_status 
ON public.upload_jobs (status) 
WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_upload_jobs_heartbeat 
ON public.upload_jobs (last_heartbeat) 
WHERE status = 'processing';

-- 4. Add partial index for active jobs
CREATE INDEX IF NOT EXISTS idx_upload_jobs_active 
ON public.upload_jobs (priority DESC, created_at ASC) 
WHERE status IN ('created', 'queued', 'processing');

-- 5. Create a function to get next job based on priority
CREATE OR REPLACE FUNCTION public.get_next_priority_job(max_concurrent INTEGER DEFAULT 3)
RETURNS TABLE (
  job_id UUID,
  filename TEXT,
  priority INTEGER,
  estimated_size INTEGER,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  current_processing_count INTEGER;
BEGIN
  -- Check current processing jobs
  SELECT COUNT(*) INTO current_processing_count
  FROM public.upload_jobs
  WHERE status = 'processing'
    AND (last_heartbeat IS NULL OR last_heartbeat > NOW() - INTERVAL '5 minutes');

  -- Return next job if we're under the concurrency limit
  IF current_processing_count < max_concurrent THEN
    RETURN QUERY
    SELECT 
      uj.id as job_id,
      uj.filename,
      uj.priority,
      uj.estimated_size,
      uj.created_at
    FROM public.upload_jobs uj
    WHERE uj.status IN ('created', 'queued')
      AND (uj.retry_count < uj.max_retries)
    ORDER BY uj.priority DESC, uj.created_at ASC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to start job processing with concurrency control
CREATE OR REPLACE FUNCTION public.start_job_processing(job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  job_max_concurrent INTEGER;
BEGIN
  -- Get the job's max concurrent setting
  SELECT max_concurrent_jobs INTO job_max_concurrent
  FROM public.upload_jobs
  WHERE id = job_id;

  -- Check current processing count
  SELECT COUNT(*) INTO current_count
  FROM public.upload_jobs
  WHERE status = 'processing'
    AND (last_heartbeat IS NULL OR last_heartbeat > NOW() - INTERVAL '5 minutes');

  -- Start job if under limit
  IF current_count < COALESCE(job_max_concurrent, 3) THEN
    UPDATE public.upload_jobs
    SET 
      status = 'processing',
      processing_started_at = NOW(),
      last_heartbeat = NOW(),
      updated_at = NOW()
    WHERE id = job_id
      AND status IN ('created', 'queued');
    
    RETURN FOUND;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to update job heartbeat and performance metrics
CREATE OR REPLACE FUNCTION public.update_job_heartbeat(
  job_id UUID,
  batch_time_ms INTEGER DEFAULT NULL,
  memory_mb INTEGER DEFAULT NULL,
  metrics JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.upload_jobs
  SET 
    last_heartbeat = NOW(),
    batch_processing_time_ms = CASE 
      WHEN batch_time_ms IS NOT NULL THEN 
        COALESCE(batch_processing_time_ms, ARRAY[]::INTEGER[]) || batch_time_ms
      ELSE batch_processing_time_ms
    END,
    memory_usage_mb = CASE 
      WHEN memory_mb IS NOT NULL THEN 
        COALESCE(memory_usage_mb, ARRAY[]::INTEGER[]) || memory_mb
      ELSE memory_usage_mb
    END,
    performance_metrics = CASE 
      WHEN metrics IS NOT NULL THEN 
        COALESCE(performance_metrics, '{}'::JSONB) || metrics
      ELSE performance_metrics
    END,
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to handle job timeouts and cleanup stale jobs
CREATE OR REPLACE FUNCTION public.cleanup_stale_jobs()
RETURNS INTEGER AS $$
DECLARE
  timeout_count INTEGER := 0;
BEGIN
  -- Mark jobs as timed out if they haven't sent heartbeat and exceeded timeout
  UPDATE public.upload_jobs
  SET 
    status = 'error',
    error_message = 'Job timed out - no heartbeat received',
    updated_at = NOW()
  WHERE status = 'processing'
    AND (
      (last_heartbeat IS NOT NULL AND last_heartbeat < NOW() - (timeout_seconds * INTERVAL '1 second'))
      OR 
      (last_heartbeat IS NULL AND processing_started_at < NOW() - (timeout_seconds * INTERVAL '1 second'))
    );
    
  GET DIAGNOSTICS timeout_count = ROW_COUNT;
  
  RETURN timeout_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Add job size estimation based on data
CREATE OR REPLACE FUNCTION public.estimate_job_size(total_records INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Estimate processing time in seconds based on record count
  -- Assume ~100 records per second processing speed
  RETURN GREATEST(CEIL(total_records / 100.0)::INTEGER, 1);
END;
$$ LANGUAGE plpgsql;

-- 10. Improved batch processing with performance tracking
CREATE OR REPLACE FUNCTION public.process_sites_batch_optimized(
  data JSONB,
  job_id UUID DEFAULT NULL,
  batch_number INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  count_processed INT := 0;
  start_time TIMESTAMPTZ := NOW();
  end_time TIMESTAMPTZ;
  processing_time_ms INTEGER;
  memory_before INTEGER;
  memory_after INTEGER;
  result JSONB;
BEGIN
  -- Record start time and update heartbeat
  IF job_id IS NOT NULL THEN
    PERFORM public.update_job_heartbeat(job_id);
  END IF;

  -- Create a temporary table to deduplicate the data first
  CREATE TEMP TABLE temp_sites ON COMMIT DROP AS 
  SELECT DISTINCT ON (site_id)
    site_id,
    exp_date,
    total_rental,
    total_payment_to_pay,
    deposit
  FROM (
    SELECT
      COALESCE((d->>'site_id')::TEXT, 'NO ID') as site_id,
      (d->>'exp_date')::TIMESTAMPTZ as exp_date,
      COALESCE((d->>'total_rental')::DECIMAL, 0) as total_rental,
      COALESCE((d->>'total_payment_to_pay')::DECIMAL, 0) as total_payment_to_pay,
      COALESCE((d->>'deposit')::DECIMAL, 0) as deposit,
      ordinality
    FROM jsonb_array_elements(data) WITH ORDINALITY AS d
    ORDER BY ordinality DESC -- Keep the last occurrence of each site_id
  ) src
  ORDER BY site_id;
  
  -- Perform the upsert with fully deduplicated data
  INSERT INTO sites (
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, updated_at
  )
  SELECT 
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, NOW()
  FROM temp_sites
  ON CONFLICT (site_id)
  DO UPDATE SET
    exp_date = EXCLUDED.exp_date,
    total_rental = EXCLUDED.total_rental,
    total_payment_to_pay = EXCLUDED.total_payment_to_pay,
    deposit = EXCLUDED.deposit,
    updated_at = EXCLUDED.updated_at;
  
  GET DIAGNOSTICS count_processed = ROW_COUNT;
  
  -- Calculate processing time
  end_time := NOW();
  processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  -- Update job with performance metrics if job_id provided
  IF job_id IS NOT NULL THEN
    PERFORM public.update_job_heartbeat(
      job_id, 
      processing_time_ms,
      NULL, -- memory tracking handled client-side
      jsonb_build_object(
        'batch_number', batch_number,
        'records_in_batch', jsonb_array_length(data),
        'records_processed', count_processed,
        'processing_time_ms', processing_time_ms,
        'deduplication_ratio', 
          CASE WHEN jsonb_array_length(data) > 0 
            THEN ROUND((count_processed::DECIMAL / jsonb_array_length(data)) * 100, 2)
            ELSE 0
          END
      )
    );
  END IF;
  
  -- Build result
  result := jsonb_build_object(
    'records_processed', count_processed,
    'processing_time_ms', processing_time_ms,
    'batch_number', batch_number,
    'deduplication_applied', jsonb_array_length(data) > count_processed
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 11. Optimized mark_cancelled_upload_records function for large datasets
CREATE OR REPLACE FUNCTION public.mark_cancelled_upload_records_optimized(job_id UUID)
RETURNS JSONB AS $$
DECLARE
  records_updated INTEGER := 0;
  start_time TIMESTAMPTZ := NOW();
  end_time TIMESTAMPTZ;
  processing_time_ms INTEGER;
  result JSONB;
BEGIN
  -- Use batch processing for large datasets
  -- First, check if we have tracking records
  IF EXISTS (
    SELECT 1 FROM public.upload_job_records 
    WHERE upload_job_records.job_id = mark_cancelled_upload_records_optimized.job_id
    LIMIT 1
  ) THEN
    -- Use the tracking table for precise cancellation
    WITH cancelled_sites AS (
      UPDATE public.sites
      SET 
        cancelled_upload = TRUE,
        updated_at = NOW()
      FROM public.upload_job_records jr
      WHERE sites.id = jr.site_id 
        AND jr.job_id = mark_cancelled_upload_records_optimized.job_id
      RETURNING sites.id
    )
    SELECT COUNT(*) INTO records_updated FROM cancelled_sites;
  ELSE
    -- Fallback: Mark recent records that might belong to this job
    -- This is less precise but handles cases where tracking wasn't implemented
    WITH recent_job AS (
      SELECT created_at, filename 
      FROM public.upload_jobs 
      WHERE id = mark_cancelled_upload_records_optimized.job_id
    ),
    cancelled_sites AS (
      UPDATE public.sites
      SET 
        cancelled_upload = TRUE,
        updated_at = NOW()
      WHERE updated_at >= (
        SELECT created_at - INTERVAL '1 hour' 
        FROM recent_job
      )
      AND updated_at <= (
        SELECT created_at + INTERVAL '6 hours' 
        FROM recent_job
      )
      AND cancelled_upload IS NOT TRUE
      RETURNING sites.id
    )
    SELECT COUNT(*) INTO records_updated FROM cancelled_sites;
  END IF;
  
  -- Update the job status atomically
  UPDATE public.upload_jobs
  SET 
    status = 'cancelled',
    error_message = COALESCE(error_message, 'Cancelled by user'),
    updated_at = NOW()
  WHERE id = job_id;
  
  -- Calculate timing
  end_time := NOW();
  processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  -- Build result with performance metrics
  result := jsonb_build_object(
    'job_id', job_id,
    'records_updated', records_updated,
    'processing_time_ms', processing_time_ms,
    'timestamp', end_time
  );
  
  -- Log the operation
  RAISE NOTICE 'Cancelled upload job % - Updated % records in %ms', 
    job_id, records_updated, processing_time_ms;
    
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 12. Batch status update function for efficient real-time updates
CREATE OR REPLACE FUNCTION public.batch_update_job_progress(
  updates JSONB[] -- Array of {job_id, chunks_received, processed_records, status}
)
RETURNS INTEGER AS $$
DECLARE
  update_item JSONB;
  updated_count INTEGER := 0;
BEGIN
  -- Process all updates in a single transaction
  FOR update_item IN SELECT unnest(updates) LOOP
    UPDATE public.upload_jobs
    SET 
      chunks_received = COALESCE((update_item->>'chunks_received')::INTEGER, chunks_received),
      processed_records = COALESCE((update_item->>'processed_records')::INTEGER, processed_records),
      status = COALESCE(update_item->>'status', status),
      last_heartbeat = NOW(),
      updated_at = NOW()
    WHERE id = (update_item->>'job_id')::UUID;
    
    IF FOUND THEN
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 13. Function to cleanup and optimize job tracking
CREATE OR REPLACE FUNCTION public.cleanup_job_tracking()
RETURNS TEXT AS $$
DECLARE
  cleanup_summary TEXT;
  stale_jobs INTEGER;
  old_completed_jobs INTEGER;
  orphaned_records INTEGER;
BEGIN
  -- Clean up stale processing jobs
  UPDATE public.upload_jobs
  SET 
    status = 'error',
    error_message = 'Job timed out - system cleanup',
    updated_at = NOW()
  WHERE status = 'processing'
    AND (
      (last_heartbeat IS NOT NULL AND last_heartbeat < NOW() - INTERVAL '30 minutes')
      OR (last_heartbeat IS NULL AND processing_started_at < NOW() - INTERVAL '30 minutes')
      OR (processing_started_at IS NULL AND updated_at < NOW() - INTERVAL '1 hour')
    );
  
  GET DIAGNOSTICS stale_jobs = ROW_COUNT;
  
  -- Archive old completed jobs (older than 30 days)
  DELETE FROM public.upload_jobs
  WHERE status IN ('complete', 'cancelled', 'error')
    AND completed_at < NOW() - INTERVAL '30 days';
    
  GET DIAGNOSTICS old_completed_jobs = ROW_COUNT;
  
  -- Clean up orphaned tracking records
  DELETE FROM public.upload_job_records
  WHERE job_id NOT IN (SELECT id FROM public.upload_jobs);
  
  GET DIAGNOSTICS orphaned_records = ROW_COUNT;
  
  -- Build summary
  cleanup_summary := format(
    'Cleanup completed: %s stale jobs marked as error, %s old jobs archived, %s orphaned records removed',
    stale_jobs, old_completed_jobs, orphaned_records
  );
  
  RETURN cleanup_summary;
END;
$$ LANGUAGE plpgsql;

-- 14. Create a view for job queue monitoring
CREATE OR REPLACE VIEW public.job_queue_status AS
SELECT 
  id,
  filename,
  status,
  priority,
  estimated_size,
  total_chunks,
  chunks_received,
  processed_records,
  retry_count,
  max_retries,
  created_at,
  processing_started_at,
  last_heartbeat,
  completed_at,
  CASE 
    WHEN status = 'processing' AND last_heartbeat IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::INTEGER
    ELSE NULL
  END as seconds_since_heartbeat,
  CASE 
    WHEN processing_started_at IS NOT NULL AND status = 'processing'
    THEN EXTRACT(EPOCH FROM (NOW() - processing_started_at))::INTEGER
    ELSE NULL
  END as processing_duration_seconds,
  CASE 
    WHEN total_chunks > 0 
    THEN ROUND((chunks_received::DECIMAL / total_chunks) * 100, 2)
    ELSE 0
  END as progress_percentage
FROM public.upload_jobs
ORDER BY 
  CASE status
    WHEN 'processing' THEN 1
    WHEN 'queued' THEN 2
    WHEN 'created' THEN 3
    WHEN 'complete' THEN 4
    WHEN 'error' THEN 5
    WHEN 'cancelled' THEN 6
    ELSE 7
  END,
  priority DESC,
  created_at ASC;