<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useUploadState } from '~/composables/useUploadState'

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

// Inject layout functions
const layoutToggleSidebar = inject('toggleSidebar', () => {})

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

// Toggle functions
function toggleCollapse() {
  sidebarState.isCollapsed = !sidebarState.isCollapsed
  if (process.client) {
    localStorage.setItem('sidebar-collapsed', sidebarState.isCollapsed.toString())
  }
  // Notify layout - removed since collapse functionality doesn't exist yet
}

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
      </nav>

      <!-- Divider -->
      <div class="px-4">
        <div class="border-t border-gray-200"></div>
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
          @click="closeMobile"
          class="text-gray-500 hover:text-gray-700"
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
      </nav>

      <!-- Mobile Divider -->
      <div class="px-4">
        <div class="border-t border-gray-200"></div>
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
</template>
