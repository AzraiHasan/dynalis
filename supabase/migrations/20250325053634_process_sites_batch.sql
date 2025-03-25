-- supabase/migrations/20250325053634_process_sites_batch.sql
CREATE OR REPLACE FUNCTION public.process_sites_batch(data JSONB)
RETURNS TEXT AS $$
DECLARE
  count_processed INT := 0;
BEGIN
  -- Create a temporary table to deduplicate the data first
  CREATE TEMP TABLE temp_sites ON COMMIT DROP AS 
  SELECT DISTINCT ON (site_id)
    site_id,
    exp_date,
    total_rental,
    total_payment_to_pay,
    deposit
  FROM (
    SELECT
      COALESCE((d->>'site_id')::TEXT, 'NO ID') as site_id,
      (d->>'exp_date')::DATE as exp_date,
      COALESCE((d->>'total_rental')::DECIMAL, 0) as total_rental,
      COALESCE((d->>'total_payment_to_pay')::DECIMAL, 0) as total_payment_to_pay,
      COALESCE((d->>'deposit')::DECIMAL, 0) as deposit,
      ordinality
    FROM jsonb_array_elements(data) WITH ORDINALITY AS d
    ORDER BY ordinality DESC -- Keep the last occurrence of each site_id
  ) src
  ORDER BY site_id;
  
  -- Now perform the upsert with fully deduplicated data
  INSERT INTO sites (
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, updated_at
  )
  SELECT 
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, NOW()
  FROM temp_sites
  ON CONFLICT (site_id)
  DO UPDATE SET
    exp_date = EXCLUDED.exp_date,
    total_rental = EXCLUDED.total_rental,
    total_payment_to_pay = EXCLUDED.total_payment_to_pay,
    deposit = EXCLUDED.deposit,
    updated_at = EXCLUDED.updated_at;
  
  GET DIAGNOSTICS count_processed = ROW_COUNT;
  DROP TABLE temp_sites;
  
  RETURN count_processed || ' records processed';
END;
$$ LANGUAGE plpgsql;