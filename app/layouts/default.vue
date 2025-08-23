<template>
  <UApp>
    <div class="flex h-screen bg-gray-50">
      <!-- Sidebar -->
      <aside 
        class="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col"
        :class="{ '-translate-x-full': !sidebarOpen, 'translate-x-0': sidebarOpen }"
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
          <!-- Demo Navigation -->
          <NuxtLink
            to="/"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            :class="{ 'bg-emerald-50 text-emerald-700 border-emerald-200': $route.path === '/' }"
          >
            <UIcon name="i-lucide-home" class="w-5 h-5" />
            <span class="font-medium">Home</span>
          </NuxtLink>

          <NuxtLink
            to="/demo-sandbox"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            :class="{ 'bg-emerald-50 text-emerald-700 border-emerald-200': $route.path === '/demo-sandbox' }"
          >
            <UIcon name="i-lucide-play-circle" class="w-5 h-5" />
            <span class="font-medium">Interactive Demo</span>
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

        <!-- Demo Info Section -->
        <div class="p-4 border-t border-gray-200">
          <div class="text-center p-3 bg-emerald-50 rounded-lg">
            <div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <UIcon name="i-lucide-play-circle" class="w-4 h-4 text-emerald-600" />
            </div>
            <p class="text-sm text-gray-800 mb-1 font-medium">Demo Mode</p>
            <p class="text-xs text-gray-500">Experience Dynalis features</p>
          </div>
        </div>
      </aside>

      <!-- Mobile Overlay -->
      <div 
        v-if="sidebarOpen" 
        class="fixed inset-0 bg-black bg-opacity-25 z-20 md:hidden"
        @click="sidebarOpen = false"
      />

      <!-- Main Content -->
      <div class="flex-1 flex flex-col min-w-0">
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
            <div class="w-10"/> <!-- Spacer for center alignment -->
          </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 overflow-auto">
          <div class="p-6">
            <slot />
          </div>
        </main>
      </div>
    </div>
  </UApp>
</template>

<script setup lang="ts">
const sidebarOpen = ref(false)

// Close sidebar on route change (mobile)
watch(() => useRouter().currentRoute.value.path, () => {
  sidebarOpen.value = false
})

// Make sidebar responsive
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