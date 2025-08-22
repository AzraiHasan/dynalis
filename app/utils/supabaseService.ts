// utils/supabaseService.ts
import { useSupabaseClient } from '#imports'
import { parseDate } from '~/utils/dateUtils'
import type { Database } from '~/types/supabase'

// Connection configuration and retry logic
interface ConnectionConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  connectionPooling: boolean;
}

const connectionConfig: ConnectionConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  timeout: 30000, // 30 seconds
  connectionPooling: true
}

// Connection retry utility
const withRetry = async <T>(
  operation: () => Promise<T>,
  context: string = 'database operation',
  maxRetries: number = connectionConfig.maxRetries
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DB Connection] Attempting ${context} (attempt ${attempt}/${maxRetries})`);
      
      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timeout after ${connectionConfig.timeout}ms`)), connectionConfig.timeout)
      );
      
      const result = await Promise.race([operation(), timeoutPromise]);
      
      if (attempt > 1) {
        console.log(`[DB Connection] ${context} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[DB Connection] ${context} failed on attempt ${attempt}:`, lastError.message);
      
      if (attempt === maxRetries) {
        console.error(`[DB Connection] ${context} failed after ${maxRetries} attempts`, lastError);
        break;
      }
      
      // Exponential backoff with jitter
      const delay = connectionConfig.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`[DB Connection] Retrying ${context} in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`${context} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
};

// Connection pool management (simplified for browser environment)
class ConnectionManager {
  private static instance: ConnectionManager;
  private activeConnections = 0;
  private maxConnections = 10;
  private connectionQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  async acquireConnection(): Promise<void> {
    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      console.log(`[Connection Pool] Connection acquired. Active: ${this.activeConnections}/${this.maxConnections}`);
      return;
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, connectionConfig.timeout);

      this.connectionQueue.push({
        resolve: () => {
          clearTimeout(timeout);
          this.activeConnections++;
          console.log(`[Connection Pool] Queued connection acquired. Active: ${this.activeConnections}/${this.maxConnections}`);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  releaseConnection(): void {
    if (this.activeConnections > 0) {
      this.activeConnections--;
      console.log(`[Connection Pool] Connection released. Active: ${this.activeConnections}/${this.maxConnections}`);

      // Process queue
      const next = this.connectionQueue.shift();
      if (next) {
        next.resolve();
      }
    }
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      maxConnections: this.maxConnections,
      queueLength: this.connectionQueue.length
    };
  }
}

// Input data interface
export interface FileRow {
  [key: string]: string | number | null | undefined;
  "SITE ID"?: string | number | null;
  "EXP DATE"?: string | null;
  "TOTAL RENTAL (RM)"?: string | number | null;
  "TOTAL PAYMENT TO PAY (RM)"?: string | number | null;
  "DEPOSIT (RM)"?: string | number | null;
}

export const useSiteService = () => {
  const supabase = useSupabaseClient<Database>()
  const connectionManager = ConnectionManager.getInstance()
  
  // Helper function to parse currency values
  const parseCurrency = (value: unknown): number => {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[RM,\s]/g, "")) || 0;
  };
  
  // Enhanced database operation wrapper with connection management
  const executeWithConnection = async <T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> => {
    if (connectionConfig.connectionPooling) {
      await connectionManager.acquireConnection();
    }
    
    try {
      return await withRetry(operation, context);
    } finally {
      if (connectionConfig.connectionPooling) {
        connectionManager.releaseConnection();
      }
    }
  };
  
  // Initialize database - this would typically be done through migrations
  const initializeDatabase = async () => {
    try {
      // Just check if the table exists with connection management
      return await executeWithConnection(async () => {
        const { count, error } = await supabase
          .from('sites')
          .select('*', { count: 'exact', head: true })
        
        if (error) throw error
        console.log(`Sites table exists with ${count} records`)
        return true
      }, 'database initialization check')
    } catch (error) {
      console.error('Database initialization failed:', error)
      return false
    }
  }
  
