<!-- pages/demo-sandbox.vue -->
<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Demo Session Header -->
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center space-x-4">
            <h1 class="text-xl font-bold">Dynalis Demo</h1>
            <span class="px-3 py-1 bg-blue-500 rounded-full text-sm">
              Interactive Demo Session
            </span>
          </div>
          
          <div class="flex items-center space-x-6">
            <!-- Session Timer -->
            <div class="flex items-center space-x-2">
              <UIcon name="i-heroicons-clock" class="h-5 w-5" />
              <span class="font-medium">{{ demoSession.timeRemainingFormatted }}</span>
            </div>
            
            <!-- Progress Bar -->
            <div class="w-32">
              <div class="text-xs text-blue-100 mb-1">Session Progress</div>
              <div class="w-full bg-blue-500 rounded-full h-2">
                <div 
                  class="bg-white rounded-full h-2 transition-all duration-300"
                  :style="{ width: demoSession.progress + '%' }"
                />
              </div>
            </div>
            
            <!-- Exit Demo Button -->
            <UButton
              variant="outline"
              color="white"
              size="sm"
              @click="exitDemo"
            >
              Exit Demo
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Demo Warning Banner (when 5 minutes left) -->
    <div 
      v-if="demoSession.showWarning" 
      class="bg-yellow-50 border-l-4 border-yellow-400 p-4"
    >
      <div class="flex items-center justify-between max-w-7xl mx-auto px-4">
        <div class="flex items-center">
          <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5 text-yellow-400 mr-3" />
          <div>
            <h3 class="text-sm font-medium text-yellow-800">Demo ending soon!</h3>
            <p class="text-sm text-yellow-700 mt-1">
              Your demo session will end in {{ demoSession.timeRemainingFormatted }}. 
              Ready to get full access?
            </p>
          </div>
        </div>
        <UButton color="yellow" variant="solid" size="sm" @click="showUpgradeModal = true">
          Get Full Access
        </UButton>
      </div>
    </div>

    <!-- Demo Content Tabs -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900 mb-4">
          Experience Dynalis in Action
        </h2>
        <p class="text-lg text-gray-600">
          Explore all features with pre-loaded Malaysian property data. Upload files, track progress, and see real-time analytics.
        </p>
      </div>

      <!-- Demo Navigation Tabs -->
      <UTabs 
        v-model="selectedTab" 
        :items="demoTabs"
        class="mb-8"
      >
        <!-- Dashboard Tab -->
        <template #dashboard>
          <div class="space-y-6">
            <!-- Demo Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <UIcon name="i-heroicons-building-office-2" class="h-8 w-8 text-blue-600" />
                  </div>
                  <div class="ml-4">
                    <p class="text-sm font-medium text-gray-600">Total Sites</p>
                    <p class="text-2xl font-bold text-gray-900">{{ demoData.sitesCount }}</p>
                  </div>
                </div>
              </div>
              
              <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <UIcon name="i-heroicons-currency-dollar" class="h-8 w-8 text-green-600" />
                  </div>
                  <div class="ml-4">
                    <p class="text-sm font-medium text-gray-600">Total Rental</p>
                    <p class="text-2xl font-bold text-gray-900">RM{{ demoData.totalRental.toLocaleString() }}</p>
                  </div>
                </div>
              </div>
              
              <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <UIcon name="i-heroicons-banknotes" class="h-8 w-8 text-yellow-600" />
                  </div>
                  <div class="ml-4">
                    <p class="text-sm font-medium text-gray-600">Total Payments</p>
                    <p class="text-2xl font-bold text-gray-900">RM{{ demoData.totalPayments.toLocaleString() }}</p>
                  </div>
                </div>
              </div>
              
              <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <UIcon name="i-heroicons-shield-check" class="h-8 w-8 text-indigo-600" />
                  </div>
                  <div class="ml-4">
                    <p class="text-sm font-medium text-gray-600">Total Deposits</p>
                    <p class="text-2xl font-bold text-gray-900">RM{{ demoData.totalDeposits.toLocaleString() }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sites Table -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-medium text-gray-900">Site Management</h3>
                <p class="text-sm text-gray-500 mt-1">Manage your property sites and rental information</p>
              </div>
              
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site ID</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Rental</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="site in displayedSites" :key="site.id" class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {{ site.site_id }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ site.location }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ site.tenant_name }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ formatDate(site.exp_date) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        RM{{ site.total_rental?.toLocaleString() }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span :class="getStatusColor(site.exp_date)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                          {{ getStatus(site.exp_date) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>

        <!-- File Upload Tab -->
        <template #upload>
          <div class="space-y-6">
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Demo File Upload</h3>
              <p class="text-sm text-gray-600 mb-6">
                Try uploading files to see Dynalis in action. We'll simulate the entire process with realistic data.
              </p>
              
              <!-- Upload Area -->
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <UIcon name="i-heroicons-cloud-arrow-up" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h4 class="text-lg font-medium text-gray-900 mb-2">Upload Demo Files</h4>
                <p class="text-sm text-gray-500 mb-4">
                  Drop files here or click to browse. We'll simulate processing with sample data.
                </p>
                
                <div class="space-y-3">
                  <UButton color="primary" variant="solid" @click="simulateSmallUpload">
                    Simulate Small Upload (10 records)
                  </UButton>
                  <UButton color="primary" variant="outline" @click="simulateLargeUpload">
                    Simulate Large Upload (100 records)
                  </UButton>
                  <UButton color="gray" variant="soft" @click="downloadSampleTemplate">
                    Download Sample Template
                  </UButton>
                </div>
              </div>

              <!-- Upload Progress (when processing) -->
              <div v-if="demoData.isProcessing" class="mt-6 p-4 bg-blue-50 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-medium text-blue-900">Processing Upload...</h4>
                  <span class="text-sm text-blue-700">{{ demoData.processedRecords }}/{{ demoData.totalRecords }}</span>
                </div>
                <div class="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    :style="{ width: demoData.uploadProgress + '%' }"
                  />
                </div>
                <p class="text-xs text-blue-600 mt-2">
                  Validating data and updating records...
                </p>
              </div>
            </div>
          </div>
        </template>

        <!-- Analytics Tab -->
        <template #analytics>
          <div class="space-y-6">
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Demo Analytics</h3>
              <p class="text-sm text-gray-600 mb-6">
                Real-time insights into your property portfolio performance.
              </p>
              
              <!-- Analytics Charts Placeholder -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div class="text-center">
                    <UIcon name="i-heroicons-chart-bar" class="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p class="text-sm text-gray-500">Revenue Analytics</p>
                  </div>
                </div>
                
                <div class="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div class="text-center">
                    <UIcon name="i-heroicons-chart-pie" class="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p class="text-sm text-gray-500">Occupancy Rates</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </UTabs>
    </div>

    <!-- Upgrade Modal -->
    <UModal v-model="showUpgradeModal">
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Ready for Full Access?</h3>
        <p class="text-sm text-gray-600 mb-6">
          You've experienced Dynalis in action. Get full access to manage unlimited properties, 
          advanced analytics, and team collaboration features.
        </p>
        
        <div class="flex justify-end space-x-3">
          <UButton variant="ghost" @click="showUpgradeModal = false">
            Continue Demo
          </UButton>
          <UButton color="primary" @click="upgradeToFull">
            Get Full Access
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- Guided Tour Overlay (if enabled) -->
    <div v-if="showGuidedTour" class="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg p-6 max-w-md">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Welcome to Dynalis Demo!</h3>
          <p class="text-sm text-gray-600 mb-6">
            Let us guide you through the key features. This tour will take about 2 minutes.
          </p>
          <div class="flex justify-end space-x-3">
            <UButton variant="ghost" @click="skipTour">
              Skip Tour
            </UButton>
            <UButton color="primary" @click="startTour">
              Start Tour
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDemoSession } from '~/composables/useDemoSession'
import { useDemoData } from '~/composables/useDemoData'

