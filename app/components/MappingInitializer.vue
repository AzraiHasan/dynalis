<!-- app/components/MappingInitializer.vue -->
<script setup lang="ts">
import { onMounted } from "vue";
import { useToast } from "#imports";
import { useMappingState } from "~/composables/useMappingState";

// Access composables
const toast = useToast();
const mappingState = useMappingState();

async function initializeMapping(): Promise<void> {
  // Use state from the composable
  mappingState.startInitialization();

  try {
    // Call the initialization endpoint
    const response = await fetch("/api/mapping/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Use the composable to fetch and set system fields
    await checkInitializationStatus();

    // Show success toast
    toast.add({
      title: "Success",
      description:
        result.message || "Mapping framework initialized successfully",
      color: "success",
      duration: 5000,
    });
  } catch (error) {
    const errorMessage =
      "Failed to initialize mapping framework. Please try again.";
    console.error("Initialization failed:", error);

    // Set error in the composable
    mappingState.setError(
      error instanceof Error ? error : new Error(errorMessage)
    );

    // Show error toast
    toast.add({
      title: "Error",
      description: errorMessage,
      color: "error",
      duration: 5000,
    });
  }
}

async function checkInitializationStatus(): Promise<void> {
  // Use the composable
  mappingState.startChecking();

  try {
    // Call the system-fields endpoint to check for existing fields
    const response = await fetch("/api/mapping/system-fields");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const fields = data.fields || [];

    console.log("Initialization check:", {
      fieldsFound: fields.length,
      fields,
    });

    // Update state using the composable
    mappingState.finishChecking(fields.length > 0, fields);

    // Emit status to parent component
    emit("statusChanged", mappingState.isInitialized.value);
    console.log("Emitting status change:", mappingState.isInitialized.value);
  } catch (error) {
    const errorMessage =
      "Unable to check mapping framework status. Please try again.";
    console.error("Failed to check initialization status:", error);

    // Set error in the composable
    mappingState.setError(
      error instanceof Error ? error : new Error(errorMessage)
    );

    // Show error toast
    toast.add({
      title: "Error",
      description: errorMessage,
      color: "error",
      duration: 5000,
    });
  }
}

// Run check on component mount
onMounted(() => {
  console.log("MappingInitializer mounted, checking initialization status");
  checkInitializationStatus();
});

// Define emits with proper typing
const emit = defineEmits<{
  (event: "statusChanged", status: boolean): void;
}>();
</script>

<template>
  <div>
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-database-zap" class="text-emerald-500" />
          <h3 class="text-lg font-semibold">Mapping Framework Status</h3>
        </div>
      </template>

      <!-- Loading State -->
      <div
        v-if="mappingState.isChecking.value"
        class="flex justify-center py-6"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-loader-2" class="animate-spin text-gray-500" />
          <span class="text-gray-600">Checking initialization status...</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="mappingState.error && mappingState.error.value" class="py-4">
        <UAlert
          color="error"
          :description="
            mappingState.error.value?.message || 'An error occurred'
          "
        />
      </div>

      <!-- Main Content States -->
      <div v-else class="space-y-4">
        <!-- Initialized State -->
        <div v-if="mappingState.isInitialized.value">
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
            :loading="mappingState.isInitializing.value"
            color="primary"
            size="lg"
            block
            class="mt-4"
          >
            <template #leading>
              <UIcon
                v-if="!mappingState.isInitializing.value"
                name="i-lucide-database-backup"
              />
            </template>
            {{
              mappingState.isInitializing.value
                ? "Initializing..."
                : "Initialize Mapping Framework"
            }}
            <UTooltip
              text="This will create the necessary database tables and default field mappings"
            >
              <UButton
                class="ml-2"
                color="neutral"
                variant="ghost"
                icon="i-lucide-info"
                size="xs"
              />
            </UTooltip>
          </UButton>
        </div>
      </div>
    </UCard>
    <UTooltip
      text="The mapping framework allows you to standardize data columns between different file uploads"
    >
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-help-circle"
        size="xs"
      />
    </UTooltip>
    <div class="hidden">
        isChecking: {{ mappingState.isChecking.value }} 
        isInitialized: {{ mappingState.isInitialized.value }}
      </div>
  </div>
</template>
