<template>
  <UCard>
    <template #header>
      <div class="flex justify-between items-center">
        <h3 class="text-base font-semibold">Schema Version History</h3>
        <UBadge>Version {{ currentVersion }}</UBadge>
      </div>
    </template>
    
    <div class="space-y-4">
      <div v-for="version in versions" :key="version.id" class="border-b pb-2">
        <div class="flex justify-between items-center">
          <span class="font-medium">Version {{ version.version }}</span>
          <span class="text-sm text-gray-500">
            {{ new Date(version.created_at).toLocaleDateString() }}
          </span>
        </div>
        <div class="mt-2 text-sm">
          <div v-for="col in version.schema_definition" :key="col.name" 
               class="flex gap-2 text-gray-600">
            <span>{{ col.name }}</span>
            <span class="text-gray-400">{{ col.type }}</span>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
  tableName: string
}>()

const supabase = useSupabaseClient()
const versions = ref<any[]>([])
const currentVersion = computed(() => 
  versions.value.find(v => v.is_current)?.version ?? 0
)

onMounted(async () => {
  const { data } = await supabase
    .from('schema_versions')
    .select('*')
    .eq('table_name', props.tableName)
    .order('version', { ascending: false })
    
  if (data) versions.value = data
})
</script>