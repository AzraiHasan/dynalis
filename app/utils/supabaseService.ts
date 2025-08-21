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
    return await executeWithConnection(async () => {
      try {
        // Try using RPC function for TRUNCATE (faster and more reliable)
        const { error: truncateError } = await supabase.rpc('truncate_table', { table_name: tableName })
        
        if (!truncateError) {
          console.log(`Successfully truncated ${tableName} table`)
          return true
        }
        
        console.warn(`Truncate failed for ${tableName}, falling back to DELETE:`, truncateError.message)
      } catch (e) {
        console.warn(`Truncate not available for ${tableName}, using DELETE method`)
      }
      
      // Fallback: First check if table exists by trying to count records
      const { count, error: countError } = await supabase
        .from(tableName as keyof Database['public']['Tables'])
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        // If we can't even check the table, it might not exist
        if (countError.code === '42P01' || 
            countError.message?.includes('does not exist') ||
            countError.message?.includes('relation') ||
            countError.details?.includes('does not exist')) {
          console.log(`Table ${tableName} does not exist, skipping...`)
          return true
        }
        console.error(`Error checking ${tableName} table:`, countError)
        throw new Error(`Failed to access ${tableName}: ${countError.message || JSON.stringify(countError)}`)
      }
      
      if (count === 0) {
        console.log(`Table ${tableName} is already empty`)
        return true
      }
      
      // Delete all records in batches if table has data
      let deletedCount = 0
      while (true) {
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
            console.log(`Table ${tableName} does not exist during fetch, skipping...`)
            return true
          }
          throw new Error(`Failed to fetch ${tableName} records: ${fetchError.message || JSON.stringify(fetchError)}`)
        }
        
        if (!data || data.length === 0) break
        
        const { error: deleteError } = await supabase
          .from(tableName as keyof Database['public']['Tables'])
          .delete()
          .in('id', data.map(record => record.id))
        
        if (deleteError) {
          throw new Error(`Failed to delete from ${tableName}: ${deleteError.message || JSON.stringify(deleteError)}`)
        }
        
        deletedCount += data.length
        console.log(`Deleted ${data.length} records from ${tableName} (total: ${deletedCount})`)
        
        // Break if we deleted less than the batch size (means we're done)
        if (data.length < 1000) break
      }
      
      console.log(`Successfully cleared ${tableName} table (${deletedCount} records total)`)
      return true
    }, `clear ${tableName} table`)
  }

  // Clear all demo data in the correct order
  const clearAllDemoData = async () => {
    const tablesToClear = [
      'sites',  // Start with the main table we know exists
      'upload_jobs'  // Only include tables that exist
    ]

    const results = []
    for (const table of tablesToClear) {
      try {
        await clearTable(table)
        results.push(`${table}: cleared`)
      } catch (error) {
        console.warn(`Failed to clear ${table}, skipping:`, error.message)
        results.push(`${table}: skipped (${error.message})`)
      }
    }
    
    console.log('Demo data clearing completed:', results)
    return true
  }

  // Get connection pool statistics
  const getConnectionStats = () => {
    return connectionManager.getStats()
  }
  
  // Initialize the database when the service is first used
  initializeDatabase().catch(err => {
    console.error('Database initialization failed:', err)
  })
  
  return {
    uploadSiteDataBatch,
    fetchSiteData,
    clearTable,
    clearAllDemoData,
    getConnectionStats,
    connectionConfig, // Export config for debugging
  }
}