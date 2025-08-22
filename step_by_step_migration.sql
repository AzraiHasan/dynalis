-- Step-by-step migration to avoid syntax errors
-- Run each section separately

-- Step 1: Add user tracking columns
ALTER TABLE public.upload_jobs 
ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
ADD COLUMN IF NOT EXISTS created_by_username TEXT;