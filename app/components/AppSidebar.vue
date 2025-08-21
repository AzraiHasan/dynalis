<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useUploadState } from '~/composables/useUploadState'
import { useResetDemo } from '~/composables/useResetDemo'

interface SidebarState {
  isCollapsed: boolean
  isMobileOpen: boolean
  activeRoute: string
  uploadProgress?: {
    jobId: string
    progress: number
    status: string
  }
}

const route = useRoute()
const auth = useAuth()
const uploadState = useUploadState()
const resetDemo = useResetDemo()

// Modal state for reset confirmation
const showResetModal = ref(false)

// Inject layout functions (removed unused layoutToggleSidebar)

// Sidebar state management
const sidebarState = reactive<SidebarState>({
  isCollapsed: false,
  isMobileOpen: false,
  activeRoute: route.path,
  uploadProgress: undefined
})

// Initialize collapsed state - don't load from localStorage initially
onMounted(() => {
  // Start with expanded state
  sidebarState.isCollapsed = false
})

// Watch route changes
watch(() => route.path, (newPath) => {
  sidebarState.activeRoute = newPath
  // Close mobile sidebar on route change
  sidebarState.isMobileOpen = false
})

// Watch upload progress
watchEffect(() => {
  if (uploadState.isUploading.value) {
    sidebarState.uploadProgress = {
      jobId: 'current-upload', // placeholder since currentJobId doesn't exist
      progress: uploadState.progress.value,
      status: uploadState.status.value
    }
  } else {
    sidebarState.uploadProgress = undefined
  }
})

// Navigation items
const navigationItems = computed(() => [
  {
    label: 'Dashboard',
    icon: 'i-lucide-home',
    to: '/dashboard',
    isActive: sidebarState.activeRoute === '/dashboard'
  },
  {
    label: 'Data Upload',
    icon: 'i-lucide-upload',
    to: '/dataupload',
    isActive: sidebarState.activeRoute === '/dataupload'
  },
  {
    label: 'Upload Jobs',
    icon: 'i-lucide-clock',
    to: '/upload-jobs',
    isActive: sidebarState.activeRoute === '/upload-jobs'
  }
])

// Toggle functions (removed unused toggleCollapse)

function toggleMobile() {
  sidebarState.isMobileOpen = !sidebarState.isMobileOpen
}

function closeMobile() {
  sidebarState.isMobileOpen = false
}

// Logout function
async function handleLogout() {
  try {
    await auth.signOut()
    await navigateTo('/login')
  } catch (error) {
    console.error('Logout error:', error)
  }
}

// Reset demo functions
function openResetModal() {
  showResetModal.value = true
}

function closeResetModal() {
  showResetModal.value = false
}

async function confirmResetDemo() {
  try {
    await resetDemo.resetDemo()
    closeResetModal()
    // No need to navigate - the composable will refresh the page
  } catch (error) {
    console.error('Reset demo failed:', error)
    // Modal will stay open to show error status
  }
}

// Expose mobile toggle for layout
defineExpose({
  toggleMobile,
  isMobileOpen: computed(() => sidebarState.isMobileOpen)
})
</script>

