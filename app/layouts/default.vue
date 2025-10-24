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
        <nav class="flex-1 p-4 flex flex-col">
          <div class="space-y-2">
            <!-- Demo Mode Information -->
            <div class=" p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
              <p class="font-medium mb-2">💡 Getting Started</p>
              <ul class="space-y-1 text-xs text-blue-700">
                <li>• Download the sample template from the sidebar</li>
                <li>• Fill in your property data</li>
                <li>• Upload and analyze your data</li>
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

            <!-- DOSM CPI Section -->
            <div class="pt-4 border-t border-gray-200">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">DOSM CPI</p>
              <NuxtLink
                to="/dosmupload"
                class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                :class="{ 'bg-blue-50 text-blue-700 border-blue-200': $route.path === '/dosmupload' }"
              >
                <UIcon name="i-lucide-file-up" class="w-5 h-5" />
                <span class="font-medium">CPI Dataset</span>
              </NuxtLink>

              <NuxtLink
                to="/dosm-dashboard"
                class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                :class="{ 'bg-blue-50 text-blue-700 border-blue-200': $route.path === '/dosm-dashboard' }"
              >
                <UIcon name="i-lucide-chart-line" class="w-5 h-5" />
                <span class="font-medium">CPI Dashboard</span>
              </NuxtLink>
            </div>

            <!-- DOSM GDP/GNI Section -->
            <div class="pt-4 border-t border-gray-200">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">DOSM GDP/GNI</p>
              <NuxtLink
                to="/dosmgdp"
                class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                :class="{ 'bg-purple-50 text-purple-700 border-purple-200': $route.path === '/dosmgdp' }"
                @click="console.log('DEBUG: Clicked GDP/GNI Upload link, navigating to /dosmgdp')"
              >
                <UIcon name="i-lucide-trending-up" class="w-5 h-5" />
                <span class="font-medium">GDP/GNI Dataset</span>
              </NuxtLink>

              <NuxtLink
                to="/dosmgdp-dashboard"
                class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                :class="{ 'bg-purple-50 text-purple-700 border-purple-200': $route.path === '/dosmgdp-dashboard' }"
                @click="console.log('DEBUG: Clicked GDP/GNI Dashboard link, navigating to /dosmgdp-dashboard')"
              >
                <UIcon name="i-lucide-line-chart" class="w-5 h-5" />
                <span class="font-medium">GDP/GNI Dashboard</span>
              </NuxtLink>
            </div>
          </div>

          <!-- Spacer to push Reset Demo to bottom -->
          <div class="flex-1" />

          <!-- Reset Demo Button -->
          <div class="pt-3 border-t border-gray-200">
            <button
              class="flex items-center gap-3 px-4 py-3 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors w-full"
              @click="resetDemo"
            >
              <UIcon name="i-lucide-trash-2" class="w-5 h-5" />
              <span class="font-medium">Reset Demo</span>
            </button>
            <p class="text-xs text-gray-400 px-4 mt-1">Clear all data to start fresh</p>
          </div>
        </nav>

        <!-- Demo Mode User Section -->
        <div class="p-4 border-t border-gray-200">
          <div class="space-y-3">
            
            <UButton 
              color="error" 
              variant="soft" 
              size="lg" 
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

function resetDemo() {
  console.log('Reset Demo: Starting complete localStorage clear...')
  
  if (typeof window !== 'undefined') {
    // Get all localStorage keys before clearing
    const allKeys = Object.keys(localStorage)
    console.log('Reset Demo: All localStorage keys before clearing:', allKeys)
    
    // Clear ALL localStorage data (no theme preservation needed since we force light mode)
    localStorage.clear()
    console.log('Reset Demo: All localStorage data cleared')
    
    // Re-establish only the essential demo flags
    localStorage.setItem('dynalis-demo-mode', 'true')
    localStorage.setItem('demo-was-reset', 'true')
    
    console.log('Reset Demo: Demo flags re-established')
  } else {
    console.warn('Reset Demo: Window is not available, skipping localStorage operations')
  }
  
  toast.add({
    title: "Demo Reset",
    description: "All data cleared. Dashboard reset to empty state.",
    color: "warning",
  })
  console.log('Reset Demo: Toast notification displayed')
  
  // Refresh current page if on dashboard to show empty state
  if (route.path === '/dashboard') {
    console.log('Reset Demo: User is on dashboard, refreshing page...')
    router.go(0)
  } else {
    console.log(`Reset Demo: User is on ${route.path}, no page refresh needed`)
  }
  
  console.log('Reset Demo: Complete reset process completed')
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