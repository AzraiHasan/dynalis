<!-- components/NavBar.vue -->

<template>
  <UContainer>
    <nav class="py-4 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-building-2" class="text-emerald-500 w-8 h-8" />
        <h1 class="text-xl font-bold">Dynalis Interpreter</h1>
      </div>
      
      <!-- Demo Mode User Info -->
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-600">Demo User</span>
        <UButton color="error" variant="soft" size="sm" icon="i-lucide-x-circle" @click="handleQuitDemo">
          Quit Demo
        </UButton>
      </div>
    </nav>
  </UContainer>
</template>

<script setup lang="ts">
const router = useRouter()
const toast = useToast()

function handleQuitDemo() {
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
</script>