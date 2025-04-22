<!-- app/components/HeaderMappingPanel.vue -->

<template>
  <div class="header-mapping-panel">
    <h3 class="text-lg font-medium mb-4">Header Mapping Configuration</h3>

    <div v-if="savedConfigurations.length > 0" class="mb-4">
      <h4 class="text-md font-medium mb-2">Saved Mapping Configurations</h4>
      <div class="flex items-center gap-2">
        <USelect
          v-model="selectedConfig"
          :items="configOptions"
          placeholder="Select a saved mapping"
          class="flex-1"
        />
        <UButton
          color="primary"
          variant="soft"
          @click="applySelectedMapping"
          :disabled="!selectedConfig"
        >
          Apply Mapping
        </UButton>
      </div>
    </div>

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
              :model-value="mappings[header]"
              :items="systemFieldOptions"
              placeholder="Select system field"
              @update:model-value="updateMapping(header, $event)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <div v-else class="text-center p-6 bg-gray-50 rounded-lg">
      <p class="text-gray-500">
        No file headers detected. Please upload a file first.
      </p>
    </div>

    <!-- Action buttons -->
    <div class="flex justify-end mt-4 space-x-2">
      <UButton
        v-if="hasChanges"
        color="primary"
        :loading="props.isSaving"
        @click="saveMapping"
      >
        Save Mapping
      </UButton>
      <UButton color="secondary" @click="loadSavedMappings" class="mr-2">
        Load Saved Mappings
      </UButton>
      <UBadge
        v-if="!hasChanges && savedSuccessfully"
        color="success"
        class="ml-2"
      >
        Mapping saved
      </UBadge>
      <UBadge v-else-if="hasChanges" color="warning" class="ml-2">
        Unsaved changes
      </UBadge>
    </div>
    <!-- Debugging -->
    <!-- <div class="p-4 bg-gray-100 mt-4 rounded text-xs">
      <p>System Fields Available: {{ systemFields.length }}</p>
      <p>Options Generated: {{ systemFieldOptions.length }}</p>
      <pre>{{ JSON.stringify(systemFieldOptions, null, 2) }}</pre>
    </div>
    <div class="mt-4 p-4 bg-gray-100 rounded text-xs">
      <p>System Fields Props: {{ systemFields.length }}</p>
      <p>Computed Options: {{ systemFieldOptions.length }}</p>
      <pre v-if="systemFields.length">
First field: {{ JSON.stringify(systemFields[0], null, 2) }}</pre
      >
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { SystemField, MappingConfiguration } from "~/types/mapping";
const savedConfigurations = ref<MappingConfiguration[]>([]);
const selectedConfig = ref<string | undefined>(undefined);

const toast = useToast();

interface Props {
  fileHeaders: string[];
  systemFields: SystemField[];
  initialMapping?: Record<string, string>;
  savedSuccessfully?: boolean;
  isSaving?: boolean;
}

interface Emits {
  (e: "update", mapping: Record<string, string>): void;
  (e: "save", mapping: Record<string, string>): void;
}

const props = withDefaults(defineProps<Props>(), {
  initialMapping: () => ({}),
  savedSuccessfully: false,
  isSaving: false,
});
const emit = defineEmits<Emits>();

// State
const mappings = ref<Record<string, string>>(props.initialMapping || {});
const originalMappings = JSON.stringify(props.initialMapping || {});

// Computed properties
const systemFieldOptions = computed(() => {
  console.log("Computing options from:", props.systemFields);
  return props.systemFields.map((field) => ({
    label: field.name,
    value: field.id,
    description: field.description || `Type: ${field.dataType}`,
  }));
});

const configOptions = computed(() => {
  return savedConfigurations.value.map(config => ({
    label: config.name,
    value: config.id,
    description: `Created: ${new Date(config.createdAt).toLocaleString()}`
  }));
});

const hasChanges = computed(() => {
  return JSON.stringify(mappings.value) !== originalMappings;
});

// Methods
function updateMapping(
  header: string,
  systemFieldId: string | number | boolean | null
) {
  if (systemFieldId === null) {
    // Handle null case - remove mapping
    delete mappings.value[header];
  } else {
    // Convert to string and store
    mappings.value[header] = String(systemFieldId);
  }

  emit("update", { ...mappings.value });
}

function saveMapping() {
  emit("save", { ...mappings.value });
  // We'll reset this in the parent after save completes
}

async function loadSavedMappings() {
  try {
    const response = await fetch('/api/mapping/configurations');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    savedConfigurations.value = result.configurations || [];
  } catch (error) {
    console.error('Error loading saved mappings:', error);
  }
}

function applySelectedMapping() {
  if (!selectedConfig.value) return;
  
  const config = savedConfigurations.value.find(c => c.id === selectedConfig.value);
  if (!config) return;
  
  // Create a new mapping object from the selected configuration
  const newMapping: Record<string, string> = {};
  
  for (const mapping of config.mappings) {
    // Only apply mappings for headers that exist in the current file
    if (props.fileHeaders.includes(mapping.userHeaderName)) {
      newMapping[mapping.userHeaderName] = mapping.systemFieldId;
    }
  }
  
  // Update the current mapping
  mappings.value = newMapping;
  emit("update", newMapping);
}

onMounted(() => {
  loadSavedMappings();
});
</script>
