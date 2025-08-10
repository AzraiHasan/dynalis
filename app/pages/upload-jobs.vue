<!-- pages/upload-jobs.vue -->
<script setup lang="ts">
// definePageMeta({
//   middleware: 'auth'
// });

// TODO: Import job monitoring composables when available
// import { useJobMonitoring } from '~/composables/useJobMonitoring'

const mockJobs = ref([
  {
    id: '1',
    name: 'Sites Data Q1 2024.csv',
    status: 'completed',
    progress: 100,
    recordsProcessed: 1250,
    totalRecords: 1250,
    startedAt: new Date('2024-01-15T10:30:00'),
    completedAt: new Date('2024-01-15T10:45:00'),
    errors: 0
  },
  {
    id: '2',
    name: 'Sites Data Q2 2024.xlsx',
    status: 'processing',
    progress: 67,
    recordsProcessed: 834,
    totalRecords: 1245,
    startedAt: new Date('2024-01-15T11:00:00'),
    completedAt: null,
    errors: 2
  },
  {
    id: '3',
    name: 'Sites Data Q3 2024.csv',
    status: 'failed',
    progress: 23,
    recordsProcessed: 289,
    totalRecords: 1456,
    startedAt: new Date('2024-01-15T09:15:00'),
    completedAt: null,
    errors: 45
  }
]);

const statusColors = {
  'completed': 'green',
  'processing': 'blue',
  'failed': 'red',
  'cancelled': 'gray',
  'pending': 'yellow'
};

const statusIcons = {
  'completed': 'i-lucide-check-circle',
  'processing': 'i-lucide-loader-2',
  'failed': 'i-lucide-x-circle',
  'cancelled': 'i-lucide-stop-circle',
  'pending': 'i-lucide-clock'
};

function formatDuration(start: Date, end?: Date | null) {
  if (process.server) {
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

function cancelJob(jobId: string) {
  // TODO: Implement job cancellation
  console.log('Cancelling job:', jobId);
}

function retryJob(jobId: string) {
  // TODO: Implement job retry
  console.log('Retrying job:', jobId);
}

function viewJobDetails(jobId: string) {
  // TODO: Navigate to job details or show modal
  console.log('Viewing job details:', jobId);
}
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
        @click="$router.go(0)"
      >
        Refresh
      </UButton>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">Total Jobs</p>
            <p class="text-2xl font-bold text-gray-900">{{ mockJobs.length }}</p>
          </div>
          <UIcon name="i-lucide-database" class="w-8 h-8 text-gray-400" />
        </div>
      </UCard>
      
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">Completed</p>
            <p class="text-2xl font-bold text-green-600">
              {{ mockJobs.filter(job => job.status === 'completed').length }}
            </p>
          </div>
          <UIcon name="i-lucide-check-circle" class="w-8 h-8 text-green-400" />
        </div>
      </UCard>
      
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">Processing</p>
            <p class="text-2xl font-bold text-blue-600">
              {{ mockJobs.filter(job => job.status === 'processing').length }}
            </p>
          </div>
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </UCard>
      
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">Failed</p>
            <p class="text-2xl font-bold text-red-600">
              {{ mockJobs.filter(job => job.status === 'failed').length }}
            </p>
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
          v-for="job in mockJobs"
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
                  `text-${statusColors[job.status]}-500`
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
                :color="statusColors[job.status]" 
                variant="subtle"
                class="capitalize"
              >
                {{ job.status }}
              </UBadge>
              
              <UDropdownMenu :items="[
                [{
                  label: 'View Details',
                  icon: 'i-lucide-eye',
                  click: () => viewJobDetails(job.id)
                }],
                job.status === 'processing' ? [{
                  label: 'Cancel Job',
                  icon: 'i-lucide-stop-circle',
                  click: () => cancelJob(job.id)
                }] : [],
                job.status === 'failed' ? [{
                  label: 'Retry Job',
                  icon: 'i-lucide-refresh-cw',
                  click: () => retryJob(job.id)
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
              :color="statusColors[job.status]"
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
        <div v-if="mockJobs.length === 0" class="text-center py-12">
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
  </div>
</template>