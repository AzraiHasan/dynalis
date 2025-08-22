-- Step 4: Grant permissions and add comments
COMMENT ON COLUMN public.upload_jobs.created_by_user_id IS 'UUID of the user who created this upload job';
COMMENT ON COLUMN public.upload_jobs.created_by_username IS 'Username/display name of the user who created this upload job';
GRANT SELECT ON public.job_queue_status TO authenticated;