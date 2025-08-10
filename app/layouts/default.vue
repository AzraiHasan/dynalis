<script setup lang="ts">
const sidebarRef = ref()
const sidebarCollapsed = ref(false)

// Mobile menu toggle
function toggleMobileMenu() {
  sidebarRef.value?.toggleMobile()
}

// Load initial state
onMounted(() => {
  if (process.client) {
    // Clear any bad localStorage state for now
    localStorage.removeItem('sidebar-collapsed')
    sidebarCollapsed.value = false
  }
})

// Provide sidebar state to child components
provide('sidebarCollapsed', sidebarCollapsed)

// Function to toggle sidebar from sidebar component
function handleSidebarToggle(isCollapsed: boolean) {
  sidebarCollapsed.value = isCollapsed
}

// Provide toggle function to sidebar
provide('toggleSidebar', handleSidebarToggle)
</script>

<template>
  <UApp>
    <div class="min-h-screen bg-gray-50 lg:flex">
      <!-- Sidebar -->
      <Sidebar ref="sidebarRef" />
      
      <!-- Main Content Area -->
      <div class="flex-1">
        <!-- Mobile Header -->
        <header class="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
          <div class="flex items-center justify-between px-4 py-3">
            <div class="flex items-center space-x-3">
              <UButton
                variant="ghost"
                size="sm"
                icon="i-lucide-menu"
                @click="toggleMobileMenu"
                class="text-gray-500 hover:text-gray-700"
              />
              <div class="flex items-center space-x-2">
                <UIcon name="i-lucide-building-2" class="text-emerald-500 w-6 h-6" />
                <h1 class="text-lg font-semibold text-gray-800">Dynalis</h1>
              </div>
            </div>
          </div>
        </header>

        <!-- Page Content -->
        <main class="p-4 lg:p-6">
          <UContainer>
            <slot />
          </UContainer>
        </main>
      </div>
    </div>
  </UApp>
</template>