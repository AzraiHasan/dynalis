create table if not exists site_data (
  id uuid default gen_random_uuid() primary key,
  -- Core fields for dashboard calculations
  site_id text,
  exp_date timestamp with time zone,
  total_rental numeric(15,2),
  total_payment numeric(15,2),
  deposit numeric(15,2),
  
  -- Upload metadata
  upload_batch_id uuid not null,
  uploaded_at timestamp with time zone default now(),
  last_updated timestamp with time zone default now(),
  file_name text not null,
  
  -- Complete data storage
  raw_data jsonb not null, -- stores complete row data
  column_headers text[] not null, -- stores column names
  
  -- Indexes for common queries
  constraint idx_upload_batch unique (upload_batch_id, site_id)
);

-- Create indexes for performance
create index if not exists idx_site_data_exp_date on site_data(exp_date);
create index if not exists idx_site_data_site_id on site_data(site_id);
create index if not exists idx_site_data_batch on site_data(upload_batch_id);