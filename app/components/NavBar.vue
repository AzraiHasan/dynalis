<!-- components/NavBar.vue -->

<template>
  <UContainer>
    <nav class="py-4 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-building-2" class="text-emerald-500 w-8 h-8" />
        <h1 class="text-xl font-bold">Dynalis Interpreter</h1>
      </div>
      
      <div v-if="user" class="flex items-center gap-4">
        <span class="text-sm text-gray-600">{{ user.email }}</span>
        <UButton color="error" variant="soft" size="sm" icon="i-lucide-log-out" @click="handleLogout">
          Logout
        </UButton>
      </div>
    </nav>
  </UContainer>
</template>

<script setup lang="ts">
const router = useRouter()
const toast = useToast()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

async function handleLogout() {
  try {
    // Sign out with Supabase
    const { error } = await supabase.auth.signOut()
    
    if (error) throw error
    
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