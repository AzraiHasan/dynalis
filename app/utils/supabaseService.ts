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

  // Enhanced sites table clearing with multiple methods
  const clearSitesTableRobust = async () => {
    console.log('🎯 [SITES] Starting enhanced sites table clearing')
    
    // Method 1: Try RPC truncate first
    try {
      console.log('🔄 [SITES] Method 1: Attempting RPC truncate_table for sites')
      const { error: truncateError } = await supabase.rpc('truncate_table', { table_name: 'sites' })
      
      if (!truncateError) {
        console.log('✅ [SITES] Method 1 SUCCESS: Sites table truncated via RPC')
        // Immediate verification
        const { count } = await supabase.from('sites').select('*', { count: 'exact', head: true })
        if (count === 0) {
          console.log('✅ [SITES] VERIFIED: Sites table is empty after RPC truncate')
          return { success: true, method: 'RPC truncate', recordsCleared: 'unknown' }
        } else {
          console.error(`🚨 [SITES] VERIFICATION FAILED: ${count} records still remain after RPC truncate`)
        }
      } else {
        console.warn('⚠️ [SITES] Method 1 FAILED: RPC truncate error:', truncateError.message)
      }
    } catch (error) {
      console.warn('⚠️ [SITES] Method 1 EXCEPTION:', error instanceof Error ? error.message : String(error))
    }

    // Method 2: Try bulk DELETE with chunking
    try {
      console.log('🔄 [SITES] Method 2: Attempting chunked DELETE for sites table')
      
      // First get total count
      const { count: totalCount, error: countError } = await supabase
        .from('sites')
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        throw new Error(`Failed to count sites: ${countError.message}`)
      }
      
      console.log(`📊 [SITES] Sites table contains ${totalCount} records to delete`)
      
      if (totalCount === 0) {
        console.log('✅ [SITES] Sites table is already empty')
        return { success: true, method: 'already empty', recordsCleared: 0 }
      }

      let deletedTotal = 0
      let batchNum = 1
      const batchSize = 500 // Smaller batches for better reliability

      while (true) {
        console.log(`🔄 [SITES] Processing deletion batch ${batchNum} (batch size: ${batchSize})`)
        
        // Fetch batch of IDs
        const { data: batch, error: fetchError } = await supabase
          .from('sites')
          .select('id')
          .limit(batchSize)
        
        if (fetchError) {
          throw new Error(`Failed to fetch sites batch: ${fetchError.message}`)
        }
        
        if (!batch || batch.length === 0) {
          console.log('✅ [SITES] No more records to delete')
          break
        }
        
        console.log(`🗑️ [SITES] Deleting batch of ${batch.length} records`)
        
        // Delete this batch
        const { error: deleteError } = await supabase
          .from('sites')
          .delete()
          .in('id', batch.map(record => record.id))
        
        if (deleteError) {
          console.error(`❌ [SITES] Batch ${batchNum} deletion failed:`, deleteError)
          // Try smaller batch size
          if (batchSize > 100 && batchNum === 1) {
            console.log('🔄 [SITES] Retrying with smaller batch size')
            return await clearSitesTableRobust() // Recursive retry with smaller batches
          }
          throw new Error(`Failed to delete sites batch: ${deleteError.message}`)
        }
        
        deletedTotal += batch.length
        console.log(`✅ [SITES] Batch ${batchNum} completed: ${batch.length} records deleted (total: ${deletedTotal})`)
        
        batchNum++
        
        // Break if we got less than batch size (last batch)
        if (batch.length < batchSize) {
          break
        }
        
        // Safety check - don't run forever
        if (batchNum > 1000) {
          throw new Error('Too many batches - possible infinite loop')
        }
      }
      
      // Final verification
      const { count: remainingCount } = await supabase
        .from('sites')
        .select('*', { count: 'exact', head: true })
      
      if (remainingCount === 0) {
        console.log(`✅ [SITES] Method 2 SUCCESS: All ${deletedTotal} records deleted, sites table is empty`)
        return { success: true, method: 'chunked DELETE', recordsCleared: deletedTotal }
      } else {
        console.error(`🚨 [SITES] Method 2 PARTIAL: Deleted ${deletedTotal} but ${remainingCount} records still remain`)
        return { success: false, method: 'chunked DELETE', recordsCleared: deletedTotal, remaining: remainingCount }
      }
      
    } catch (error) {
      console.error('❌ [SITES] Method 2 FAILED:', error instanceof Error ? error.message : String(error))
    }

    // Method 3: Last resort - single record deletion
    try {
      console.log('🔄 [SITES] Method 3: Last resort single-record deletion')
      
      let singleDeleteCount = 0
      const maxSingleDeletes = 10000 // Safety limit
      
      for (let i = 0; i < maxSingleDeletes; i++) {
        const { data: singleRecord, error: fetchError } = await supabase
          .from('sites')
          .select('id')
          .limit(1)
          .single()
        
        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No rows found - table is empty
            console.log('✅ [SITES] Method 3 SUCCESS: No more records found, table is empty')
            return { success: true, method: 'single DELETE', recordsCleared: singleDeleteCount }
          }
          throw new Error(`Failed to fetch single record: ${fetchError.message}`)
        }
        
        const { error: deleteError } = await supabase
          .from('sites')
          .delete()
          .eq('id', singleRecord.id)
        
        if (deleteError) {
          throw new Error(`Failed to delete single record: ${deleteError.message}`)
        }
        
        singleDeleteCount++
        if (singleDeleteCount % 100 === 0) {
          console.log(`🔄 [SITES] Single deletion progress: ${singleDeleteCount} records deleted`)
        }
      }
      
      console.error(`🚨 [SITES] Method 3 TIMEOUT: Reached maximum single deletions (${maxSingleDeletes})`)
      return { success: false, method: 'single DELETE', recordsCleared: singleDeleteCount, error: 'timeout' }
      
    } catch (error) {
      console.error('❌ [SITES] Method 3 FAILED:', error instanceof Error ? error.message : String(error))
    }

    console.error('🚨 [SITES] ALL METHODS FAILED: Unable to clear sites table')
    return { success: false, method: 'none', recordsCleared: 0, error: 'all methods failed' }
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
        
        // Immediate verification of RPC clearing
        try {
          const { count, error: countError } = await supabase
            .from('sites')
            .select('*', { count: 'exact', head: true })
          
          if (countError) {
            console.error('❌ [RESET] Error checking sites table after RPC:', countError)
            throw new Error(`RPC verification failed: ${countError.message}`)
          } else {
            console.log(`📊 [RESET] Sites table count after RPC clearing: ${count} records`)
            if (count === 0) {
              console.log('✅ [RESET] *** SITES TABLE SUCCESSFULLY CLEARED BY RPC ***')
              return true
            } else {
              console.error(`🚨 [RESET] *** RPC FAILED - SITES TABLE STILL HAS ${count} RECORDS ***`)
              throw new Error(`RPC did not clear sites table - ${count} records remain`)
            }
          }
        } catch (verifyError) {
          console.error('❌ [RESET] RPC verification failed:', verifyError)
          throw verifyError
        }
        
      } catch (error) {
        console.warn('⚠️ [RESET] RPC method failed, falling back to enhanced individual clearing:')
        console.warn('⚠️ [RESET] RPC error details:', error instanceof Error ? error.message : String(error))
        
        // Fallback to enhanced individual table clearing
        console.log('🔄 [RESET] Using fallback method - clearing tables individually with enhanced sites clearing')
        const otherTables = [
          'upload_job_records',  // Child table - links jobs to sites
          'upload_conflicts',    // Child table - conflicts for jobs
          'upload_jobs',         // Parent table for job tracking
        ]

        console.log('📋 [RESET] Other tables to clear:', otherTables)
        const results = []
        
        // Clear other tables first
        for (const table of otherTables) {
          try {
            console.log(`🔄 [RESET] Attempting to clear table: ${table}`)
            const tableResult = await clearTable(table)
            console.log(`✅ [RESET] Successfully cleared table: ${table}, result:`, tableResult)
            results.push(`${table}: cleared`)
          } catch (tableError) {
            const errorMessage = tableError instanceof Error ? tableError.message : String(tableError)
            console.error(`❌ [RESET] Failed to clear ${table}:`, errorMessage)
            results.push(`${table}: skipped (${errorMessage})`)
          }
        }
        
        // Use enhanced sites clearing
        console.log('🎯 [RESET] Using enhanced sites table clearing method')
        try {
          const sitesResult = await clearSitesTableRobust()
          console.log('📊 [RESET] Enhanced sites clearing result:', sitesResult)
          
          if (sitesResult.success) {
            console.log('✅ [RESET] *** SITES TABLE CLEARED SUCCESSFULLY VIA ENHANCED METHOD ***')
            console.log(`✅ [RESET] Method used: ${sitesResult.method}, Records cleared: ${sitesResult.recordsCleared}`)
            results.push(`sites: cleared via ${sitesResult.method}`)
          } else {
            console.error('🚨 [RESET] *** ENHANCED SITES TABLE CLEARING FAILED ***')
            console.error(`🚨 [RESET] Method attempted: ${sitesResult.method}, Error: ${sitesResult.error}`)
            results.push(`sites: FAILED (${sitesResult.error})`)
            throw new Error(`Sites table clearing failed: ${sitesResult.error}`)
          }
        } catch (sitesError) {
          console.error('❌ [RESET] Enhanced sites clearing exception:', sitesError)
          results.push(`sites: EXCEPTION (${sitesError instanceof Error ? sitesError.message : String(sitesError)})`)
          throw new Error(`Critical failure: Sites table could not be cleared`)
        }
        
        console.log('✅ [RESET] Demo data clearing completed via enhanced fallback:', results)
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

  // Comprehensive verification function to check if all demo tables are cleared
  const verifyTablesCleared = async () => {
    console.log('🔍 [VERIFY] Starting comprehensive table clearing verification')
    
    const tables = ['sites', 'upload_jobs', 'upload_conflicts', 'upload_job_records']
    const verificationResults = {
      allCleared: true,
      tableCounts: {} as Record<string, number>,
      errors: [] as string[],
      summary: ''
    }
    
    let totalRecords = 0
    const tableResults: string[] = []
    
    for (const table of tables) {
      try {
        console.log(`🔍 [VERIFY] Checking table: ${table}`)
        const { count, error } = await supabase
          .from(table as keyof Database['public']['Tables'])
          .select('*', { count: 'exact', head: true })
        
        if (error) {
          const errorMsg = `Error checking ${table}: ${error.message}`
          console.error(`❌ [VERIFY] ${errorMsg}`)
          verificationResults.errors.push(errorMsg)
          verificationResults.tableCounts[table] = -1
          verificationResults.allCleared = false
          tableResults.push(`❌ ${table}: ERROR`)
        } else {
          const recordCount = count || 0
          verificationResults.tableCounts[table] = recordCount
          totalRecords += recordCount
          
          if (recordCount === 0) {
            console.log(`✅ [VERIFY] ${table}: CLEARED (0 records)`)
            tableResults.push(`✅ ${table}: CLEARED`)
          } else {
            console.warn(`⚠️ [VERIFY] ${table}: NOT CLEARED (${recordCount} records remaining)`)
            tableResults.push(`⚠️ ${table}: ${recordCount} records`)
            verificationResults.allCleared = false
          }
        }
      } catch (err) {
        const errorMsg = `Exception checking ${table}: ${err instanceof Error ? err.message : String(err)}`
        console.error(`❌ [VERIFY] ${errorMsg}`)
        verificationResults.errors.push(errorMsg)
        verificationResults.tableCounts[table] = -1
        verificationResults.allCleared = false
        tableResults.push(`❌ ${table}: EXCEPTION`)
      }
    }
    
    // Create comprehensive summary
    if (verificationResults.allCleared) {
      verificationResults.summary = `✅ ALL TABLES CLEARED - Demo reset successful! (${tables.length} tables verified)`
      console.log('🎉 [VERIFY] ===================================================')
      console.log('🎉 [VERIFY] ✅ ALL SUPABASE TABLES SUCCESSFULLY CLEARED ✅')
      console.log('🎉 [VERIFY] ===================================================')
    } else {
      const clearedCount = Object.values(verificationResults.tableCounts).filter(count => count === 0).length
      const unclearedCount = tables.length - clearedCount
      verificationResults.summary = `⚠️ PARTIAL CLEARING - ${clearedCount}/${tables.length} tables cleared, ${unclearedCount} tables still have data, ${totalRecords} total records remaining`
      console.error('🚨 [VERIFY] ===================================================')
      console.error('🚨 [VERIFY] ⚠️ SUPABASE TABLES NOT FULLY CLEARED ⚠️')
      console.error('🚨 [VERIFY] ===================================================')
    }
    
    // Log detailed results
    console.log('📊 [VERIFY] Table clearing verification results:')
    tableResults.forEach(result => console.log(`📊 [VERIFY] ${result}`))
    console.log(`📊 [VERIFY] Total remaining records: ${totalRecords}`)
    
    if (verificationResults.errors.length > 0) {
      console.error('🚨 [VERIFY] Verification errors encountered:')
      verificationResults.errors.forEach(error => console.error(`🚨 [VERIFY] ${error}`))
    }
    
    console.log(`📋 [VERIFY] Summary: ${verificationResults.summary}`)
    
    return verificationResults
  }
  
  // Initialize the database when the service is first used
  initializeDatabase().catch(err => {
    console.error('Database initialization failed:', err)
  })
  
  // Expose debugging functions to window in development
  if (typeof window !== 'undefined' && import.meta.dev) {
    const debugFunctions = {
      testRPCFunctions,
      getTableCounts,
      clearAllDemoData,
      clearTable,
      clearSitesTableRobust,
      verifyTablesCleared
    };
    (window as typeof window & { debugReset?: typeof debugFunctions }).debugReset = debugFunctions;
    console.log('🧪 [DEBUG] Reset debugging functions available at window.debugReset')
  }
  
  const service = {
    uploadSiteDataBatch,
    fetchSiteData,
    clearTable,
    clearAllDemoData,
    clearSitesTableRobust, // Enhanced sites clearing
    verifyTablesCleared, // For verification after reset
    getConnectionStats,
    connectionConfig, // Export config for debugging
    testRPCFunctions, // For debugging
    getTableCounts, // For debugging
  }
  
  return service
}