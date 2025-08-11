// composables/useConcurrencyManager.ts
import { ref, computed } from "vue";
import { useSupabaseClient } from "#imports";
import type { Database, UploadConflict } from "~/types/supabase";

interface ConcurrencyState {
  activeLocks: Map<string, { jobId: string; sessionId: string; acquiredAt: Date }>;
  conflicts: UploadConflict[];
  lockTimeout: number; // minutes
}

interface JobLockInfo {
  jobId: string;
  sessionId: string;
  isLocked: boolean;
  lockAge?: number; // minutes
  canAcquire: boolean;
}

interface ConflictResolutionOptions {
  strategy: 'keep_latest' | 'keep_original' | 'merge' | 'manual';
  jobId: string;
  autoResolve?: boolean;
}

export const useConcurrencyManager = () => {
  const supabase = useSupabaseClient<Database>();
  
  const state = ref<ConcurrencyState>({
    activeLocks: new Map(),
    conflicts: [],
    lockTimeout: 10 // 10 minutes default
  });
  
  // Generate unique session ID for this browser session
  const sessionId = ref<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  // Job locking functions
  const acquireJobLock = async (jobId: string): Promise<boolean> => {
    try {
      const { data: success, error } = await supabase.rpc('acquire_job_processing_lock', {
        job_id: jobId,
        session_id: sessionId.value
      });
      
      if (error) {
        console.error('Failed to acquire job lock:', error);
        return false;
      }
      
      if (success) {
        state.value.activeLocks.set(jobId, {
          jobId,
          sessionId: sessionId.value,
          acquiredAt: new Date()
        });
        
        console.log(`[Concurrency] Acquired lock for job ${jobId}`);
      }
      
      return success || false;
    } catch (error) {
      console.error('Error acquiring job lock:', error);
      return false;
    }
  };
  
  const releaseJobLock = async (jobId: string): Promise<boolean> => {
    try {
      const { data: success, error } = await supabase.rpc('release_job_processing_lock', {
        job_id: jobId,
        session_id: sessionId.value
      });
      
      if (error) {
        console.error('Failed to release job lock:', error);
        return false;
      }
      
      if (success) {
        state.value.activeLocks.delete(jobId);
        console.log(`[Concurrency] Released lock for job ${jobId}`);
      }
      
      return success || false;
    } catch (error) {
      console.error('Error releasing job lock:', error);
      return false;
    }
  };
  
  const checkJobLockStatus = async (jobId: string): Promise<JobLockInfo> => {
    try {
      const { data: jobData, error } = await supabase
        .from('upload_jobs')
        .select('concurrent_job_lock, lock_acquired_at, lock_holder_session')
        .eq('id', jobId)
        .single();
      
      if (error) {
        console.error('Failed to check job lock status:', error);
        return {
          jobId,
          sessionId: sessionId.value,
          isLocked: false,
          canAcquire: false
        };
      }
      
      const isLocked = jobData?.concurrent_job_lock || false;
      const lockAge = jobData?.lock_acquired_at 
        ? Math.floor((Date.now() - new Date(jobData.lock_acquired_at).getTime()) / (1000 * 60))
        : 0;
      
      const isOurLock = jobData?.lock_holder_session === sessionId.value;
      const isStale = lockAge > state.value.lockTimeout;
      const canAcquire = !isLocked || isOurLock || isStale;
      
      return {
        jobId,
        sessionId: jobData?.lock_holder_session || '',
        isLocked,
        lockAge,
        canAcquire
      };
    } catch (error) {
      console.error('Error checking job lock status:', error);
      return {
        jobId,
        sessionId: sessionId.value,
        isLocked: false,
        canAcquire: false
      };
    }
  };
  
  // Conflict management functions
  const fetchConflicts = async (jobId?: string): Promise<UploadConflict[]> => {
    try {
      let query = supabase
        .from('upload_conflicts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data: conflicts, error } = await query.limit(100);
      
      if (error) {
        console.error('Failed to fetch conflicts:', error);
        return [];
      }
      
      state.value.conflicts = conflicts || [];
      return conflicts || [];
    } catch (error) {
      console.error('Error fetching conflicts:', error);
      return [];
    }
  };
  
  const resolveConflicts = async (options: ConflictResolutionOptions): Promise<number> => {
    try {
      const { data: result, error } = await supabase.rpc('resolve_version_conflicts', {
        job_id: options.jobId,
        resolution_strategy: options.strategy
      });
      
      if (error) {
        console.error('Failed to resolve conflicts:', error);
        return 0;
      }
      
      const resolvedCount = result?.conflicts_resolved || 0;
      
      if (resolvedCount > 0) {
        console.log(`[Concurrency] Resolved ${resolvedCount} conflicts using strategy: ${options.strategy}`);
        
        // Refresh conflicts list
        await fetchConflicts(options.jobId);
      }
      
      return resolvedCount;
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      return 0;
    }
  };
  
  const getUnresolvedConflicts = computed(() => {
    return state.value.conflicts.filter(conflict => !conflict.resolved);
  });
  
  const getConflictsByType = computed(() => {
    const byType = new Map<string, UploadConflict[]>();
    
    state.value.conflicts.forEach(conflict => {
      if (!byType.has(conflict.conflict_type)) {
        byType.set(conflict.conflict_type, []);
      }
      byType.get(conflict.conflict_type)!.push(conflict);
    });
    
    return byType;
  });
  
  // Monitoring functions
  const getConcurrencyStatus = async () => {
    try {
      const { data: status, error } = await supabase
        .from('concurrency_monitoring')
        .select('*')
        .limit(20);
      
      if (error) {
        console.error('Failed to get concurrency status:', error);
        return [];
      }
      
      return status || [];
    } catch (error) {
      console.error('Error getting concurrency status:', error);
      return [];
    }
  };
  
  // Cleanup functions
  const cleanupStaleLocks = async (): Promise<string> => {
    try {
      const { data: result, error } = await supabase.rpc('cleanup_concurrency_locks');
      
      if (error) {
        console.error('Failed to cleanup stale locks:', error);
        return 'Cleanup failed';
      }
      
      console.log('[Concurrency] Cleanup completed:', result);
      return result || 'Cleanup completed';
    } catch (error) {
      console.error('Error during cleanup:', error);
      return 'Cleanup failed';
    }
  };
  
  // Atomic operation wrapper
  const executeWithLock = async <T>(
    jobId: string,
    operation: () => Promise<T>,
    options: { timeout?: number; autoRelease?: boolean } = {}
  ): Promise<{ success: boolean; result?: T; error?: string }> => {
    const { timeout = 30000, autoRelease = true } = options;
    
    // Try to acquire lock
    const lockAcquired = await acquireJobLock(jobId);
    if (!lockAcquired) {
      return {
        success: false,
        error: 'Could not acquire job lock'
      };
    }
    
    try {
      // Execute operation with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      );
      
      const result = await Promise.race([operation(), timeoutPromise]);
      
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      if (autoRelease) {
        await releaseJobLock(jobId);
      }
    }
  };
  
  // Enhanced cancellation with proper rollback
  const cancelJobWithRollback = async (
    jobId: string,
    rollbackChanges: boolean = false
  ): Promise<{ success: boolean; result?: unknown; error?: string }> => {
    try {
      const { data: result, error } = await supabase.rpc('cancel_job_with_rollback', {
        job_id: jobId,
        rollback_changes: rollbackChanges,
        session_id: sessionId.value
      });
      
      if (error) {
        return {
          success: false,
          error: error.message
        };
      }
      
      if (!result?.success) {
        return {
          success: false,
          error: result?.error || 'Cancellation failed'
        };
      }
      
      console.log('[Concurrency] Job cancelled:', result);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };
  
  // Auto-cleanup on unmount
  const cleanup = () => {
    // Release any locks held by this session
    for (const [jobId] of state.value.activeLocks) {
      releaseJobLock(jobId).catch(error => {
        console.warn(`Failed to release lock for job ${jobId}:`, error);
      });
    }
    state.value.activeLocks.clear();
  };
  
  // Periodic cleanup (call from app-level)
  const startPeriodicCleanup = (intervalMs: number = 300000) => { // 5 minutes
    const intervalId = setInterval(() => {
      cleanupStaleLocks().catch(error => {
        console.warn('Periodic cleanup failed:', error);
      });
    }, intervalMs);
    
    return () => clearInterval(intervalId);
  };
  
  return {
    // State
    sessionId: computed(() => sessionId.value),
    activeLocks: computed(() => Array.from(state.value.activeLocks.values())),
    conflicts: computed(() => state.value.conflicts),
    unresolvedConflicts: getUnresolvedConflicts,
    conflictsByType: getConflictsByType,
    
    // Lock management
    acquireJobLock,
    releaseJobLock,
    checkJobLockStatus,
    executeWithLock,
    
    // Conflict management
    fetchConflicts,
    resolveConflicts,
    
    // Job operations
    cancelJobWithRollback,
    
    // Monitoring
    getConcurrencyStatus,
    
    // Cleanup
    cleanupStaleLocks,
    cleanup,
    startPeriodicCleanup,
  };
};