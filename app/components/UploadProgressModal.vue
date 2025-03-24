<!-- components/UploadProgressModal.vue -->
<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <Icon name="i-lucide-upload" class="text-gray-600" />
          <h3 class="text-lg font-semibold">Uploading Data</h3>
        </div>
      </template>
      
      <div class="space-y-4 py-4">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium">{{ statusMessage }}</span>
          <span class="text-sm text-gray-500">{{ Math.round(progress) }}%</span>
        </div>
        
        <UProgress
          v-model="progress"
          color="primary"
          :indeterminate="status === 'preparing' || status === 'processing'"
        />
        
        <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
          {{ error.message }}
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            v-if="status === 'error'"
            color="neutral"
            @click="$emit('close')"
          >
            Close
          </UButton>
          <UButton
            v-if="status !== 'complete' && status !== 'error'"
            color="neutral"
            @click="$emit('cancel')"
            :disabled="status === 'uploading'"
          >
            Cancel
          </UButton>
          <UButton
            v-if="status === 'complete'"
            color="primary"
            @click="$emit('continue')"
          >
            Continue to Dashboard
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  progress: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'idle'
  },
  statusMessage: {
    type: String,
    default: ''
  },
  error: {
    type: Object,
    default: null
  }
})

defineEmits(['close', 'cancel', 'continue'])
</script>