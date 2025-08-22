-- Create a function to clear all demo data that bypasses RLS
CREATE OR REPLACE FUNCTION public.clear_demo_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS
AS $$
DECLARE
  result json;
  cleared_tables text[] := '{}';
  table_name text;
  row_count integer;
BEGIN
  -- Array of tables to clear in dependency order (child tables first)
  FOR table_name IN VALUES ('upload_job_records'), ('upload_conflicts'), ('upload_jobs'), ('sites')
  LOOP
    BEGIN
      -- Get count before deletion for logging
      EXECUTE format('SELECT COUNT(*) FROM public.%I', table_name) INTO row_count;
      
      IF row_count > 0 THEN
        -- Delete all records from the table
        EXECUTE format('DELETE FROM public.%I', table_name);
        cleared_tables := array_append(cleared_tables, format('%s: %s records cleared', table_name, row_count));
      ELSE
        cleared_tables := array_append(cleared_tables, format('%s: already empty', table_name));
      END IF;
      
    EXCEPTION
      WHEN others THEN
        -- If table doesn't exist or has other issues, log and continue
        cleared_tables := array_append(cleared_tables, format('%s: skipped (%s)', table_name, SQLERRM));
    END;
  END LOOP;
  
  -- Return results as JSON
  result := json_build_object(
    'success', true,
    'message', 'Demo data clearing completed',
    'details', cleared_tables,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.clear_demo_data() TO authenticated;

-- Also create a simple truncate function for individual tables
CREATE OR REPLACE FUNCTION public.truncate_table(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate table name to prevent SQL injection
  IF table_name NOT IN ('sites', 'upload_jobs', 'upload_conflicts', 'upload_job_records') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;
  
  -- Use TRUNCATE which is faster than DELETE and resets sequences
  EXECUTE format('TRUNCATE TABLE public.%I CASCADE', table_name);
  
  RETURN true;
EXCEPTION
  WHEN others THEN
    -- Fall back to DELETE if TRUNCATE fails
    EXECUTE format('DELETE FROM public.%I', table_name);
    RETURN true;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.truncate_table(text) TO authenticated;