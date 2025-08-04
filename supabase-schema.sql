-- Supabase Schema Migration Script
-- This script creates all necessary tables for the Dynalis application
-- Maintains current UUID patterns and ID generation strategy

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sites table (maintains dual ID structure)
CREATE TABLE sites (
  id TEXT PRIMARY KEY, -- Keep TEXT to maintain current crypto.randomUUID() pattern
  site_id TEXT NOT NULL UNIQUE,
  exp_date DATE,
  total_rental DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_payment_to_pay DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Upload Jobs table
CREATE TABLE upload_jobs (
  id TEXT PRIMARY KEY, -- Keep TEXT to maintain current crypto.randomUUID() pattern
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'queued', 'processing', 'complete', 'error', 'cancelled')),
  total_chunks INTEGER NOT NULL,
  chunks_received INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- 4. System Fields table
CREATE TABLE system_fields (
  id TEXT PRIMARY KEY, -- Keep TEXT to maintain current crypto.randomUUID() pattern
  name TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'date', 'object', 'array')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  validation_rules JSONB,
  metadata_properties JSONB
);

-- 5. System Field History table
CREATE TABLE system_field_history (
  id TEXT PRIMARY KEY, -- Keep TEXT to maintain current crypto.randomUUID() pattern
  field_id TEXT NOT NULL REFERENCES system_fields(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id),
  field_data JSONB NOT NULL,
  change_reason TEXT
);

-- 6. Schema Change Log table
CREATE TABLE schema_change_log (
  id TEXT PRIMARY KEY, -- Keep TEXT to maintain current crypto.randomUUID() pattern
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL, -- TEXT since it references various entity types
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  previous_state JSONB,
  new_state JSONB,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT
);

-- Create indexes for performance
CREATE INDEX idx_sites_site_id ON sites(site_id);
CREATE INDEX idx_sites_created_by ON sites(created_by);
CREATE INDEX idx_upload_jobs_status ON upload_jobs(status);
CREATE INDEX idx_upload_jobs_created_by ON upload_jobs(created_by);
CREATE INDEX idx_system_fields_status ON system_fields(status);
CREATE INDEX idx_system_field_history_field_id ON system_field_history(field_id);
CREATE INDEX idx_schema_change_log_entity ON schema_change_log(entity_type, entity_id);
CREATE INDEX idx_schema_change_log_approval_status ON schema_change_log(approval_status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_upload_jobs_updated_at BEFORE UPDATE ON upload_jobs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_system_fields_updated_at BEFORE UPDATE ON system_fields FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_field_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_change_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Sites policies (users can access all sites for now - adjust as needed)
CREATE POLICY "Authenticated users can view sites" ON sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sites" ON sites FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = created_by::text);
CREATE POLICY "Users can update sites they created" ON sites FOR UPDATE TO authenticated USING (auth.uid()::text = created_by::text);

-- Upload jobs policies
CREATE POLICY "Users can view their own jobs" ON upload_jobs FOR SELECT USING (auth.uid()::text = created_by::text);
CREATE POLICY "Users can insert their own jobs" ON upload_jobs FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);
CREATE POLICY "Users can update their own jobs" ON upload_jobs FOR UPDATE USING (auth.uid()::text = created_by::text);

-- System fields policies (admin-like functionality)
CREATE POLICY "Authenticated users can view system fields" ON system_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage system fields" ON system_fields FOR ALL TO authenticated USING (true);

-- System field history policies
CREATE POLICY "Authenticated users can view field history" ON system_field_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert field history" ON system_field_history FOR INSERT TO authenticated WITH CHECK (true);

-- Schema change log policies
CREATE POLICY "Authenticated users can view change log" ON schema_change_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert change log" ON schema_change_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authorized users can update approval status" ON schema_change_log FOR UPDATE TO authenticated USING (true);