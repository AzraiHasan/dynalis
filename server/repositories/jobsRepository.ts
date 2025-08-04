// server/repositories/jobsRepository.ts
import { useDbConnection } from '../utils/db'

// Job entity type
interface UploadJob {
  id: string;
  filename: string;
  status: 'created' | 'queued' | 'processing' | 'complete' | 'error' | 'cancelled';
  total_chunks: number;
  chunks_received: number;
  processed_records: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Transform database row to typed object
const transformJobRow = (row: Record<string, any>): UploadJob => {
  return {
    id: String(row.id),
    filename: String(row.filename),
    status: row.status as UploadJob['status'],
    total_chunks: Number(row.total_chunks),
    chunks_received: Number(row.chunks_received),
    processed_records: Number(row.processed_records || 0),
    error_message: row.error_message || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: row.completed_at || null
  }
}

export const useJobsRepository = () => {
  const { db, status } = useDbConnection()
  
  if (status !== 'connected' || !db) {
    throw new Error('Database connection not available')
  }
  
  return {
    /**
     * Create a new upload job
     */
    async create(data: {
      filename: string;
      total_chunks: number;
      status?: UploadJob['status'];
    }): Promise<UploadJob> {
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      
      const result = await db.sql`
        INSERT INTO upload_jobs (
          id, filename, total_chunks, status, created_at, updated_at
        ) VALUES (
          ${id}, ${data.filename}, ${data.total_chunks}, 
          ${data.status || 'created'}, ${now}, ${now}
        )
        RETURNING *
      `
      
      const rows = result?.rows || []
      if (rows.length === 0) {
        throw new Error('Failed to create upload job')
      }
      
      return transformJobRow(rows[0])
    },
    
    /**
     * Get job by ID
     */
    async getById(id: string): Promise<UploadJob | null> {
      const result = await db.sql`
        SELECT * FROM upload_jobs WHERE id = ${id} LIMIT 1
      `
      
      const rows = result?.rows || []
      return rows.length > 0 ? transformJobRow(rows[0]) : null
    },
    
    /**
     * Update job progress
     */
    async updateProgress(id: string, data: {
      chunks_received?: number;
      processed_records?: number;
      status?: UploadJob['status'];
      error_message?: string | null;
    }): Promise<UploadJob> {
      const now = new Date().toISOString()
      
      const job = await this.getById(id)
      if (!job) {
        throw new Error(`Job with ID ${id} not found`)
      }
      
      const result = await db.sql`
        UPDATE upload_jobs SET
          chunks_received = ${data.chunks_received !== undefined ? data.chunks_received : job.chunks_received},
          processed_records = ${data.processed_records !== undefined ? data.processed_records : job.processed_records},
          status = ${data.status || job.status},
          error_message = ${data.error_message !== undefined ? data.error_message : job.error_message},
          updated_at = ${now}
        WHERE id = ${id}
        RETURNING *
      `
      
      const rows = result?.rows || []
      if (rows.length === 0) {
        throw new Error(`Failed to update job with ID ${id}`)
      }
      
      return transformJobRow(rows[0])
    },
    
    /**
     * Complete a job
     */
    async completeJob(id: string, processedRecords: number): Promise<UploadJob> {
      const now = new Date().toISOString()
      
      const job = await this.getById(id)
      if (!job) {
        throw new Error(`Job with ID ${id} not found`)
      }
      
      const result = await db.sql`
        UPDATE upload_jobs SET
          status = 'complete',
          chunks_received = ${job.total_chunks},
          processed_records = ${processedRecords},
          completed_at = ${now},
          updated_at = ${now}
        WHERE id = ${id}
        RETURNING *
      `
      
      const rows = result?.rows || []
      if (rows.length === 0) {
        throw new Error(`Failed to complete job with ID ${id}`)
      }
      
      return transformJobRow(rows[0])
    },
    
    /**
     * Get incomplete uploads
     */
    async getIncompleteUploads(filename?: string): Promise<UploadJob[]> {
  // Use template literals instead of string array
  if (filename) {
    const result = await db.sql`
      SELECT * FROM upload_jobs 
      WHERE status IN ('created', 'uploading', 'processing') 
      AND filename = ${filename} 
      ORDER BY created_at DESC 
      LIMIT 5
    `
    const rows = result?.rows || []
    return rows.map(row => transformJobRow(row))
  } else {
    const result = await db.sql`
      SELECT * FROM upload_jobs 
      WHERE status IN ('created', 'uploading', 'processing') 
      ORDER BY created_at DESC 
      LIMIT 5
    `
    const rows = result?.rows || []
    return rows.map(row => transformJobRow(row))
  }
}
  }
}