-- supabase/migrations/[date]_create_upload_tracking.sql
CREATE TABLE public.upload_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  total_chunks INTEGER NOT NULL,
  chunks_received INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add RLS policies
ALTER TABLE public.upload_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own upload jobs"
  ON public.upload_jobs
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own upload jobs"
  ON public.upload_jobs
  FOR INSERT
  WITH CHECK (true);