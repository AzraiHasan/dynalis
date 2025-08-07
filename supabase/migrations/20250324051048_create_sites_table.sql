-- Create sites table with proper PostgreSQL types
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT NOT NULL,
  exp_date DATE,
  total_rental DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_payment_to_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Add a unique constraint on site_id
  CONSTRAINT sites_site_id_key UNIQUE (site_id)
);

-- Create index for faster queries
CREATE INDEX idx_sites_site_id ON public.sites(site_id);
CREATE INDEX idx_sites_exp_date ON public.sites(exp_date);

-- Enable Row Level Security
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
CREATE POLICY "Authenticated users can read sites" 
  ON public.sites
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sites" 
  ON public.sites
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their sites" 
  ON public.sites
  FOR UPDATE 
  TO authenticated
  USING (true)
  WITH CHECK (true);