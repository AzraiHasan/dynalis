export interface Site {
  id: string;
  site_id: string;
  exp_date: string | null;
  total_rental: number;
  total_payment_to_pay: number;
  deposit: number;
  created_at: string;
  updated_at: string;
  cancelled_upload?: boolean;
  version?: number;
  last_updated_by_job?: string;
  concurrent_lock?: boolean;
  lock_acquired_at?: string | null;
}

export interface UploadJob {
  id: string;
  filename: string;
  status: 'created' | 'uploading' | 'processing' | 'queued' | 'complete' | 'cancelled' | 'error';
  total_chunks: number;
  chunks_received: number;
  processed_records: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  error_message?: string | null;
  priority?: number;
  estimated_size?: number;
  max_concurrent_jobs?: number;
  retry_count?: number;
  max_retries?: number;
  processing_started_at?: string | null;
  last_heartbeat?: string | null;
  timeout_seconds?: number;
  performance_metrics?: Record<string, unknown>;
  batch_processing_time_ms?: number[];
  memory_usage_mb?: number[];
  lock_version?: number;
  concurrent_job_lock?: boolean;
  lock_acquired_at?: string | null;
  lock_holder_session?: string | null;
}

export interface UploadConflict {
  id: string;
  job_id: string;
  site_id: string;
  conflict_type: 'duplicate_site_id' | 'concurrent_update' | 'version_mismatch';
  original_data?: Record<string, unknown> | null;
  conflicting_data?: Record<string, unknown> | null;
  resolution_strategy?: 'keep_latest' | 'keep_original' | 'merge' | 'manual' | null;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
}

export interface UploadJobRecord {
  id: string;
  job_id: string;
  site_id: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site;
        Insert: Omit<Site, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Site, 'id'>> & { updated_at?: string };
      };
      upload_jobs: {
        Row: UploadJob;
        Insert: Omit<UploadJob, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UploadJob, 'id'>> & { updated_at?: string };
      };
      upload_conflicts: {
        Row: UploadConflict;
        Insert: Omit<UploadConflict, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<UploadConflict, 'id' | 'created_at'>>;
      };
      upload_job_records: {
        Row: UploadJobRecord;
        Insert: Omit<UploadJobRecord, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<UploadJobRecord, 'id' | 'created_at'>>;
      };
    };
    Views: {
      concurrency_monitoring: {
        Row: {
          job_id: string;
          filename: string;
          status: string;
          concurrent_job_lock?: boolean;
          lock_acquired_at?: string | null;
          lock_holder_session?: string | null;
          lock_version?: number;
          total_conflicts?: number;
          unresolved_conflicts?: number;
          affected_sites?: number;
          locked_sites?: number;
          created_at: string;
          updated_at: string;
        };
      };
      job_queue_status: {
        Row: {
          id: string;
          filename: string;
          status: string;
          priority?: number;
          estimated_size?: number;
          total_chunks: number;
          chunks_received: number;
          processed_records: number;
          retry_count?: number;
          max_retries?: number;
          created_at: string;
          processing_started_at?: string | null;
          last_heartbeat?: string | null;
          completed_at?: string | null;
          seconds_since_heartbeat?: number | null;
          processing_duration_seconds?: number | null;
          progress_percentage?: number;
        };
      };
    };
  };
}