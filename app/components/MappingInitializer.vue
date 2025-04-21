<!-- app/components/MappingInitializer.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from '#imports'

// Type definitions based on existing mapping types
interface SystemField {
  id: string
  name: string
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'object'
  isRequired: boolean
  description?: string
}

interface MappingStatus {
  initialized: boolean
  fieldCount: number
  timestamp: string
}

// State refs with proper type annotations
const isInitialized = ref<boolean>(false)
const isChecking = ref<boolean>(false)
const isInitializing = ref<boolean>(false)
const errorMessage = ref<string | null>(null)

// Access existing utilities
const toast = useToast()

async function initializeMapping(): Promise<void> {
  // Set loading state
  isInitializing.value = true
  errorMessage.value = null
  
  try {
    // Call the initialization endpoint
    const response = await fetch('/api/mapping/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    
    // Update status after successful initialization
    isInitialized.value = true
    emit('statusChanged', true)
    
    // Show success toast
    toast.add({
      title: 'Success',
      description: result.message || 'Mapping framework initialized successfully',
      color: 'success',
      duration: 5000
    })
  } catch (error) {
    console.error('Initialization failed:', error)
    errorMessage.value = 'Failed to initialize mapping framework. Please try again.'
    
    // Show error toast
    toast.add({
      title: 'Error',
      description: errorMessage.value,
      color: 'error',
      duration: 5000
    })
  } finally {
    isInitializing.value = false
  }
}

async function checkInitializationStatus(): Promise<void> {
  // Set loading state
  isChecking.value = true
  errorMessage.value = null
  
  try {
    // Call the system-fields endpoint to check for existing fields
    const response = await fetch('/api/mapping/system-fields')
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Determine initialization status based on system fields
    isInitialized.value = Array.isArray(data.fields) && data.fields.length > 0
    
    // Emit status to parent component
    emit('statusChanged', isInitialized.value)
    
  } catch (error) {
    console.error('Failed to check initialization status:', error)
    errorMessage.value = 'Unable to check mapping framework status. Please try again.'
    
    // Show error toast
    toast.add({
      title: 'Error',
      description: 'Failed to check mapping initialization status',
      color: 'error',
      duration: 5000
    })
  } finally {
    isChecking.value = false
  }
}

// Run check on component mount
onMounted(() => {
  checkInitializationStatus()
})

// Define emits with proper typing
const emit = defineEmits<{
  (event: 'statusChanged', status: boolean): void
}>()
</script>

<template>
  <div>
    <!-- Core Container Following Established Card Pattern -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-database-zap" class="text-emerald-500" />
          <h3 class="text-lg font-semibold">Mapping Framework Status</h3>
        </div>
      </template>

      <!-- Loading State with User Experience Consideration -->
      <div v-if="isChecking" class="flex justify-center py-6">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-loader-2" class="animate-spin text-gray-500" />
          <span class="text-gray-600">Checking initialization status...</span>
        </div>
      </div>

      <!-- Error State Following Toast Pattern -->
      <div v-else-if="errorMessage" class="py-4">
        <UAlert color="error" :description="errorMessage" />
      </div>

      <!-- Main Content States -->
      <div v-else class="space-y-4">
        <!-- Initialized State -->
        <div v-if="isInitialized">
          <UAlert 
            color="success" 
            title="Framework Initialized"
            description="The mapping framework is ready to use. You can now upload and map data."
          />
        </div>

        <!-- Not Initialized State -->
        <div v-else>
          <UAlert 
            color="info" 
            title="Initialize Required"
            description="The mapping framework needs to be initialized before you can upload data."
          />
          
          <UButton
            @click="initializeMapping"
            :loading="isInitializing"
            color="primary"
            size="lg"
            block
            class="mt-4"
          >
            <template #leading>
              <UIcon v-if="!isInitializing" name="i-lucide-database-backup" />
            </template>
            {{ isInitializing ? 'Initializing...' : 'Initialize Mapping Framework' }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>