// Meta for demo page
definePageMeta({
  layout: false
})

// Composables
const demoSession = useDemoSession()
const demoData = useDemoData()

// Reactive data
const selectedTab = ref('dashboard')
const showUpgradeModal = ref(false)
const showGuidedTour = ref(false)

// Demo tabs configuration
const demoTabs = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'i-heroicons-home'
  },
  {
    key: 'upload',
    label: 'File Upload',
    icon: 'i-heroicons-cloud-arrow-up'
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: 'i-heroicons-chart-bar'
  }
]

// Computed properties
const displayedSites = computed(() => {
  return demoData.sites.value.slice(0, 10) // Show first 10 sites
})

// Methods
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-MY')
}

const getStatus = (expDate: string) => {
  const today = new Date()
  const expiry = new Date(expDate)
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysUntilExpiry < 0) return 'Expired'
  if (daysUntilExpiry <= 30) return 'Expiring Soon'
  return 'Active'
}

const getStatusColor = (expDate: string) => {
  const status = getStatus(expDate)
  switch (status) {
    case 'Expired':
      return 'bg-red-100 text-red-800'
    case 'Expiring Soon':
      return 'bg-yellow-100 text-yellow-800'
    case 'Active':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const simulateSmallUpload = async () => {
  const sampleData = demoData.generateRandomSiteData(10)
  await demoData.simulateUpload(sampleData)
}

const simulateLargeUpload = async () => {
  const sampleData = demoData.generateRandomSiteData(100)
  await demoData.simulateUpload(sampleData)
}

const downloadSampleTemplate = () => {
  // Create and download a sample CSV template
  const csvContent = `site_id,exp_date,total_rental,total_payment_to_pay,deposit,lot_no,location,tenant_name,contact_no
SAMPLE001,2025-12-31,2500.00,2500.00,500.00,A1-01,Kuala Lumpur,Sample Tenant,+60123456789
SAMPLE002,2025-06-30,1800.00,1800.00,360.00,B2-05,Petaling Jaya,Another Tenant,+60198765432`
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dynalis_sample_template.csv'
  a.click()
  window.URL.revokeObjectURL(url)
}

const exitDemo = () => {
  demoSession.endSession()
  navigateTo('/?demo_completed=true')
}

const upgradeToFull = () => {
  navigateTo('/signup?from=demo')
}

const skipTour = () => {
  showGuidedTour.value = false
  localStorage.setItem('demo_tour_skipped', 'true')
}

const startTour = () => {
  showGuidedTour.value = false
  // TODO: Implement guided tour logic
  console.log('[Demo] Starting guided tour...')
}

// Lifecycle
onMounted(() => {
  // Set demo mode flag when entering demo page
  if (import.meta.client) {
    sessionStorage.setItem('demo_mode', 'true')
    sessionStorage.setItem('demo_start_time', Date.now().toString())
  }
  
  // Check if user has already seen the tour
  const tourSkipped = localStorage.getItem('demo_tour_skipped')
  if (!tourSkipped) {
    setTimeout(() => {
      showGuidedTour.value = true
    }, 1000)
  }
  
  // Initialize demo session if not already active
  if (!demoSession.isActive.value) {
    demoSession.startSession()
  }
  
  // Initialize demo data
  demoData.initializeDemoData()
})

onUnmounted(() => {
  // Clean up if needed (but don't end session - user might navigate back)
})
</script>