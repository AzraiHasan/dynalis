<!-- pages/upload-jobs.vue -->
<script setup lang="ts">
import { useBatchUploadService } from '~/composables/useBatchUploadService'
import { useOptimizedRealTimeUpdates } from '~/composables/useOptimizedRealTimeUpdates'
import type { Database } from '~/types/supabase'

// definePageMeta({
//   middleware: 'auth'
// });

const supabase = useSupabaseClient<Database>()
const batchUploadService = useBatchUploadService()
const realTimeUpdates = useOptimizedRealTimeUpdates()
const toast = useToast()

interface Job {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  recordsProcessed: number;
  totalRecords: number;
  startedAt: Date;
  completedAt: Date | null;
  errors: number;
  retryCount?: number;
  maxRetries?: number;
  priority?: number;
  errorMessage?: string | null;
  processingDuration?: number | null;
  secondsSinceHeartbeat?: number | null;
}

const jobs = ref<Job[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

type JobStatus = 'completed' | 'processing' | 'failed' | 'cancelled' | 'pending' | 'created' | 'queued' | 'error';

type UIColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';

const statusColors = {
  'completed': 'success',
  'complete': 'success',
  'processing': 'info', 
  'failed': 'error',
  'error': 'error',
  'cancelled': 'neutral',
  'pending': 'warning',
  'created': 'warning',
  'queued': 'warning'
} as const;

const statusTextColors: Record<string, string> = {
  'completed': 'text-green-500',
  'complete': 'text-green-500',
  'processing': 'text-blue-500',
  'failed': 'text-red-500',
  'error': 'text-red-500',
  'cancelled': 'text-gray-500',
  'pending': 'text-yellow-500',
  'created': 'text-yellow-500',
  'queued': 'text-yellow-500'
};

const statusIcons: Record<string, string> = {
  'completed': 'i-lucide-check-circle',
  'complete': 'i-lucide-check-circle',
  'processing': 'i-lucide-loader-2',
  'failed': 'i-lucide-x-circle',
  'error': 'i-lucide-x-circle',
  'cancelled': 'i-lucide-stop-circle',
  'pending': 'i-lucide-clock',
  'created': 'i-lucide-clock',
  'queued': 'i-lucide-clock'
};

function getStatusColor(status: string): UIColor {
  return (statusColors as any)[status] || 'neutral';
}

// Fetch jobs from database
async function fetchJobs() {
  try {
    isLoading.value = true
    error.value = null

    const { data, error: fetchError } = await supabase
      .from('job_queue_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (fetchError) throw fetchError

    jobs.value = (data || []).map(job => ({
      id: job.id,
      name: job.filename,
      status: job.status as JobStatus,
      progress: job.progress_percentage || 0,
      recordsProcessed: job.processed_records || 0,
      totalRecords: job.total_chunks || 0,
      startedAt: new Date(job.created_at),
      completedAt: job.completed_at ? new Date(job.completed_at) : null,
      errors: 0, // TODO: Calculate from error_message or separate errors table
      retryCount: job.retry_count || 0,
      maxRetries: job.max_retries || 3,
      priority: job.priority,
      errorMessage: null, // Job queue status view doesn't include error_message
      processingDuration: job.processing_duration_seconds,
      secondsSinceHeartbeat: job.seconds_since_heartbeat
    }))

  } catch (err) {
    console.error('Error fetching jobs:', err)
    error.value = err instanceof Error ? err.message : 'Failed to fetch jobs'
    toast.add({
      title: 'Error',
      description: 'Failed to fetch upload jobs',
      color: 'error'
    })
  } finally {
    isLoading.value = false
  }
}

function formatDuration(start: Date, end?: Date | null) {
  if (import.meta.server) {
    return 'Calculating...'
  }
  
  const endTime = end || new Date();
  const diffMs = endTime.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s`;
  }
  return `${diffSecs}s`;
}

// Cancel a job
async function cancelJob(jobId: string) {
  try {
    const job = jobs.value.find(j => j.id === jobId)
    if (!job) return

    // Set the job ID in the batch upload service state
    if (batchUploadService.state.value) {
      batchUploadService.state.value.uploadJobId = jobId
    }

    // Use the cancelUpload function from the batch upload service
    await batchUploadService.cancelUpload(true) // rollback changes

    toast.add({
      title: 'Job Cancelled',
      description: `Upload job "${job.name}" has been cancelled successfully`,
      color: 'info'
    })

    // Refresh the jobs list
    await fetchJobs()

  } catch (err) {
    console.error('Error cancelling job:', err)
    toast.add({
      title: 'Cancellation Failed',
      description: err instanceof Error ? err.message : 'Failed to cancel job',
      color: 'error'
    })
  }
}

// Retry a failed job
async function retryJob(jobId: string) {
  try {
    const job = jobs.value.find(j => j.id === jobId)
    if (!job) return

    // Update job status to queued for retry
    const { error: retryError } = await supabase
      .from('upload_jobs')
      .update({ 
        status: 'queued',
        retry_count: (job.retryCount || 0) + 1,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (retryError) throw retryError

    toast.add({
      title: 'Job Queued for Retry',
      description: `Upload job "${job.name}" has been queued for retry`,
      color: 'success'
    })

    // Refresh the jobs list
    await fetchJobs()

  } catch (err) {
    console.error('Error retrying job:', err)
    toast.add({
      title: 'Retry Failed',
      description: err instanceof Error ? err.message : 'Failed to retry job',
      color: 'error'
    })
  }
}

// Job details modal state
const showJobDetails = ref(false)
const selectedJob = ref<Job | null>(null)
const jobDetails = ref<any>(null)

// View job details
async function viewJobDetails(jobId: string) {
  try {
    const job = jobs.value.find(j => j.id === jobId)
    if (!job) return

    selectedJob.value = job

    // Fetch full job details including error message and performance metrics
    const { data, error: detailError } = await supabase
      .from('upload_jobs')
      .select(`
        *,
        upload_conflicts (
          id,
          conflict_type,
          original_data,
          conflicting_data,
          resolved,
          resolved_at
        )
      `)
      .eq('id', jobId)
      .single()

    if (detailError) throw detailError

    jobDetails.value = data
    showJobDetails.value = true

  } catch (err) {
    console.error('Error fetching job details:', err)
    toast.add({
      title: 'Error',
      description: 'Failed to fetch job details',
      color: 'error'
    })
  }
}

// Set up real-time updates and fetch data on mount
onMounted(async () => {
  await fetchJobs()
  
  // Subscribe to real-time updates for upload_jobs table
  const jobsChannel = supabase
    .channel('upload_jobs_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'upload_jobs' },
      (payload) => {
        console.log('Real-time update:', payload)
        // Refresh jobs list when any job changes
        fetchJobs()
      }
    )
    .subscribe()

  // Cleanup subscription on unmount
  onUnmounted(() => {
    jobsChannel.unsubscribe()
  })
})

// Auto-refresh every 30 seconds
const refreshInterval = setInterval(() => {
  if (!isLoading.value) {
    fetchJobs()
  }
}, 30000)

onUnmounted(() => {
  clearInterval(refreshInterval)
})

// Manual refresh function
async function refreshJobs() {
  await fetchJobs()
}

// Computed job statistics
const jobStats = computed(() => {
  const total = jobs.value.length
  const completed = jobs.value.filter(job => job.status === 'completed' || job.status === 'complete').length
  const processing = jobs.value.filter(job => job.status === 'processing').length
  const failed = jobs.value.filter(job => job.status === 'failed' || job.status === 'error').length
  
  return { total, completed, processing, failed }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Upload Jobs</h1>
        <p class="text-gray-600 mt-1">Monitor and manage your data upload jobs</p>
      </div>
      <UButton 
        icon="i-lucide-refresh-cw"
        variant="outline"
        :loading="isLoading"
        @click="refreshJobs"
      >
        Refresh
      </UButton>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && jobs.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
      <p class="text-gray-600">Loading upload jobs...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon name="i-lucide-alert-circle" class="w-8 h-8 text-red-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">Error Loading Jobs</h3>
      <p class="text-gray-600 mb-4">{{ error }}</p>
      <UButton @click="refreshJobs" :loading="isLoading">Try Again</UButton>
    </div>

    <template v-else>
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <UCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Total Jobs</p>
              <p class="text-2xl font-bold text-gray-900">{{ jobStats.total }}</p>
            </div>
            <UIcon name="i-lucide-database" class="w-8 h-8 text-gray-400" />
          </div>
        </UCard>
        
        <UCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Completed</p>
              <p class="text-2xl font-bold text-green-600">{{ jobStats.completed }}</p>
            </div>
            <UIcon name="i-lucide-check-circle" class="w-8 h-8 text-green-400" />
          </div>
        </UCard>
        
        <UCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Processing</p>
              <p class="text-2xl font-bold text-blue-600">{{ jobStats.processing }}</p>
            </div>
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        </UCard>
        
        <UCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">Failed</p>
              <p class="text-2xl font-bold text-red-600">{{ jobStats.failed }}</p>
            </div>
            <UIcon name="i-lucide-x-circle" class="w-8 h-8 text-red-400" />
          </div>
        </UCard>
      </div>

    <!-- Jobs Table -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-gray-900">Recent Jobs</h2>
      </template>
      
      <div class="space-y-4">
        <div 
          v-for="job in jobs"
          :key="job.id"
          class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-3">
              <UIcon 
                :name="statusIcons[job.status]" 
                :class="[
                  'w-5 h-5',
                  job.status === 'processing' ? 'animate-spin' : '',
                  statusTextColors[job.status]
                ]"
              />
              <div>
                <h3 class="font-medium text-gray-900">{{ job.name }}</h3>
                <p class="text-sm text-gray-500">
                  Started {{ formatDuration(job.startedAt, job.completedAt || new Date()) }} ago
                </p>
              </div>
            </div>
            
            <div class="flex items-center space-x-2">
              <UBadge 
                :color="getStatusColor(job.status as JobStatus)" 
                variant="subtle"
                class="capitalize"
              >
                {{ job.status }}
              </UBadge>
              
              <UDropdownMenu
:items="[
                [{
                  label: 'View Details',
                  icon: 'i-lucide-eye',
                  onSelect: () => viewJobDetails(job.id)
                }],
                job.status === 'processing' ? [{
                  label: 'Cancel Job',
                  icon: 'i-lucide-stop-circle',
                  onSelect: () => cancelJob(job.id)
                }] : [],
                job.status === 'failed' ? [{
                  label: 'Retry Job',
                  icon: 'i-lucide-refresh-cw',
                  onSelect: () => retryJob(job.id)
                }] : []
              ]">
                <UButton
                  icon="i-lucide-more-horizontal"
                  variant="ghost"
                  size="sm"
                />
              </UDropdownMenu>
            </div>
          </div>
          
          <!-- Progress Bar -->
          <div class="mb-3">
            <div class="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{{ job.recordsProcessed }}/{{ job.totalRecords }} records</span>
            </div>
            <UProgress 
              :value="job.progress" 
              :color="getStatusColor(job.status as JobStatus)"
              size="sm"
            />
          </div>
          
          <!-- Job Stats -->
          <div class="flex items-center justify-between text-sm text-gray-600">
            <div class="flex items-center space-x-4">
              <span>{{ job.progress }}% complete</span>
              <span v-if="job.errors > 0" class="text-red-600">
                {{ job.errors }} errors
              </span>
            </div>
            <div v-if="job.completedAt">
              Completed {{ formatDuration(job.startedAt, job.completedAt) }}
            </div>
          </div>
        </div>
        
        <!-- Empty State -->
        <div v-if="jobs.length === 0" class="text-center py-12">
          <UIcon name="i-lucide-inbox" class="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 class="text-lg font-medium text-gray-900 mb-2">No upload jobs yet</h3>
          <p class="text-gray-500 mb-4">Start by uploading some data files</p>
          <UButton 
            to="/dataupload"
            icon="i-lucide-upload"
          >
            Upload Data
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Job Details Modal -->
    <UModal v-model="showJobDetails">
      <UCard v-if="selectedJob && jobDetails">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Job Details: {{ selectedJob.name }}</h3>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="sm"
              @click="showJobDetails = false"
            />
          </div>
        </template>

        <div class="space-y-6">
          <!-- Job Overview -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-600">Status</p>
              <UBadge :color="getStatusColor(selectedJob.status)" variant="subtle" class="capitalize">
                {{ selectedJob.status }}
              </UBadge>
            </div>
            <div>
              <p class="text-sm text-gray-600">Progress</p>
              <p class="font-semibold">{{ selectedJob.progress }}%</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Records Processed</p>
              <p class="font-semibold">{{ selectedJob.recordsProcessed }} / {{ selectedJob.totalRecords }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Priority</p>
              <p class="font-semibold">{{ selectedJob.priority || 5 }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Retry Count</p>
              <p class="font-semibold">{{ selectedJob.retryCount || 0 }} / {{ selectedJob.maxRetries || 3 }}</p>
            </div>
            <div v-if="selectedJob.processingDuration">
              <p class="text-sm text-gray-600">Processing Duration</p>
              <p class="font-semibold">{{ Math.floor(selectedJob.processingDuration / 60) }}m {{ selectedJob.processingDuration % 60 }}s</p>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="jobDetails.error_message" class="p-4 bg-red-50 rounded-lg">
            <p class="text-sm text-gray-600 mb-2">Error Message</p>
            <p class="text-red-700 font-mono text-sm">{{ jobDetails.error_message }}</p>
          </div>

          <!-- Performance Metrics -->
          <div v-if="jobDetails.performance_metrics" class="p-4 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-600 mb-2">Performance Metrics</p>
            <pre class="text-xs text-gray-700 font-mono overflow-x-auto">{{ JSON.stringify(jobDetails.performance_metrics, null, 2) }}</pre>
          </div>

          <!-- Memory Usage Chart -->
          <div v-if="jobDetails.memory_usage_mb && jobDetails.memory_usage_mb.length > 0" class="space-y-2">
            <p class="text-sm text-gray-600">Memory Usage (MB)</p>
            <div class="p-4 bg-gray-50 rounded-lg">
              <p class="text-xs text-gray-600">Peak: {{ Math.max(...jobDetails.memory_usage_mb) }}MB</p>
              <p class="text-xs text-gray-600">Average: {{ Math.round(jobDetails.memory_usage_mb.reduce((a: number, b: number) => a + b, 0) / jobDetails.memory_usage_mb.length) }}MB</p>
            </div>
          </div>

          <!-- Conflicts -->
          <div v-if="jobDetails.upload_conflicts && jobDetails.upload_conflicts.length > 0" class="space-y-2">
            <p class="text-sm text-gray-600">Upload Conflicts ({{ jobDetails.upload_conflicts.length }})</p>
            <div class="max-h-48 overflow-y-auto space-y-2">
              <div 
                v-for="conflict in jobDetails.upload_conflicts" 
                :key="conflict.id"
                class="p-3 border rounded-lg text-sm"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium">{{ conflict.conflict_type.replace('_', ' ') }}</span>
                  <UBadge :color="conflict.resolved ? 'success' : 'warning'" variant="subtle">
                    {{ conflict.resolved ? 'Resolved' : 'Pending' }}
                  </UBadge>
                </div>
                <p class="text-gray-600">Site ID: {{ conflict.original_data?.site_id || 'Unknown' }}</p>
                <p v-if="conflict.resolved_at" class="text-xs text-gray-500">
                  Resolved at: {{ new Date(conflict.resolved_at).toLocaleString() }}
                </p>
              </div>
            </div>
          </div>

          <!-- Timestamps -->
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-600">Created</p>
              <p class="font-semibold">{{ selectedJob.startedAt.toLocaleString() }}</p>
            </div>
            <div v-if="selectedJob.completedAt">
              <p class="text-gray-600">Completed</p>
              <p class="font-semibold">{{ selectedJob.completedAt.toLocaleString() }}</p>
            </div>
            <div v-if="jobDetails.processing_started_at">
              <p class="text-gray-600">Processing Started</p>
              <p class="font-semibold">{{ new Date(jobDetails.processing_started_at).toLocaleString() }}</p>
            </div>
            <div v-if="jobDetails.last_heartbeat">
              <p class="text-gray-600">Last Heartbeat</p>
              <p class="font-semibold">{{ new Date(jobDetails.last_heartbeat).toLocaleString() }}</p>
              <p v-if="selectedJob.secondsSinceHeartbeat" class="text-xs text-gray-500">
                {{ selectedJob.secondsSinceHeartbeat }}s ago
              </p>
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
    </template>
  </div>
</template>