  // Upload site data in batches with enhanced connection management
  const uploadSiteDataBatch = async (data: FileRow[]) => {
    return await executeWithConnection(async () => {
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
    }, `batch upload of ${data.length} records`)
  }
  
  // Fetch site data with connection management
  const fetchSiteData = async () => {
    return await executeWithConnection(async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
      
      if (error) {
        console.error('Error fetching data:', error)
        throw error
      }
      
      return data || []
    }, 'fetch site data')
  }
  
  // Clear all data from a specific table
  const clearTable = async (tableName: string) => {
    console.log(`🔄 [RESET] Starting clearTable operation for: ${tableName}`)
    return await executeWithConnection(async () => {
      try {
        console.log(`🔄 [RESET] Attempting TRUNCATE via RPC for table: ${tableName}`)
        // Try using RPC function for TRUNCATE (faster and more reliable, bypasses RLS)
        const { error: truncateError } = await supabase.rpc('truncate_table', { table_name: tableName })
        
        if (!truncateError) {
          console.log(`✅ [RESET] Successfully truncated ${tableName} table via RPC`)
          if (tableName === 'sites') {
            console.log('🎯 [RESET] *** SITES TABLE TRUNCATED VIA RPC ***')
          }
          return true
        }
        
        console.warn(`⚠️ [RESET] Truncate RPC failed for ${tableName}, falling back to DELETE:`, truncateError.message)
      } catch (truncateErr) {
        console.warn(`⚠️ [RESET] Truncate RPC not available for ${tableName}, using DELETE method:`, truncateErr)
      }
      
      console.log(`🔄 [RESET] Using DELETE fallback method for table: ${tableName}`)
      // Fallback: First check if table exists by trying to count records
      console.log(`🔍 [RESET] Checking if table ${tableName} exists and counting records`)
      const { count, error: countError } = await supabase
        .from(tableName as keyof Database['public']['Tables'])
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        // If we can't even check the table, it might not exist
        if (countError.code === '42P01' || 
            countError.message?.includes('does not exist') ||
            countError.message?.includes('relation') ||
            countError.details?.includes('does not exist')) {
          console.log(`ℹ️ [RESET] Table ${tableName} does not exist, skipping...`)
          return true
        }
        console.error(`❌ [RESET] Error checking ${tableName} table:`, countError)
        throw new Error(`Failed to access ${tableName}: ${countError.message || JSON.stringify(countError)}`)
      }
      
      console.log(`📊 [RESET] Table ${tableName} contains ${count} records`)
      if (count === 0) {
        console.log(`ℹ️ [RESET] Table ${tableName} is already empty`)
        if (tableName === 'sites') {
          console.log('🎯 [RESET] *** SITES TABLE WAS ALREADY EMPTY ***')
        }
        return true
      }
      
      console.log(`🗑️ [RESET] Starting batch deletion for table ${tableName} with ${count} records`)
      // Delete all records in batches if table has data
      let deletedCount = 0
      let batchNumber = 1
      while (true) {
        console.log(`🔄 [RESET] Processing batch ${batchNumber} for table ${tableName}`)
        const { data, error: fetchError } = await supabase
          .from(tableName as keyof Database['public']['Tables'])
          .select('id')
          .limit(1000) // Process in batches
        
        if (fetchError) {
          // Check if table doesn't exist
          if (fetchError.code === '42P01' || 
              fetchError.message?.includes('does not exist') ||
              fetchError.message?.includes('relation') ||
              fetchError.details?.includes('does not exist')) {
            console.log(`ℹ️ [RESET] Table ${tableName} does not exist during fetch, skipping...`)
            return true
          }
          throw new Error(`Failed to fetch ${tableName} records: ${fetchError.message || JSON.stringify(fetchError)}`)
        }
        
        if (!data || data.length === 0) {
          console.log(`✅ [RESET] No more records to delete from ${tableName}`)
          break
        }
        
        console.log(`🗑️ [RESET] Deleting ${data.length} records from ${tableName} (batch ${batchNumber})`)
        const { error: deleteError } = await supabase
          .from(tableName as keyof Database['public']['Tables'])
          .delete()
          .in('id', data.map(record => record.id))
        
        if (deleteError) {
          throw new Error(`Failed to delete from ${tableName}: ${deleteError.message || JSON.stringify(deleteError)}`)
        }
        
        deletedCount += data.length
        console.log(`✅ [RESET] Deleted ${data.length} records from ${tableName} (total deleted: ${deletedCount})`)
        
        if (tableName === 'sites') {
          console.log(`🎯 [RESET] *** SITES TABLE: ${data.length} records deleted in batch ${batchNumber}, total: ${deletedCount} ***`)
        }
        
        batchNumber++
        // Break if we deleted less than the batch size (means we're done)
        if (data.length < 1000) break
      }
      
      console.log(`✅ [RESET] Successfully cleared ${tableName} table (${deletedCount} records total)`)
      if (tableName === 'sites') {
        console.log(`🎯 [RESET] *** SITES TABLE FULLY CLEARED: ${deletedCount} total records deleted ***`)
      }
      return true
    }, `clear ${tableName} table`)
  }

  // Clear all demo data using the database function that bypasses RLS
  const clearAllDemoData = async () => {
    console.log('🚀 [RESET] Starting clearAllDemoData operation')
    return await executeWithConnection(async () => {
      try {
        console.log('🔄 [RESET] Attempting to clear data via RPC function: clear_demo_data')
        console.log('🔍 [RESET] Testing RPC function availability first...')
        
        // Use the dedicated RPC function that bypasses RLS
        const { data, error } = await supabase.rpc('clear_demo_data')
        
        if (error) {
          console.error('❌ [RESET] RPC clear_demo_data failed:')
          console.error('❌ [RESET] Error code:', error.code)
          console.error('❌ [RESET] Error message:', error.message)
          console.error('❌ [RESET] Error details:', error.details)
          console.error('❌ [RESET] Error hint:', error.hint)
          console.error('❌ [RESET] Full error object:', JSON.stringify(error, null, 2))
          throw error
        }
        
        console.log('✅ [RESET] Demo data clearing completed via RPC:', data)
        console.log('🎯 [RESET] Sites table should be cleared by RPC function')
        
        // Verify the clearing worked by checking sites table count
        try {
          const { count, error: countError } = await supabase
            .from('sites')
            .select('*', { count: 'exact', head: true })
          
          if (countError) {
            console.error('❌ [RESET] Error checking sites table after RPC:', countError)
          } else {
            console.log(`📊 [RESET] Sites table count after RPC clearing: ${count} records`)
            if (count === 0) {
              console.log('✅ [RESET] *** SITES TABLE SUCCESSFULLY CLEARED BY RPC ***')
            } else {
              console.error(`🚨 [RESET] *** SITES TABLE NOT CLEARED - STILL HAS ${count} RECORDS ***`)
            }
          }
        } catch (verifyError) {
          console.error('❌ [RESET] Failed to verify clearing:', verifyError)
        }
        
        return true
      } catch (error) {
        console.warn('⚠️ [RESET] RPC method failed, falling back to individual table clearing:')
        console.warn('⚠️ [RESET] RPC error details:', error instanceof Error ? error.message : String(error))
        
        // Fallback to individual table clearing
        console.log('🔄 [RESET] Using fallback method - clearing tables individually')
        const tablesToClear = [
          'upload_job_records',  // Child table - links jobs to sites
          'upload_conflicts',    // Child table - conflicts for jobs
          'upload_jobs',         // Parent table for job tracking
          'sites'               // Main table with site data
        ]

        console.log('📋 [RESET] Tables to clear:', tablesToClear)
        const results = []
        for (const table of tablesToClear) {
          try {
            console.log(`🔄 [RESET] Attempting to clear table: ${table}`)
            const tableResult = await clearTable(table)
            console.log(`✅ [RESET] Successfully cleared table: ${table}, result:`, tableResult)
            results.push(`${table}: cleared`)
            
            if (table === 'sites') {
              console.log('🎯 [RESET] *** SITES TABLE CLEARED SUCCESSFULLY ***')
            }
          } catch (tableError) {
            const errorMessage = tableError instanceof Error ? tableError.message : String(tableError)
            console.error(`❌ [RESET] Failed to clear ${table}:`, errorMessage)
            results.push(`${table}: skipped (${errorMessage})`)
            
            if (table === 'sites') {
              console.error('🚨 [RESET] *** SITES TABLE CLEARING FAILED ***', errorMessage)
            }
          }
        }
        
        console.log('✅ [RESET] Demo data clearing completed via fallback:', results)
        
        // Final verification of sites table after fallback
        try {
          const { count, error: countError } = await supabase
            .from('sites')
            .select('*', { count: 'exact', head: true })
          
          if (countError) {
            console.error('❌ [RESET] Error checking sites table after fallback:', countError)
          } else {
            console.log(`📊 [RESET] Sites table count after fallback clearing: ${count} records`)
            if (count === 0) {
              console.log('✅ [RESET] *** SITES TABLE SUCCESSFULLY CLEARED BY FALLBACK ***')
            } else {
              console.error(`🚨 [RESET] *** SITES TABLE NOT CLEARED - STILL HAS ${count} RECORDS ***`)
            }
          }
        } catch (verifyError) {
          console.error('❌ [RESET] Failed to verify fallback clearing:', verifyError)
        }
        
        return true
      }
    }, 'clear all demo data')
  }

  // Get connection pool statistics
  const getConnectionStats = () => {
    return connectionManager.getStats()
  }
  
  // Test function to directly check RPC availability and table clearing
  const testRPCFunctions = async () => {
    console.log('🧪 [TEST] Testing RPC functions availability')
    
    try {
      // Test clear_demo_data RPC
      console.log('🧪 [TEST] Testing clear_demo_data RPC function...')
      const { data: rpcData, error: rpcError } = await supabase.rpc('clear_demo_data')
      
      if (rpcError) {
        console.error('❌ [TEST] clear_demo_data RPC failed:', rpcError)
        return { rpcAvailable: false, error: rpcError }
      } else {
        console.log('✅ [TEST] clear_demo_data RPC succeeded:', rpcData)
        return { rpcAvailable: true, data: rpcData }
      }
    } catch (error) {
      console.error('❌ [TEST] Exception testing RPC:', error)
      return { rpcAvailable: false, error }
    }
  }
  
  // Test function to check current table counts
  const getTableCounts = async () => {
    console.log('📊 [TEST] Getting current table counts')
    const tables = ['sites', 'upload_jobs', 'upload_conflicts', 'upload_job_records']
    const counts: Record<string, number> = {}
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table as keyof Database['public']['Tables'])
          .select('*', { count: 'exact', head: true })
        
        if (error) {
          console.error(`❌ [TEST] Error counting ${table}:`, error)
          counts[table] = -1 // -1 indicates error
        } else {
          counts[table] = count || 0
          console.log(`📊 [TEST] ${table}: ${count} records`)
        }
      } catch (err) {
        console.error(`❌ [TEST] Exception counting ${table}:`, err)
        counts[table] = -1
      }
    }
    
    return counts
  }
  
  // Initialize the database when the service is first used
  initializeDatabase().catch(err => {
    console.error('Database initialization failed:', err)
  })
  
  // Expose debugging functions to window in development
  if (typeof window !== 'undefined' && import.meta.dev) {
    (window as typeof window & { debugReset?: typeof service }).debugReset = {
      testRPCFunctions,
      getTableCounts,
      clearAllDemoData,
      clearTable
    }
    console.log('🧪 [DEBUG] Reset debugging functions available at window.debugReset')
  }
  
  const service = {
    uploadSiteDataBatch,
    fetchSiteData,
    clearTable,
    clearAllDemoData,
    getConnectionStats,
    connectionConfig, // Export config for debugging
    testRPCFunctions, // For debugging
    getTableCounts, // For debugging
  }
  
  return service
}