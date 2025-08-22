-- Step 2: Add indexes
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_by_user_id ON public.upload_jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_by_username ON public.upload_jobs(created_by_username);