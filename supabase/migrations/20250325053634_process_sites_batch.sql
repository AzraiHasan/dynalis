-- supabase/migrations/20250325053634_process_sites_batch.sql
CREATE OR REPLACE FUNCTION public.process_sites_batch(data JSONB)
RETURNS TEXT AS $$
DECLARE
  count_processed INT;
BEGIN
  -- First deduplicate the input data
  WITH deduplicated AS (
    SELECT DISTINCT ON ((d->>'site_id')::TEXT)
      COALESCE((d->>'site_id')::TEXT, 'NO ID') as site_id,
      (d->>'exp_date')::DATE as exp_date,
      COALESCE((d->>'total_rental')::DECIMAL, 0) as total_rental,
      COALESCE((d->>'total_payment_to_pay')::DECIMAL, 0) as total_payment_to_pay,
      COALESCE((d->>'deposit')::DECIMAL, 0) as deposit
    FROM jsonb_array_elements(data) AS d
    ORDER BY (d->>'site_id')::TEXT
  ),
  batch_upsert AS (
    INSERT INTO sites (
      site_id, exp_date, total_rental, 
      total_payment_to_pay, deposit
    )
    SELECT * FROM deduplicated
    ON CONFLICT (site_id)
    DO UPDATE SET
      exp_date = EXCLUDED.exp_date,
      total_rental = EXCLUDED.total_rental,
      total_payment_to_pay = EXCLUDED.total_payment_to_pay,
      deposit = EXCLUDED.deposit,
      updated_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO count_processed FROM batch_upsert;
  
  RETURN count_processed || ' records processed';
END;
$$ LANGUAGE plpgsql;