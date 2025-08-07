-- Add this in a new migration file
CREATE OR REPLACE FUNCTION public.mark_cancelled_upload_records(job_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update the most recently inserted sites that were part of this upload job
  -- This assumes you track which records belong to which upload job
  -- You may need to adapt this based on your actual schema
  UPDATE public.sites
  SET cancelled_upload = TRUE,
      updated_at = NOW()
  WHERE id IN (
    SELECT s.id 
    FROM public.sites s
    JOIN public.upload_job_records jr ON s.id = jr.site_id
    WHERE jr.job_id = mark_cancelled_upload_records.job_id
  );
  
  -- Update the job status
  UPDATE public.upload_jobs
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- You would also need to add this column and create a tracking table
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS cancelled_upload BOOLEAN DEFAULT FALSE;

-- Create a table to track which records belong to which upload job
CREATE TABLE IF NOT EXISTS public.upload_job_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.upload_jobs(id),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT upload_job_records_job_site_unique UNIQUE (job_id, site_id)
);