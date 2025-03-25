-- supabase/migrations/20250324100100_add_bulk_upload_function.sql
CREATE OR REPLACE FUNCTION public.bulk_upload_sites(data JSONB)
RETURNS SETOF sites AS $$
BEGIN
  -- Create temp table with same structure
  CREATE TEMP TABLE temp_sites (LIKE sites EXCLUDING CONSTRAINTS);
  
  -- Insert from JSON
  INSERT INTO temp_sites (
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, created_at, updated_at
  )
  SELECT 
    (d->>'site_id')::TEXT,
    (d->>'exp_date')::DATE,
    (d->>'total_rental')::DECIMAL,
    (d->>'total_payment_to_pay')::DECIMAL,
    (d->>'deposit')::DECIMAL,
    NOW(),
    NOW()
  FROM jsonb_array_elements(data) AS d;
  
  -- Use upsert pattern for efficient updates
  INSERT INTO sites (
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, created_at, updated_at
  )
  SELECT 
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, created_at, updated_at
  FROM temp_sites
  ON CONFLICT (site_id)
  DO UPDATE SET
    exp_date = EXCLUDED.exp_date,
    total_rental = EXCLUDED.total_rental,
    total_payment_to_pay = EXCLUDED.total_payment_to_pay,
    deposit = EXCLUDED.deposit,
    updated_at = NOW();
    
  -- Cleanup
  DROP TABLE temp_sites;
  
  RETURN QUERY SELECT * FROM sites;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add this comment to expose the function via RPC
COMMENT ON FUNCTION public.bulk_upload_sites(JSONB) IS 'Bulk upload sites data';