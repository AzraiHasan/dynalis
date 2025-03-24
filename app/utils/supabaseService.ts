// utils/supabaseService.ts
import { useSupabaseClient } from '#imports'
import { parseDate } from '~/utils/dateUtils'
import type { Database } from '~/types/supabase'

// Input data interface
interface FileRow {
  [key: string]: string | number | null | undefined;
  "SITE ID"?: string | number | null;
  "EXP DATE"?: string | null;
  "TOTAL RENTAL (RM)"?: string | number | null;
  "TOTAL PAYMENT TO PAY (RM)"?: string | number | null;
  "DEPOSIT (RM)"?: string | number | null;
}

export const useSiteService = () => {
  const supabase = useSupabaseClient<Database>()
  
  // Helper function to parse currency values
  const parseCurrency = (value: any): number => {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[RM,\s]/g, "")) || 0;
  };
  
  // Initialize database - this would typically be done through migrations
  const initializeDatabase = async () => {
  try {
    // Just check if the table exists
    const { count, error } = await supabase
      .from('sites')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    console.log(`Sites table exists with ${count} records`)
    return true
  } catch (error) {
    console.error('Database initialization failed:', error)
    return false
  }
}
  
  // Upload site data in batches
  const uploadSiteDataBatch = async (data: FileRow[]) => {
    // Transform data to match database schema
    const transformedData = data.map(row => ({
      site_id: row['SITE ID']?.toString() || 'NO ID',
      exp_date: row['EXP DATE'] ? parseDate(row['EXP DATE']?.toString() || '')?.toISOString() : null,
      total_rental: parseCurrency(row['TOTAL RENTAL (RM)']),
      total_payment_to_pay: parseCurrency(row['TOTAL PAYMENT TO PAY (RM)']),
      deposit: parseCurrency(row['DEPOSIT (RM)']),
      updated_at: new Date().toISOString()
    }))
    
    const results = []
    
    // Process each record individually for smart updates
    for (const record of transformedData) {
      // Check if record exists
      const { data: existingRecord } = await supabase
        .from('sites')
        .select('*')
        .eq('site_id', record.site_id)
        .single()
      
      if (existingRecord) {
        // Update only empty fields in existing record
        const updateData = {
          exp_date: existingRecord.exp_date || record.exp_date,
          total_rental: existingRecord.total_rental || record.total_rental,
          total_payment_to_pay: existingRecord.total_payment_to_pay || record.total_payment_to_pay,
          deposit: existingRecord.deposit || record.deposit,
          updated_at: new Date().toISOString()
        }
        
        const { data, error } = await supabase
          .from('sites')
          .update(updateData)
          .eq('site_id', record.site_id)
          .select()
        
        if (error) throw error
        if (data) results.push(data[0])
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('sites')
          .insert(record)
          .select()
        
        if (error) throw error
        if (data) results.push(data[0])
      }
    }
    
    return { success: true, count: transformedData.length, data: results }
  }
  
  // Fetch site data
  const fetchSiteData = async () => {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
    
    if (error) {
      console.error('Error fetching data:', error)
      throw error
    }
    
    return data || []
  }
  
  // Initialize the database when the service is first used
  initializeDatabase().catch(err => {
    console.error('Database initialization failed:', err)
  })
  
  return {
    uploadSiteDataBatch,
    fetchSiteData
  }
}