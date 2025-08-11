// composables/useOptimizedRealTimeUpdates.ts
import { ref, computed, onUnmounted, readonly } from "vue";
import { useSupabaseClient } from "#imports";
import type { Database } from "~/types/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface JobUpdate {
  job_id: string;
  chunks_received?: number;
  processed_records?: number;
  status?: string;
  last_heartbeat?: string;
  performance_metrics?: unknown;
}

// Removed unused BatchedUpdate interface

interface ConnectionMetrics {
  isConnected: boolean;
  connectionCount: number;
  lastHeartbeat: number;
  reconnectAttempts: number;
  avgLatency: number;
  errorCount: number;
  messagesReceived: number;
  messagesSent: number;
}

export const useOptimizedRealTimeUpdates = () => {
  const supabase = useSupabaseClient<Database>();
  
  // Connection management
  const connections = ref<Map<string, RealtimeChannel>>(new Map());
  const connectionMetrics = ref<ConnectionMetrics>({
    isConnected: false,
    connectionCount: 0,
    lastHeartbeat: 0,
    reconnectAttempts: 0,
    avgLatency: 0,
    errorCount: 0,
    messagesReceived: 0,
    messagesSent: 0
  });

  // Batched updates system
  const pendingUpdates = ref<Map<string, JobUpdate>>(new Map());
  const batchUpdateInterval = ref<NodeJS.Timeout | null>(null);
  const BATCH_INTERVAL_MS = 2000; // Send batched updates every 2 seconds
  const MAX_BATCH_SIZE = 10; // Maximum updates per batch

  // WebSocket optimization settings
  const optimizationSettings = {
    enableBatching: true,
    enableCompression: true,
    heartbeatInterval: 30000, // 30 seconds
    reconnectDelay: 5000, // 5 seconds
    maxReconnectAttempts: 5,
    connectionPoolSize: 2 // Limit concurrent connections
  };

  // Connection pool management
  const connectionPool = {
    getConnection(jobId: string): RealtimeChannel | null {
      // Use existing connection if available
      const existingConnection = connections.value.get(jobId);
      if (existingConnection && existingConnection.state === 'joined') {
        return existingConnection;
      }

      // Check if we're at the connection limit
      if (connections.value.size >= optimizationSettings.connectionPoolSize) {
        // Reuse the least recently used connection
        const oldestConnection = Array.from(connections.value.entries())[0];
        if (oldestConnection) {
          this.releaseConnection(oldestConnection[0]);
        }
      }

      return this.createConnection(jobId);
    },

    createConnection(jobId: string): RealtimeChannel {
      const channel = supabase
        .channel(`job_${jobId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "upload_jobs",
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            connectionMetrics.value.messagesReceived++;
            handleJobUpdate(payload.new as Record<string, unknown>);
          }
        )
        .on('presence', { event: 'sync' }, () => {
          connectionMetrics.value.isConnected = true;
          connectionMetrics.value.lastHeartbeat = Date.now();
        })
        .on('presence', { event: 'join' }, () => {
          connectionMetrics.value.connectionCount++;
        })
        .on('presence', { event: 'leave' }, () => {
          connectionMetrics.value.connectionCount = Math.max(0, connectionMetrics.value.connectionCount - 1);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            connectionMetrics.value.isConnected = true;
            connectionMetrics.value.reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            connectionMetrics.value.errorCount++;
            handleConnectionError(jobId);
          }
        });

      connections.value.set(jobId, channel);
      return channel;
    },

    releaseConnection(jobId: string): void {
      const connection = connections.value.get(jobId);
      if (connection) {
        connection.unsubscribe();
        connections.value.delete(jobId);
      }
    },

    releaseAllConnections(): void {
      for (const [jobId] of connections.value) {
        this.releaseConnection(jobId);
      }
      connectionMetrics.value.connectionCount = 0;
      connectionMetrics.value.isConnected = false;
    }
  };

  // Handle job updates with batching
  const handleJobUpdate = (update: Record<string, unknown>) => {
    const jobId = update.id;
    
    if (optimizationSettings.enableBatching) {
      // Add to batch
      pendingUpdates.value.set(jobId, {
        job_id: jobId,
        chunks_received: update.chunks_received,
        processed_records: update.processed_records,
        status: update.status,
        last_heartbeat: update.last_heartbeat,
        performance_metrics: update.performance_metrics
      });

      // Trigger immediate batch if we hit the size limit
      if (pendingUpdates.value.size >= MAX_BATCH_SIZE) {
        processBatchedUpdates();
      }
    } else {
      // Process immediately
      emitJobUpdate(update);
    }
  };

  // Process batched updates
  const processBatchedUpdates = async () => {
    if (pendingUpdates.value.size === 0) return;

    const updates = Array.from(pendingUpdates.value.values());
    pendingUpdates.value.clear();

    try {
      // Use the batch update function
      const { error } = await supabase.rpc(
        "batch_update_job_progress",
        {
          updates: updates.map(update => ({
            job_id: update.job_id,
            chunks_received: update.chunks_received,
            processed_records: update.processed_records,
            status: update.status
          }))
        }
      );

      if (error) {
        console.error("Batch update failed:", error);
      } else {
        connectionMetrics.value.messagesSent += updates.length;
        console.log(`[Real-time] Batched ${updates.length} job updates`);
      }

      // Emit individual updates to listeners
      updates.forEach(update => emitJobUpdate(update));

    } catch (error) {
      console.error("Error processing batched updates:", error);
      // Fallback: process updates individually
      for (const update of updates) {
        emitJobUpdate(update);
      }
    }
  };

  // Event emitter for job updates
  const jobUpdateListeners = ref<Map<string, ((update: JobUpdate) => void)[]>>(new Map());

  const emitJobUpdate = (update: JobUpdate) => {
    const listeners = jobUpdateListeners.value.get(update.job_id) || [];
    listeners.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error("Error in job update listener:", error);
      }
    });
  };

  // Handle connection errors with exponential backoff
  const handleConnectionError = async (jobId: string) => {
    connectionMetrics.value.errorCount++;
    
    if (connectionMetrics.value.reconnectAttempts >= optimizationSettings.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for job ${jobId}`);
      return;
    }

    const delay = Math.min(
      optimizationSettings.reconnectDelay * Math.pow(2, connectionMetrics.value.reconnectAttempts),
      30000 // Max 30 seconds
    );

    connectionMetrics.value.reconnectAttempts++;
    console.log(`Reconnecting to job ${jobId} in ${delay}ms (attempt ${connectionMetrics.value.reconnectAttempts})`);

    setTimeout(() => {
      connectionPool.releaseConnection(jobId);
      connectionPool.getConnection(jobId);
    }, delay);
  };

  // Public API
  const subscribeToJob = (jobId: string, callback: (update: JobUpdate) => void) => {
    // Add listener
    const listeners = jobUpdateListeners.value.get(jobId) || [];
    listeners.push(callback);
    jobUpdateListeners.value.set(jobId, listeners);

    // Create connection if needed
    connectionPool.getConnection(jobId);
    
    return () => {
      // Remove listener
      const currentListeners = jobUpdateListeners.value.get(jobId) || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
        jobUpdateListeners.value.set(jobId, currentListeners);
      }

      // Release connection if no more listeners
      if (currentListeners.length === 0) {
        connectionPool.releaseConnection(jobId);
      }
    };
  };

  const subscribeToMultipleJobs = (jobIds: string[], callback: (jobId: string, update: JobUpdate) => void) => {
    const unsubscribeFunctions = jobIds.map(jobId => 
      subscribeToJob(jobId, (update) => callback(jobId, update))
    );

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  };

  // Start batch processing
  const startBatchProcessing = () => {
    if (batchUpdateInterval.value) return; // Already running

    batchUpdateInterval.value = setInterval(() => {
      processBatchedUpdates();
    }, BATCH_INTERVAL_MS);

    console.log(`[Real-time] Started batched update processing (${BATCH_INTERVAL_MS}ms interval)`);
  };

  const stopBatchProcessing = () => {
    if (batchUpdateInterval.value) {
      clearInterval(batchUpdateInterval.value);
      batchUpdateInterval.value = null;
    }
    
    // Process any remaining updates
    processBatchedUpdates();
  };

  // Connection health monitoring
  const isHealthy = computed(() => {
    return (
      connectionMetrics.value.isConnected &&
      connectionMetrics.value.errorCount < 5 &&
      (Date.now() - connectionMetrics.value.lastHeartbeat) < 60000 // 1 minute
    );
  });

  // Cleanup on unmount
  onUnmounted(() => {
    stopBatchProcessing();
    connectionPool.releaseAllConnections();
  });

  // Initialize
  if (optimizationSettings.enableBatching) {
    startBatchProcessing();
  }

  return {
    subscribeToJob,
    subscribeToMultipleJobs,
    connectionMetrics: readonly(connectionMetrics),
    isHealthy,
    startBatchProcessing,
    stopBatchProcessing,
    optimizationSettings,
    
    // Debug/monitoring methods
    getConnectionCount: () => connections.value.size,
    getPendingUpdatesCount: () => pendingUpdates.value.size,
    forceProcessBatch: processBatchedUpdates,
    releaseAllConnections: () => connectionPool.releaseAllConnections()
  };
};