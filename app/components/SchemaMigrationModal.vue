<script setup lang="ts">
interface SchemaChange {
  removed: string[]
  typeChanged: Array<{
    column: string
    from: string
    to: string
  }>
}

defineProps<{
  changes: SchemaChange
}>()

const emit = defineEmits<{ close: [boolean] }>()
</script>

<template>
  <UModal :title="'Schema Changes Detected'" size="xl">
    <div class="space-y-4">
      <div v-if="changes.removed.length" class="space-y-2">
        <p class="font-medium">Removed columns:</p>
        <ul class="list-disc list-inside text-sm">
          <li v-for="column in changes.removed" :key="column">
            {{ column }}
          </li>
        </ul>
      </div>

      <div v-if="changes.typeChanged.length" class="space-y-2">
        <p class="font-medium">Changed types:</p>
        <ul class="list-disc list-inside text-sm">
          <li v-for="change in changes.typeChanged" :key="change.column">
            {{ change.column }} ({{ change.from }} → {{ change.to }})
          </li>
        </ul>
      </div>

      <p class="text-sm text-gray-600">
        Do you want to create a new schema version?
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="soft"
          label="Cancel Upload"
          @click="emit('close', false)"
        />
        <UButton
          color="primary"
          label="Create New Version"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
