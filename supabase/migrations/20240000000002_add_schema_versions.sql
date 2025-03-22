-- Create schema versions table
CREATE TABLE IF NOT EXISTS schema_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name text NOT NULL,
    version integer NOT NULL,
    schema_definition jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_current boolean DEFAULT true,
    hash text NOT NULL, -- MD5 hash of schema structure for quick comparison
    UNIQUE(table_name, version)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_versions_table_name 
ON schema_versions(table_name);

-- Create function to update is_current flag
CREATE OR REPLACE FUNCTION update_schema_version_current()
RETURNS TRIGGER AS $$
BEGIN
    -- Set all other versions of this table to not current
    UPDATE schema_versions 
    SET is_current = false 
    WHERE table_name = NEW.table_name 
    AND id != NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain current version
CREATE TRIGGER set_current_schema_version
    BEFORE INSERT ON schema_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_schema_version_current();