<template>
  <!-- Desktop Sidebar -->
  <aside class="lg:relative lg:block hidden h-screen bg-white border-r border-gray-200 w-auto flex-shrink-0" style="min-width: 200px; max-width: 280px;">
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-center space-x-3 p-4 border-b border-gray-200">
        <UIcon name="i-lucide-building-2" class="text-emerald-500 w-8 h-8" />
        <div class="whitespace-nowrap">
          <h1 class="text-lg font-semibold text-gray-800">Dynalis</h1>
          <p class="text-xs text-gray-500">Operations Analytics</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-4 space-y-2">
        <SidebarItem
          v-for="item in navigationItems"
          :key="item.to"
          :label="item.label"
          :icon="item.icon"
          :to="item.to"
          :is-active="item.isActive"
          :is-collapsed="false"
        />

        <!-- Upload Progress Indicator -->
        <div 
          v-if="sidebarState.uploadProgress" 
          class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-blue-700 font-medium">Uploading...</span>
              <span class="text-blue-600">{{ sidebarState.uploadProgress.progress }}%</span>
            </div>
            <UProgress 
              :value="sidebarState.uploadProgress.progress" 
              color="info"
              size="sm"
            />
            <p class="text-xs text-blue-600">{{ sidebarState.uploadProgress.status }}</p>
          </div>
        </div>

        <!-- Template Download (Always Available) -->
        <div class="pt-4 border-t border-gray-200">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resources</p>
          <a
            href="/templates/dynalis-sample-data.xlsx"
            download
            class="flex items-center gap-3 px-4 py-3 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <UIcon name="i-lucide-download" class="w-5 h-5" />
            <span class="font-medium">Sample Template</span>
          </a>
          <p class="text-xs text-gray-400 px-4 mt-1">Prepare your data before upload</p>

          <!-- Reset Demo Button -->
          <button
            :disabled="resetDemo.isResetting.value"
            class="flex items-center gap-3 px-4 py-3 w-full text-red-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            @click="openResetModal"
          >
            <UIcon name="i-lucide-trash-2" class="w-5 h-5" />
            <span class="font-medium">Reset Demo</span>
          </button>
          <p class="text-xs text-red-400 px-4 mt-1">Clear all data and reset demo</p>
        </div>
      </nav>

      <!-- Divider -->
      <div class="px-4">
        <div class="border-t border-gray-200"/>
      </div>

      <!-- User Section -->
      <div class="p-4">
        <UButton
          variant="ghost"
          icon="i-lucide-log-out"
          label="Logout"
          size="md"
          class="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
          @click="handleLogout"
        />
      </div>
    </div>
  </aside>

  <!-- Mobile Sidebar Overlay -->
  <USlideover 
    v-model="sidebarState.isMobileOpen"
    side="left"
    class="lg:hidden"
  >
    <div class="flex flex-col h-full bg-white">
      <!-- Mobile Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <UIcon name="i-lucide-building-2" class="text-emerald-500 w-8 h-8" />
          <div>
            <h1 class="text-lg font-semibold text-gray-800">Dynalis</h1>
            <p class="text-xs text-gray-500">Data Analytics</p>
          </div>
        </div>
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          class="text-gray-500 hover:text-gray-700"
          @click="closeMobile"
        />
      </div>

      <!-- Mobile Navigation -->
      <nav class="flex-1 p-4 space-y-2">
        <SidebarItem
          v-for="item in navigationItems"
          :key="item.to"
          :label="item.label"
          :icon="item.icon"
          :to="item.to"
          :is-active="item.isActive"
          :is-collapsed="false"
        />

        <!-- Mobile Upload Progress -->
        <div 
          v-if="sidebarState.uploadProgress" 
          class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-blue-700 font-medium">Uploading...</span>
              <span class="text-blue-600">{{ sidebarState.uploadProgress.progress }}%</span>
            </div>
            <UProgress 
              :value="sidebarState.uploadProgress.progress" 
              color="info"
              size="sm"
            />
            <p class="text-xs text-blue-600">{{ sidebarState.uploadProgress.status }}</p>
          </div>
        </div>

        <!-- Mobile Template Download -->
        <div class="pt-4 border-t border-gray-200">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resources</p>
          <a
            href="/templates/dynalis-sample-data.xlsx"
            download
            class="flex items-center gap-3 px-4 py-3 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <UIcon name="i-lucide-download" class="w-5 h-5" />
            <span class="font-medium">Sample Template</span>
          </a>
          <p class="text-xs text-gray-400 px-4 mt-1">Prepare your data before upload</p>

          <!-- Mobile Reset Demo Button -->
          <button
            :disabled="resetDemo.isResetting.value"
            class="flex items-center gap-3 px-4 py-3 w-full text-red-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            @click="openResetModal"
          >
            <UIcon name="i-lucide-trash-2" class="w-5 h-5" />
            <span class="font-medium">Reset Demo</span>
          </button>
          <p class="text-xs text-red-400 px-4 mt-1">Clear all data and reset demo</p>
        </div>
      </nav>

      <!-- Mobile Divider -->
      <div class="px-4">
        <div class="border-t border-gray-200"/>
      </div>

      <!-- Mobile User Section -->
      <div class="p-4">
        <UButton
          variant="ghost"
          icon="i-lucide-log-out"
          label="Logout"
          size="md"
          class="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
          @click="handleLogout"
        />
      </div>
    </div>
  </USlideover>

  <!-- Reset Demo Confirmation Modal -->
  <UModal v-model:open="showResetModal" :prevent-close="resetDemo.isResetting.value">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-alert-triangle" class="text-red-500 w-6 h-6" />
            <h3 class="text-lg font-semibold text-gray-900">Reset Demo Data</h3>
          </div>
        </template>

        <div class="space-y-4">
          <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-800 font-medium">⚠️ This action cannot be undone!</p>
            <p class="text-red-700 text-sm mt-1">
              This will permanently delete all data including:
            </p>
            <ul class="text-red-700 text-sm mt-2 space-y-1 ml-4">
              <li>• All site data</li>
              <li>• Upload jobs and history</li>
              <li>• Conflict resolution data</li>
              <li>• Local storage cache</li>
            </ul>
          </div>

          <!-- Progress indicator when resetting -->
          <div v-if="resetDemo.isResetting.value" class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-700 font-medium">{{ resetDemo.resetStatus.value }}</span>
              <span class="text-gray-600">{{ resetDemo.resetProgress.value }}%</span>
            </div>
            <UProgress 
              :value="resetDemo.resetProgress.value" 
              color="error"
              size="sm"
            />
          </div>

          <!-- Error message if reset failed -->
          <div v-if="resetDemo.resetStatus.value.includes('failed')" class="p-3 bg-red-100 border border-red-300 rounded-lg">
            <p class="text-red-800 text-sm">{{ resetDemo.resetStatus.value }}</p>
          </div>

          <!-- Success message -->
          <div v-if="resetDemo.resetStatus.value.includes('completed')" class="p-3 bg-green-100 border border-green-300 rounded-lg">
            <p class="text-green-800 text-sm">{{ resetDemo.resetStatus.value }}</p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              variant="outline"
              label="Cancel"
              :disabled="resetDemo.isResetting.value"
              @click="closeResetModal"
            />
            <UButton
              color="error"
              :label="resetDemo.isResetting.value ? 'Resetting...' : 'Reset Demo'"
              :loading="resetDemo.isResetting.value"
              :disabled="resetDemo.isResetting.value"
              @click="confirmResetDemo"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
