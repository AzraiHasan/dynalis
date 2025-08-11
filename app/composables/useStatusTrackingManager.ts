// composables/useStatusTrackingManager.ts
import { ref, computed } from "vue";
import { useSupabaseClient } from "#imports";
import type { Database } from "~/types/supabase";

interface JobStatusUpdate {
  jobId: string;
  status: string;
  chunksReceived?: number;
  processedRecords?: number;
  error?: string | null;
  timestamp: number;
  version?: number; // For optimistic locking
  sequenceNumber: number; // For ordering updates
}

interface StatusConsistencyState {
  jobStatuses: Map<string, JobStatusUpdate>;
  pendingUpdates: Map<string, JobStatusUpdate[]>;
  consistencyChecks: Map<string, { lastCheck: number; failures: number }>;
  sequenceCounter: number;
  conflictResolutions: number;
}


export const useStatusTrackingManager = () => {
  const supabase = useSupabaseClient<Database>();
  
  const state = ref<StatusConsistencyState>({
    jobStatuses: new Map(),
    pendingUpdates: new Map(),
    consistencyChecks: new Map(),
    sequenceCounter: 0,
    conflictResolutions: 0
  });

  // Valid status transitions matrix
  const validTransitions: Record<string, string[]> = {
    'created': ['queued', 'cancelled', 'error'],
    'queued': ['processing', 'cancelled', 'error'],
    'processing': ['complete', 'error', 'cancelled'],
    'complete': [], // Terminal state
    'error': ['queued'], // Can retry
    'cancelled': [] // Terminal state
  };

  const isValidTransition = (from: string, to: string): boolean => {
    return validTransitions[from]?.includes(to) || false;
  };

  const requiresLock = (transition: string): boolean => {
    // Transitions that require exclusive access
    return ['processing', 'cancelled', 'complete'].includes(transition);
  };

  // Generate next sequence number for ordering
  const getNextSequenceNumber = (): number => {
    return ++state.value.sequenceCounter;
  };

  // Atomic status update with version checking
  const updateJobStatusAtomic = async (
    jobId: string, 
    newStatus: string,
    additionalData: Partial<JobStatusUpdate> = {}
  ): Promise<{ success: boolean; error?: string; currentVersion?: number }> => {
    try {
      // Get current job state with version
      const { data: currentJob, error: fetchError } = await supabase
        .from('upload_jobs')
        .select('id, status, lock_version, concurrent_job_lock, lock_holder_session')
        .eq('id', jobId)
        .single();

      if (fetchError) {
        return { success: false, error: `Failed to fetch job: ${fetchError.message}` };
      }

      if (!currentJob) {
        return { success: false, error: 'Job not found' };
      }

      const currentStatus = currentJob.status;
      const currentVersion = currentJob.lock_version || 0;

      // Validate transition
      if (!isValidTransition(currentStatus, newStatus)) {
        console.warn(`[Status] Invalid transition: ${currentStatus} -> ${newStatus} for job ${jobId}`);
        
        // Check for race condition - maybe another process updated it
        await reconcileJobStatus(jobId);
        
        return { 
          success: false, 
          error: `Invalid status transition: ${currentStatus} -> ${newStatus}`,
          currentVersion
        };
      }

      // Check if we need a lock for this operation
      if (requiresLock(newStatus) && currentJob.concurrent_job_lock) {
        return { 
          success: false, 
          error: 'Job is locked by another process',
          currentVersion
        };
      }

      // Prepare update data with optimistic locking
      const updateData = {
        status: newStatus,
        lock_version: currentVersion + 1,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      // Atomic update with version check
      const { data: updatedJob, error: updateError } = await supabase
        .from('upload_jobs')
        .update(updateData)
        .eq('id', jobId)
        .eq('lock_version', currentVersion) // Optimistic locking
        .select('id, status, lock_version')
        .single();

      if (updateError) {
        // Check if it's a version conflict
        if (updateError.message.includes('lock_version')) {
          console.warn(`[Status] Version conflict for job ${jobId}, reconciling...`);
          await reconcileJobStatus(jobId);
          return { 
            success: false, 
            error: 'Version conflict, status was updated by another process',
            currentVersion
          };
        }
        return { success: false, error: updateError.message };
      }

      if (!updatedJob) {
        // No rows updated - version conflict
        console.warn(`[Status] Optimistic lock failed for job ${jobId}`);
        await reconcileJobStatus(jobId);
        return { 
          success: false, 
          error: 'Optimistic lock failure - concurrent update detected',
          currentVersion
        };
      }

      // Update local state
      const statusUpdate: JobStatusUpdate = {
        jobId,
        status: newStatus,
        timestamp: Date.now(),
        sequenceNumber: getNextSequenceNumber(),
        version: updatedJob.lock_version,
        ...additionalData
      };
      
      state.value.jobStatuses.set(jobId, statusUpdate);

      console.log(`[Status] Successfully updated job ${jobId}: ${currentStatus} -> ${newStatus} (v${updatedJob.lock_version})`);
      
      return { 
        success: true, 
        currentVersion: updatedJob.lock_version 
      };

    } catch (error) {
      console.error(`[Status] Error updating job ${jobId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Reconcile job status when conflicts are detected
  const reconcileJobStatus = async (jobId: string): Promise<void> => {
    try {
      const { data: currentJob, error } = await supabase
        .from('upload_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !currentJob) {
        console.error(`[Status] Failed to reconcile job ${jobId}:`, error);
        return;
      }

      // Update local state with authoritative server state
      const statusUpdate: JobStatusUpdate = {
        jobId,
        status: currentJob.status,
        chunksReceived: currentJob.chunks_received,
        processedRecords: currentJob.processed_records,
        timestamp: Date.now(),
        sequenceNumber: getNextSequenceNumber(),
        version: currentJob.lock_version
      };

      state.value.jobStatuses.set(jobId, statusUpdate);
      
      // Clear any pending updates for this job
      state.value.pendingUpdates.delete(jobId);
      
      console.log(`[Status] Reconciled job ${jobId} status to: ${currentJob.status}`);
    } catch (error) {
      console.error(`[Status] Error reconciling job ${jobId}:`, error);
    }
  };

  // Queue status update for batch processing (with conflict detection)
  const queueStatusUpdate = (update: JobStatusUpdate): void => {
    const existingUpdate = state.value.jobStatuses.get(update.jobId);
    
    // Check for out-of-order updates
    if (existingUpdate && update.sequenceNumber <= existingUpdate.sequenceNumber) {
      console.warn(`[Status] Ignoring out-of-order update for job ${update.jobId}`);
      return;
    }

    // Validate the transition before queuing
    if (existingUpdate && !isValidTransition(existingUpdate.status, update.status)) {
      console.warn(`[Status] Queued invalid transition: ${existingUpdate.status} -> ${update.status}`);
      
      // Schedule reconciliation
      setTimeout(() => reconcileJobStatus(update.jobId), 1000);
      return;
    }

    const pending = state.value.pendingUpdates.get(update.jobId) || [];
    pending.push(update);
    state.value.pendingUpdates.set(update.jobId, pending);
  };

  // Process pending updates in order
  const processPendingUpdates = async (): Promise<void> => {
    const updatePromises: Promise<void>[] = [];

    for (const [jobId, updates] of state.value.pendingUpdates.entries()) {
      if (updates.length === 0) continue;

      // Sort by sequence number to ensure proper ordering
      updates.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      updatePromises.push(
        (async () => {
          for (const update of updates) {
            const result = await updateJobStatusAtomic(
              update.jobId, 
              update.status, 
              {
                chunksReceived: update.chunksReceived,
                processedRecords: update.processedRecords,
                error: update.error
              }
            );

            if (!result.success) {
              console.warn(`[Status] Failed to process pending update for job ${jobId}:`, result.error);
              
              // If it's a conflict, don't retry the rest
              if (result.error?.includes('conflict') || result.error?.includes('lock')) {
                break;
              }
            }
          }
          
          // Clear processed updates
          state.value.pendingUpdates.set(jobId, []);
        })()
      );
    }

    await Promise.allSettled(updatePromises);
  };

  // Consistency check for job statuses
  const performConsistencyCheck = async (jobId: string): Promise<boolean> => {
    try {
      const now = Date.now();
      const checkInfo = state.value.consistencyChecks.get(jobId);
      
      // Rate limit consistency checks (max once per 30 seconds)
      if (checkInfo && (now - checkInfo.lastCheck) < 30000) {
        return true;
      }

      const localStatus = state.value.jobStatuses.get(jobId);
      if (!localStatus) {
        return true; // No local state to check
      }

      // Fetch authoritative status from database
      const { data: serverJob, error } = await supabase
        .from('upload_jobs')
        .select('id, status, chunks_received, processed_records, lock_version')
        .eq('id', jobId)
        .single();

      if (error || !serverJob) {
        console.error(`[Status] Consistency check failed for job ${jobId}:`, error);
        
        state.value.consistencyChecks.set(jobId, {
          lastCheck: now,
          failures: (checkInfo?.failures || 0) + 1
        });
        return false;
      }

      // Compare local and server state
      const isConsistent = (
        localStatus.status === serverJob.status &&
        localStatus.chunksReceived === serverJob.chunks_received &&
        localStatus.processedRecords === serverJob.processed_records &&
        localStatus.version === serverJob.lock_version
      );

      if (!isConsistent) {
        console.warn(`[Status] Consistency mismatch for job ${jobId}:`, {
          local: localStatus,
          server: serverJob
        });
        
        // Update local state to match server
        await reconcileJobStatus(jobId);
        state.value.conflictResolutions++;
        
        state.value.consistencyChecks.set(jobId, {
          lastCheck: now,
          failures: (checkInfo?.failures || 0) + 1
        });
        return false;
      }

      // Update check timestamp on success
      state.value.consistencyChecks.set(jobId, {
        lastCheck: now,
        failures: 0
      });
      return true;
    } catch (error) {
      console.error(`[Status] Error during consistency check for job ${jobId}:`, error);
      return false;
    }
  };

  // Batch update with conflict resolution
  const batchUpdateStatuses = async (
    updates: Array<{ jobId: string; status: string; data?: Record<string, unknown> }>
  ): Promise<{ success: number; failures: number; conflicts: number }> => {
    let successCount = 0;
    let failureCount = 0;
    let conflictCount = 0;

    // Group updates by job to handle them sequentially per job
    const updatesByJob = new Map<string, typeof updates>();
    updates.forEach(update => {
      const jobUpdates = updatesByJob.get(update.jobId) || [];
      jobUpdates.push(update);
      updatesByJob.set(update.jobId, jobUpdates);
    });

    // Process each job's updates sequentially
    for (const [_jobId, jobUpdates] of updatesByJob.entries()) {
      for (const update of jobUpdates) {
        const result = await updateJobStatusAtomic(update.jobId, update.status, update.data);
        
        if (result.success) {
          successCount++;
        } else if (result.error?.includes('conflict') || result.error?.includes('lock')) {
          conflictCount++;
        } else {
          failureCount++;
        }
      }
    }

    return { success: successCount, failures: failureCount, conflicts: conflictCount };
  };

  // Monitor for status drift and auto-correct
  const startStatusMonitoring = (intervalMs: number = 60000): (() => void) => {
    const monitoringInterval = setInterval(async () => {
      // Check all tracked jobs for consistency
      const consistencyPromises = Array.from(state.value.jobStatuses.keys()).map(jobId => 
        performConsistencyCheck(jobId)
      );

      await Promise.allSettled(consistencyPromises);
      
      // Process any pending updates
      await processPendingUpdates();
    }, intervalMs);

    return () => clearInterval(monitoringInterval);
  };

  // Enhanced status update with retry logic
  const updateJobStatusWithRetry = async (
    jobId: string,
    newStatus: string,
    additionalData: Partial<JobStatusUpdate> = {},
    maxRetries: number = 3
  ): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await updateJobStatusAtomic(jobId, newStatus, additionalData);
      
      if (result.success) {
        return true;
      }

      // If it's a conflict or lock issue, wait and retry
      if (result.error?.includes('conflict') || result.error?.includes('lock')) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
        console.log(`[Status] Retrying status update for job ${jobId} in ${delay}ms (attempt ${attempt})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For other errors, don't retry
      console.error(`[Status] Non-retryable error updating job ${jobId}:`, result.error);
      break;
    }

    return false;
  };

  // Get status statistics
  const getStatusStatistics = computed(() => {
    const stats = {
      totalJobs: state.value.jobStatuses.size,
      statusCounts: new Map<string, number>(),
      conflictResolutions: state.value.conflictResolutions,
      pendingUpdates: Array.from(state.value.pendingUpdates.values()).reduce((sum, updates) => sum + updates.length, 0),
      consistencyFailures: Array.from(state.value.consistencyChecks.values()).reduce((sum, check) => sum + check.failures, 0)
    };

    // Count by status
    for (const status of state.value.jobStatuses.values()) {
      stats.statusCounts.set(status.status, (stats.statusCounts.get(status.status) || 0) + 1);
    }

    return stats;
  });

  return {
    // State
    jobStatuses: computed(() => Array.from(state.value.jobStatuses.values())),
    statusStatistics: getStatusStatistics,
    
    // Core operations
    updateJobStatusAtomic,
    updateJobStatusWithRetry,
    batchUpdateStatuses,
    queueStatusUpdate,
    
    // Consistency management
    reconcileJobStatus,
    performConsistencyCheck,
    processPendingUpdates,
    
    // Monitoring
    startStatusMonitoring,
    
    // Utilities
    isValidTransition,
    getNextSequenceNumber,
    
    // Debug methods
    getJobStatus: (jobId: string) => state.value.jobStatuses.get(jobId),
    getPendingUpdates: (jobId: string) => state.value.pendingUpdates.get(jobId) || [],
    clearJobState: (jobId: string) => {
      state.value.jobStatuses.delete(jobId);
      state.value.pendingUpdates.delete(jobId);
      state.value.consistencyChecks.delete(jobId);
    }
  };
};