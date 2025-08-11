-- Sprint 1.3: Data Consistency & Concurrency Enhancement
-- Implement row-level locking, conflict resolution, and atomic operations

-- 1. Add concurrency control columns to upload_jobs
ALTER TABLE public.upload_jobs 
ADD COLUMN IF NOT EXISTS lock_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS concurrent_job_lock BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lock_holder_session TEXT;

-- 2. Create conflict resolution status tracking
CREATE TABLE IF NOT EXISTS public.upload_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.upload_jobs(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL, -- 'duplicate_site_id', 'concurrent_update', 'version_mismatch'
  original_data JSONB,
  conflicting_data JSONB,
  resolution_strategy TEXT, -- 'keep_latest', 'keep_original', 'merge', 'manual'
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_conflicts_job_id ON public.upload_conflicts(job_id);
CREATE INDEX IF NOT EXISTS idx_upload_conflicts_site_id ON public.upload_conflicts(site_id);
CREATE INDEX IF NOT EXISTS idx_upload_conflicts_unresolved ON public.upload_conflicts(resolved) WHERE NOT resolved;

-- 3. Enhanced sites table with concurrency control
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_updated_by_job UUID REFERENCES public.upload_jobs(id),
ADD COLUMN IF NOT EXISTS concurrent_lock BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ;

-- Add index for version-based concurrency control
CREATE INDEX IF NOT EXISTS idx_sites_version ON public.sites(site_id, version);
CREATE INDEX IF NOT EXISTS idx_sites_concurrent_lock ON public.sites(concurrent_lock) WHERE concurrent_lock = TRUE;

-- 4. Function to acquire row-level lock for job processing
CREATE OR REPLACE FUNCTION public.acquire_job_processing_lock(
  job_id UUID,
  session_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_lock_holder TEXT;
  lock_age_minutes INTEGER;
BEGIN
  -- Check if job already has a lock
  SELECT 
    lock_holder_session,
    EXTRACT(EPOCH FROM (NOW() - lock_acquired_at))/60 
  INTO current_lock_holder, lock_age_minutes
  FROM public.upload_jobs
  WHERE id = job_id AND concurrent_job_lock = TRUE;

  -- If lock exists and is fresh (less than 10 minutes), check if it's ours
  IF current_lock_holder IS NOT NULL THEN
    IF lock_age_minutes < 10 THEN
      -- Lock is held by someone else and is fresh
      IF current_lock_holder != COALESCE(session_id, 'unknown') THEN
        RETURN FALSE;
      END IF;
    ELSE
      -- Lock is stale, we can take it
      RAISE NOTICE 'Acquiring stale lock (% minutes old) for job %', lock_age_minutes, job_id;
    END IF;
  END IF;

  -- Attempt to acquire the lock atomically
  UPDATE public.upload_jobs
  SET 
    concurrent_job_lock = TRUE,
    lock_acquired_at = NOW(),
    lock_holder_session = COALESCE(session_id, 'session_' || extract(epoch from now())::text),
    lock_version = lock_version + 1,
    updated_at = NOW()
  WHERE id = job_id
    AND (
      concurrent_job_lock = FALSE 
      OR lock_acquired_at < NOW() - INTERVAL '10 minutes'
      OR lock_holder_session = COALESCE(session_id, 'unknown')
    );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to release job processing lock
CREATE OR REPLACE FUNCTION public.release_job_processing_lock(
  job_id UUID,
  session_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.upload_jobs
  SET 
    concurrent_job_lock = FALSE,
    lock_acquired_at = NULL,
    lock_holder_session = NULL,
    updated_at = NOW()
  WHERE id = job_id
    AND (
      lock_holder_session = COALESCE(session_id, 'unknown')
      OR lock_acquired_at < NOW() - INTERVAL '10 minutes' -- Allow cleanup of stale locks
    );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 6. Enhanced sites batch processing with row-level locking and conflict detection
CREATE OR REPLACE FUNCTION public.process_sites_batch_with_locking(
  data JSONB,
  job_id UUID DEFAULT NULL,
  batch_number INTEGER DEFAULT 1,
  session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  count_processed INTEGER := 0;
  count_conflicts INTEGER := 0;
  start_time TIMESTAMPTZ := NOW();
  end_time TIMESTAMPTZ;
  processing_time_ms INTEGER;
  result JSONB;
  site_record RECORD;
  existing_site RECORD;
  conflict_detected BOOLEAN;
  lock_acquired BOOLEAN;
BEGIN
  -- Ensure job lock is acquired
  IF job_id IS NOT NULL THEN
    SELECT public.acquire_job_processing_lock(job_id, session_id) INTO lock_acquired;
    IF NOT lock_acquired THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Could not acquire job processing lock',
        'records_processed', 0,
        'conflicts_detected', 0
      );
    END IF;
    
    -- Update heartbeat
    PERFORM public.update_job_heartbeat(job_id);
  END IF;

  -- Process each site record with individual row locking
  FOR site_record IN 
    SELECT
      COALESCE((d->>'site_id')::TEXT, 'NO ID') as site_id,
      (d->>'exp_date')::TIMESTAMPTZ as exp_date,
      COALESCE((d->>'total_rental')::DECIMAL, 0) as total_rental,
      COALESCE((d->>'total_payment_to_pay')::DECIMAL, 0) as total_payment_to_pay,
      COALESCE((d->>'deposit')::DECIMAL, 0) as deposit,
      d as original_data
    FROM jsonb_array_elements(data) AS d
  LOOP
    conflict_detected := FALSE;
    
    -- Attempt to lock the site row for update (with timeout)
    BEGIN
      -- Use SELECT FOR UPDATE with NOWAIT to detect conflicts immediately
      SELECT * INTO existing_site
      FROM public.sites
      WHERE site_id = site_record.site_id
      FOR UPDATE NOWAIT;
      
      -- Check for concurrent modifications (version conflict)
      IF existing_site IS NOT NULL THEN
        -- Check if another job is currently processing this site
        IF existing_site.concurrent_lock = TRUE 
           AND existing_site.lock_acquired_at > NOW() - INTERVAL '5 minutes'
           AND existing_site.last_updated_by_job != job_id THEN
          
          conflict_detected := TRUE;
          
          -- Log conflict
          INSERT INTO public.upload_conflicts (
            job_id, site_id, conflict_type, 
            original_data, conflicting_data, resolution_strategy
          ) VALUES (
            job_id, site_record.site_id, 'concurrent_update',
            to_jsonb(existing_site), site_record.original_data, 'keep_latest'
          );
          
          count_conflicts := count_conflicts + 1;
        END IF;
      END IF;
      
      -- If no conflict, proceed with upsert
      IF NOT conflict_detected THEN
        -- Set row lock before processing
        IF existing_site IS NOT NULL THEN
          UPDATE public.sites
          SET 
            concurrent_lock = TRUE,
            lock_acquired_at = NOW(),
            last_updated_by_job = job_id
          WHERE site_id = site_record.site_id;
        END IF;
        
        -- Perform the upsert with optimistic locking
        INSERT INTO public.sites (
          site_id, exp_date, total_rental, 
          total_payment_to_pay, deposit, updated_at,
          version, last_updated_by_job
        ) VALUES (
          site_record.site_id, site_record.exp_date, site_record.total_rental,
          site_record.total_payment_to_pay, site_record.deposit, NOW(),
          1, job_id
        )
        ON CONFLICT (site_id) DO UPDATE SET
          exp_date = CASE 
            WHEN sites.version = EXCLUDED.version - 1 THEN EXCLUDED.exp_date
            ELSE sites.exp_date
          END,
          total_rental = CASE 
            WHEN sites.version = EXCLUDED.version - 1 THEN EXCLUDED.total_rental
            ELSE sites.total_rental
          END,
          total_payment_to_pay = CASE 
            WHEN sites.version = EXCLUDED.version - 1 THEN EXCLUDED.total_payment_to_pay
            ELSE sites.total_payment_to_pay
          END,
          deposit = CASE 
            WHEN sites.version = EXCLUDED.version - 1 THEN EXCLUDED.deposit
            ELSE sites.deposit
          END,
          updated_at = CASE 
            WHEN sites.version = EXCLUDED.version - 1 THEN EXCLUDED.updated_at
            ELSE sites.updated_at
          END,
          version = CASE 
            WHEN sites.version = EXCLUDED.version - 1 THEN sites.version + 1
            ELSE sites.version
          END,
          last_updated_by_job = CASE 
            WHEN sites.version = EXCLUDED.version - 1 THEN EXCLUDED.last_updated_by_job
            ELSE sites.last_updated_by_job
          END,
          concurrent_lock = FALSE,
          lock_acquired_at = NULL
        WHERE sites.version = EXCLUDED.version - 1; -- Only update if version matches
        
        count_processed := count_processed + 1;
      END IF;
      
    EXCEPTION 
      WHEN lock_not_available THEN
        -- Row is locked by another transaction
        conflict_detected := TRUE;
        
        INSERT INTO public.upload_conflicts (
          job_id, site_id, conflict_type, 
          conflicting_data, resolution_strategy
        ) VALUES (
          job_id, site_record.site_id, 'concurrent_update',
          site_record.original_data, 'retry_later'
        );
        
        count_conflicts := count_conflicts + 1;
        
        RAISE NOTICE 'Row lock conflict for site_id: %', site_record.site_id;
    END;
  END LOOP;
  
  -- Clean up any remaining locks for this job
  UPDATE public.sites
  SET 
    concurrent_lock = FALSE,
    lock_acquired_at = NULL
  WHERE last_updated_by_job = job_id 
    AND concurrent_lock = TRUE;
  
  -- Calculate processing time
  end_time := NOW();
  processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  -- Update job with performance metrics
  IF job_id IS NOT NULL THEN
    PERFORM public.update_job_heartbeat(
      job_id, 
      processing_time_ms,
      NULL,
      jsonb_build_object(
        'batch_number', batch_number,
        'records_in_batch', jsonb_array_length(data),
        'records_processed', count_processed,
        'conflicts_detected', count_conflicts,
        'processing_time_ms', processing_time_ms,
        'conflict_ratio', 
          CASE WHEN jsonb_array_length(data) > 0 
            THEN ROUND((count_conflicts::DECIMAL / jsonb_array_length(data)) * 100, 2)
            ELSE 0
          END
      )
    );
  END IF;
  
  -- Build result
  result := jsonb_build_object(
    'success', TRUE,
    'records_processed', count_processed,
    'conflicts_detected', count_conflicts,
    'processing_time_ms', processing_time_ms,
    'batch_number', batch_number
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. Function for atomic job cancellation with rollback capability
CREATE OR REPLACE FUNCTION public.cancel_job_with_rollback(
  job_id UUID,
  rollback_changes BOOLEAN DEFAULT FALSE,
  session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  job_record RECORD;
  rollback_count INTEGER := 0;
  conflict_count INTEGER := 0;
  start_time TIMESTAMPTZ := NOW();
  end_time TIMESTAMPTZ;
  processing_time_ms INTEGER;
  result JSONB;
  lock_acquired BOOLEAN;
BEGIN
  -- Acquire job lock to prevent concurrent operations
  SELECT public.acquire_job_processing_lock(job_id, session_id) INTO lock_acquired;
  IF NOT lock_acquired THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Could not acquire job lock for cancellation',
      'job_id', job_id
    );
  END IF;
  
  -- Get job details
  SELECT * INTO job_record
  FROM public.upload_jobs
  WHERE id = job_id;
  
  IF job_record IS NULL THEN
    PERFORM public.release_job_processing_lock(job_id, session_id);
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Job not found',
      'job_id', job_id
    );
  END IF;
  
  -- Begin atomic transaction for cancellation
  BEGIN
    -- Mark job as cancelled first (prevents new processing)
    UPDATE public.upload_jobs
    SET 
      status = 'cancelled',
      error_message = COALESCE(error_message, 'Cancelled by user request'),
      updated_at = NOW(),
      lock_version = lock_version + 1
    WHERE id = job_id;
    
    -- If rollback is requested, revert site changes
    IF rollback_changes THEN
      -- Method 1: Use upload_job_records if available (precise)
      IF EXISTS (SELECT 1 FROM public.upload_job_records WHERE job_id = cancel_job_with_rollback.job_id LIMIT 1) THEN
        -- Rollback using tracking records
        WITH rollback_sites AS (
          UPDATE public.sites
          SET 
            cancelled_upload = TRUE,
            updated_at = NOW(),
            version = version + 1,
            concurrent_lock = FALSE,
            lock_acquired_at = NULL
          FROM public.upload_job_records jr
          WHERE sites.id = jr.site_id 
            AND jr.job_id = cancel_job_with_rollback.job_id
            AND sites.last_updated_by_job = cancel_job_with_rollback.job_id
          RETURNING sites.id
        )
        SELECT COUNT(*) INTO rollback_count FROM rollback_sites;
        
      ELSE
        -- Method 2: Rollback based on time window and job association (less precise)
        WITH job_timeframe AS (
          SELECT created_at, filename 
          FROM public.upload_jobs 
          WHERE id = cancel_job_with_rollback.job_id
        ),
        rollback_sites AS (
          UPDATE public.sites
          SET 
            cancelled_upload = TRUE,
            updated_at = NOW(),
            version = version + 1,
            concurrent_lock = FALSE,
            lock_acquired_at = NULL
          WHERE last_updated_by_job = cancel_job_with_rollback.job_id
            AND updated_at >= (
              SELECT created_at - INTERVAL '30 minutes' 
              FROM job_timeframe
            )
            AND cancelled_upload IS NOT TRUE
          RETURNING sites.id
        )
        SELECT COUNT(*) INTO rollback_count FROM rollback_sites;
      END IF;
    ELSE
      -- Just clean up locks and mark as cancelled
      UPDATE public.sites
      SET 
        concurrent_lock = FALSE,
        lock_acquired_at = NULL,
        version = version + 1
      WHERE last_updated_by_job = job_id;
    END IF;
    
    -- Count and resolve any pending conflicts
    SELECT COUNT(*) INTO conflict_count
    FROM public.upload_conflicts
    WHERE job_id = cancel_job_with_rollback.job_id AND NOT resolved;
    
    -- Mark conflicts as resolved
    UPDATE public.upload_conflicts
    SET 
      resolved = TRUE,
      resolved_at = NOW(),
      resolved_by = 'system_cancellation',
      resolution_strategy = 'cancelled'
    WHERE job_id = cancel_job_with_rollback.job_id AND NOT resolved;
    
    -- Clean up upload tracking records
    DELETE FROM public.upload_job_records
    WHERE job_id = cancel_job_with_rollback.job_id;
    
    -- Release the job lock
    PERFORM public.release_job_processing_lock(job_id, session_id);
    
    -- Calculate timing
    end_time := NOW();
    processing_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Build success result
    result := jsonb_build_object(
      'success', TRUE,
      'job_id', job_id,
      'rollback_performed', rollback_changes,
      'records_rolled_back', rollback_count,
      'conflicts_resolved', conflict_count,
      'processing_time_ms', processing_time_ms,
      'timestamp', end_time
    );
    
    -- Log the operation
    RAISE NOTICE 'Job % cancelled - Rollback: %, Records: %, Conflicts: %, Time: %ms', 
      job_id, rollback_changes, rollback_count, conflict_count, processing_time_ms;
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback the cancellation transaction
    PERFORM public.release_job_processing_lock(job_id, session_id);
    
    -- Update job status to indicate cancellation failure
    UPDATE public.upload_jobs
    SET 
      error_message = 'Cancellation failed: ' || SQLERRM,
      updated_at = NOW()
    WHERE id = job_id;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Cancellation failed: ' || SQLERRM,
      'job_id', job_id
    );
  END;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to check and resolve version conflicts
CREATE OR REPLACE FUNCTION public.resolve_version_conflicts(
  job_id UUID,
  resolution_strategy TEXT DEFAULT 'keep_latest'
)
RETURNS JSONB AS $$
DECLARE
  resolved_count INTEGER := 0;
  conflict_record RECORD;
  result JSONB;
BEGIN
  -- Process unresolved conflicts for this job
  FOR conflict_record IN 
    SELECT * FROM public.upload_conflicts
    WHERE job_id = resolve_version_conflicts.job_id 
      AND NOT resolved
      AND conflict_type IN ('duplicate_site_id', 'version_mismatch', 'concurrent_update')
  LOOP
    -- Apply resolution strategy
    CASE resolution_strategy
      WHEN 'keep_latest' THEN
        -- Update with the conflicting (newer) data
        UPDATE public.sites
        SET 
          exp_date = (conflict_record.conflicting_data->>'exp_date')::TIMESTAMPTZ,
          total_rental = (conflict_record.conflicting_data->>'total_rental')::DECIMAL,
          total_payment_to_pay = (conflict_record.conflicting_data->>'total_payment_to_pay')::DECIMAL,
          deposit = (conflict_record.conflicting_data->>'deposit')::DECIMAL,
          updated_at = NOW(),
          version = version + 1
        WHERE site_id = conflict_record.site_id;
        
      WHEN 'keep_original' THEN
        -- Keep existing data, don't update
        NULL; -- No action needed
        
      WHEN 'merge' THEN
        -- Merge non-null values (keep latest non-null values)
        UPDATE public.sites
        SET 
          exp_date = COALESCE((conflict_record.conflicting_data->>'exp_date')::TIMESTAMPTZ, exp_date),
          total_rental = COALESCE((conflict_record.conflicting_data->>'total_rental')::DECIMAL, total_rental),
          total_payment_to_pay = COALESCE((conflict_record.conflicting_data->>'total_payment_to_pay')::DECIMAL, total_payment_to_pay),
          deposit = COALESCE((conflict_record.conflicting_data->>'deposit')::DECIMAL, deposit),
          updated_at = NOW(),
          version = version + 1
        WHERE site_id = conflict_record.site_id;
    END CASE;
    
    -- Mark conflict as resolved
    UPDATE public.upload_conflicts
    SET 
      resolved = TRUE,
      resolved_at = NOW(),
      resolved_by = 'auto_resolution',
      resolution_strategy = resolution_strategy
    WHERE id = conflict_record.id;
    
    resolved_count := resolved_count + 1;
  END LOOP;
  
  result := jsonb_build_object(
    'job_id', job_id,
    'conflicts_resolved', resolved_count,
    'resolution_strategy', resolution_strategy,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 9. Add triggers for automatic version incrementing
CREATE OR REPLACE FUNCTION public.increment_site_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sites_version_trigger'
  ) THEN
    CREATE TRIGGER sites_version_trigger
      BEFORE UPDATE ON public.sites
      FOR EACH ROW
      EXECUTE FUNCTION public.increment_site_version();
  END IF;
END
$$;

-- 10. Create a monitoring view for concurrency and conflicts
CREATE OR REPLACE VIEW public.concurrency_monitoring AS
SELECT 
  j.id as job_id,
  j.filename,
  j.status,
  j.concurrent_job_lock,
  j.lock_acquired_at,
  j.lock_holder_session,
  j.lock_version,
  COUNT(c.id) as total_conflicts,
  COUNT(c.id) FILTER (WHERE NOT c.resolved) as unresolved_conflicts,
  COUNT(DISTINCT c.site_id) as affected_sites,
  COUNT(s.id) FILTER (WHERE s.concurrent_lock = TRUE) as locked_sites,
  j.created_at,
  j.updated_at
FROM public.upload_jobs j
LEFT JOIN public.upload_conflicts c ON j.id = c.job_id
LEFT JOIN public.sites s ON s.last_updated_by_job = j.id
WHERE j.status IN ('processing', 'queued', 'created')
   OR j.updated_at > NOW() - INTERVAL '1 hour'
GROUP BY j.id, j.filename, j.status, j.concurrent_job_lock, 
         j.lock_acquired_at, j.lock_holder_session, j.lock_version,
         j.created_at, j.updated_at
ORDER BY j.updated_at DESC;

-- 11. Cleanup function for stale locks and conflicts
CREATE OR REPLACE FUNCTION public.cleanup_concurrency_locks()
RETURNS TEXT AS $$
DECLARE
  stale_job_locks INTEGER;
  stale_site_locks INTEGER;
  old_conflicts INTEGER;
  cleanup_summary TEXT;
BEGIN
  -- Clean up stale job locks (older than 30 minutes)
  UPDATE public.upload_jobs
  SET 
    concurrent_job_lock = FALSE,
    lock_acquired_at = NULL,
    lock_holder_session = NULL
  WHERE concurrent_job_lock = TRUE
    AND lock_acquired_at < NOW() - INTERVAL '30 minutes';
    
  GET DIAGNOSTICS stale_job_locks = ROW_COUNT;
  
  -- Clean up stale site locks (older than 10 minutes)
  UPDATE public.sites
  SET 
    concurrent_lock = FALSE,
    lock_acquired_at = NULL
  WHERE concurrent_lock = TRUE
    AND lock_acquired_at < NOW() - INTERVAL '10 minutes';
    
  GET DIAGNOSTICS stale_site_locks = ROW_COUNT;
  
  -- Archive old resolved conflicts (older than 7 days)
  DELETE FROM public.upload_conflicts
  WHERE resolved = TRUE
    AND resolved_at < NOW() - INTERVAL '7 days';
    
  GET DIAGNOSTICS old_conflicts = ROW_COUNT;
  
  cleanup_summary := format(
    'Concurrency cleanup: %s stale job locks, %s stale site locks, %s old conflicts removed',
    stale_job_locks, stale_site_locks, old_conflicts
  );
  
  RETURN cleanup_summary;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for new tables
ALTER TABLE public.upload_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view upload conflicts"
  ON public.upload_conflicts
  FOR SELECT
  USING (true);

CREATE POLICY "System can manage upload conflicts"
  ON public.upload_conflicts
  FOR ALL
  USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_conflicts TO authenticated;
GRANT SELECT ON public.concurrency_monitoring TO authenticated;