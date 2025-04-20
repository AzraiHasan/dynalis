// app/components/HeaderMappingPanel.vue

<template>
  <div class="header-mapping-panel">
    <h3 class="text-lg font-medium mb-4">Header Mapping Configuration</h3>
    
    <!-- Display detected headers and mapping options -->
    <div v-if="fileHeaders.length > 0" class="space-y-4">
      <UCard v-for="header in fileHeaders" :key="header" class="p-3">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="font-medium">{{ header }}</p>
            <p class="text-sm text-gray-500">File Column</p>
          </div>
          
          <UIcon name="i-lucide-arrow-right" class="mx-4 text-gray-400" />
          
          <div class="flex-1">
            <USelect
              v-model="mappings[header]"
              :options="systemFieldOptions"
              placeholder="Select system field"
              @update:model-value="updateMapping(header, $event)"
            />
          </div>
        </div>
      </UCard>
    </div>
    
    <div v-else class="text-center p-6 bg-gray-50 rounded-lg">
      <p class="text-gray-500">No file headers detected. Please upload a file first.</p>
    </div>
    
    <!-- Action buttons -->
    <div class="flex justify-end mt-4 space-x-2">
      <UButton 
        v-if="hasChanges"
        color="primary" 
        @click="saveMapping">
        Save Mapping
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SystemField } from '~/types/mapping';

interface Props {
  fileHeaders: string[];
  systemFields: SystemField[];
  initialMapping?: Record<string, string>;
}

interface Emits {
  (e: 'update', mapping: Record<string, string>): void;
  (e: 'save', mapping: Record<string, string>): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// State
const mappings = ref<Record<string, string>>(props.initialMapping || {});
const originalMappings = JSON.stringify(props.initialMapping || {});

// Computed properties
const systemFieldOptions = computed(() => {
  return props.systemFields.map(field => ({
    label: field.name,
    value: field.id,
    description: field.description || `Type: ${field.dataType}`
  }));
});

const hasChanges = computed(() => {
  return JSON.stringify(mappings.value) !== originalMappings;
});

// Methods
function updateMapping(header: string, systemFieldId: string | number | boolean | null) {
  if (systemFieldId === null) {
    // Handle null case - remove mapping
    delete mappings.value[header];
  } else {
    // Convert to string and store
    mappings.value[header] = String(systemFieldId);
  }
  
  emit('update', { ...mappings.value });
}

function saveMapping() {
  emit('save', { ...mappings.value });
}
</script>