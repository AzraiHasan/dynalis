<!-- components/NavBar.vue -->
<script setup lang="ts">
import { useMappingState } from '~/composables/useMappingState'

const router = useRouter()
const toast = useToast()
const { clear: clearUserSession } = useUserSession()
const mappingState = useMappingState()

async function handleLogout() {
  try {
    // Call our logout endpoint
    await $fetch('/api/auth/logout', { method: 'POST' })
    
    // Clear the local session state
    await clearUserSession()
    
    toast.add({
      title: "Success",
      description: "You have been logged out successfully.",
      color: "success",
    })
    
    // Redirect to login page
    router.push('/')
  } catch (error) {
    console.error('Logout error:', error)
    toast.add({
      title: "Error",
      description: "Failed to logout. Please try again.",
      color: "error",
    })
  }
}
</script>

<template>
  <UContainer>
    <nav class="py-4 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-building-2" class="text-emerald-500 w-8 h-8" />
        <h1 class="text-xl font-bold">Dynalis Interpreter</h1>
      </div>
      
      <!-- Add mapping status indicator -->
      <div v-if="mappingState.isInitialized.value" class="flex items-center mx-4">
        <UIcon name="i-lucide-database-check" class="text-emerald-500 w-4 h-4 mr-1" />
        <span class="text-xs text-gray-600">Mapping Ready</span>
      </div>
      
      <AuthState v-slot="{ loggedIn, user }">
        <div v-if="loggedIn" class="flex items-center gap-4">
          <span class="text-sm text-gray-600">{{ user?.email || user?.id }}</span>
          <UButton color="error" variant="soft" size="sm" icon="i-lucide-log-out" @click="handleLogout">
            Logout
          </UButton>
        </div>
      </AuthState>
    </nav>
  </UContainer>
</template>