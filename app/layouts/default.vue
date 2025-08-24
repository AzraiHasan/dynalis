<template>
  <UApp>
    <!-- Landing page (no sidebar) -->
    <div v-if="route.path === '/'" class="min-h-screen bg-gray-50">
      <div class="p-6 max-w-4xl mx-auto">
        <slot />
      </div>
    </div>

    <!-- All other pages (with sidebar) -->
    <div v-else class="flex h-screen bg-gray-50">
      <!-- Sidebar -->
      <aside 
        class="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col fixed md:relative h-full z-30"
        :class="{ '-translate-x-full md:translate-x-0': !sidebarOpen, 'translate-x-0': sidebarOpen }"
      >
        <!-- Brand Header -->
        <div class="p-6 border-b border-gray-200">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-building-2" class="text-emerald-500 w-8 h-8" />
            <div>
              <h1 class="text-lg font-bold text-gray-800">Dynalis</h1>
              <p class="text-xs text-gray-500">Data Interpreter</p>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 p-4 space-y-2">
          <!-- Demo Mode Information -->
          <div class="px-4 py-3 text-gray-500 text-sm">
            <p class="font-medium mb-1">Demo Mode Active:</p>
            <ul class="text-xs space-y-1 ml-2">
              <li>• Dashboard Analytics</li>
              <li>• Data Upload Tool</li>
              <li>• Site Management</li>
            </ul>
          </div>
          
          <!-- Main Navigation -->
          <NuxtLink
            to="/dashboard"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            :class="{ 'bg-emerald-50 text-emerald-700 border-emerald-200': $route.path === '/dashboard' }"
          >
            <UIcon name="i-lucide-layout-dashboard" class="w-5 h-5" />
            <span class="font-medium">Dashboard</span>
          </NuxtLink>

          <NuxtLink
            to="/dataupload"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            :class="{ 'bg-emerald-50 text-emerald-700 border-emerald-200': $route.path === '/dataupload' }"
          >
            <UIcon name="i-lucide-upload" class="w-5 h-5" />
            <span class="font-medium">Data Upload</span>
          </NuxtLink>

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
          </div>
        </nav>

        <!-- Demo Mode User Section -->
        <div class="p-4 border-t border-gray-200">
          <div class="space-y-3">
            <div class="text-center p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <UIcon name="i-lucide-zap" class="w-4 h-4 text-blue-500" />
              </div>
              <p class="text-sm font-medium text-blue-800 mb-1">Demo Mode</p>
              <p class="text-xs text-blue-600">All data stays local</p>
            </div>
            
            <UButton 
              color="error" 
              variant="soft" 
              size="sm" 
              icon="i-lucide-x-circle" 
              class="w-full justify-center"
              @click="quitDemo"
            >
              Quit Demo
            </UButton>
          </div>
        </div>
      </aside>

      <!-- Mobile Overlay -->
      <div 
        v-if="sidebarOpen" 
        class="fixed inset-0 bg-black bg-opacity-25 z-20 md:hidden"
        @click="sidebarOpen = false"
      />

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0 md:ml-0">
        <!-- Mobile Header -->
        <header class="md:hidden bg-white shadow-sm border-b border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <button 
              class="p-2 rounded-lg hover:bg-gray-100"
              @click="sidebarOpen = !sidebarOpen"
            >
              <UIcon name="i-lucide-menu" class="w-6 h-6 text-gray-600" />
            </button>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-building-2" class="text-emerald-500 w-6 h-6" />
              <h1 class="text-lg font-bold text-gray-800">Dynalis</h1>
            </div>
            <div class="w-10"/>
          </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 overflow-auto p-6">
          <slot />
        </main>
      </div>
    </div>
  </UApp>
</template>

<script setup lang="ts">
const router = useRouter()
const toast = useToast()
const sidebarOpen = ref(true)
const route = useRoute()

// Close sidebar on route change (mobile)
watch(() => router.currentRoute.value.path, () => {
  if (window.innerWidth < 768) {
    sidebarOpen.value = false
  }
})

function quitDemo() {
  if (typeof window !== 'undefined') {
    // Clear demo mode flag
    localStorage.removeItem('dynalis-demo-mode')
    
    // Clear all demo data
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('dynalis-demo-')
    )
    keys.forEach(key => localStorage.removeItem(key))
    
    // Clear any uploaded file data
    localStorage.removeItem('uploadedFileData')
  }
  
  toast.add({
    title: "Demo Ended",
    description: "Demo session cleared. Welcome back!",
    color: "info",
  })
  
  router.push('/')
}

// Handle responsive behavior
onMounted(() => {
  const handleResize = () => {
    if (window.innerWidth >= 768) {
      sidebarOpen.value = true
    } else {
      sidebarOpen.value = false
    }
  }

  handleResize()
  window.addEventListener('resize', handleResize)

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })
})
</script>

<style scoped>
aside {
  transition: transform 0.3s ease-in-out;
}

@media (min-width: 768px) {
  aside {
    transform: translateX(0) !important;
  }
}
</style>