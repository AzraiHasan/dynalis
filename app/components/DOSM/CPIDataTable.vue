<script setup lang="ts">
import type { CPIRecord } from '~/types/cpi'

interface Props {
  data: CPIRecord[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  sort: [column: string, direction: 'asc' | 'desc']
  export: []
}>()

// Sorting state
const sortColumn = ref<string>('date')
const sortDirection = ref<'asc' | 'desc'>('desc')

// Pagination state
const currentPage = ref(1)
const itemsPerPage = 50

// Sorted and paginated data
const sortedData = computed(() => {
  const sorted = [...props.data].sort((a, b) => {
    const aVal = a[sortColumn.value as keyof CPIRecord]
    const bVal = b[sortColumn.value as keyof CPIRecord]

    // Handle different types
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection.value === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection.value === 'asc' ? aVal - bVal : bVal - aVal
    }

    return 0
  })

  return sorted
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return sortedData.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(props.data.length / itemsPerPage)
})

// Sorting handler
function handleSort(column: string) {
  if (sortColumn.value === column) {
    // Toggle direction
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }

  emit('sort', sortColumn.value, sortDirection.value)
}

// Pagination handlers
function goToPage(page: number) {
  currentPage.value = page
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// Reset page when data changes
watch(() => props.data, () => {
  currentPage.value = 1
})

// Export handler
function handleExport() {
  emit('export')
}

// Column definitions
const columns = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'division', label: 'Division', sortable: true },
  { key: 'inflation', label: 'Inflation (%)', sortable: true }
]
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">CPI Data</h3>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">
            {{ data.length.toLocaleString() }} records
          </span>
          <UButton
            icon="i-lucide-download"
            size="sm"
            variant="soft"
            @click="handleExport"
          >
            Export
          </UButton>
        </div>
      </div>
    </template>

    <!-- Table -->
    <div v-if="!loading" class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              :class="col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''"
              @click="col.sortable ? handleSort(col.key) : null"
            >
              <div class="flex items-center gap-2">
                <span>{{ col.label }}</span>
                <Icon
                  v-if="col.sortable && sortColumn === col.key"
                  :name="sortDirection === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                  class="h-4 w-4"
                />
                <Icon
                  v-else-if="col.sortable"
                  name="i-lucide-arrow-up-down"
                  class="h-4 w-4 text-gray-300"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="(row, index) in paginatedData"
            :key="index"
            class="hover:bg-gray-50"
          >
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {{ row.date }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              <UBadge :color="row.division === 'overall' ? 'blue' : 'gray'">
                {{ row.division === 'overall' ? 'Overall' : `Div ${row.division}` }}
              </UBadge>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <span :class="row.inflation < 0 ? 'text-red-600' : 'text-green-600'">
                {{ row.inflation.toFixed(2) }}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Loading skeleton -->
    <div v-else class="space-y-3">
      <div v-for="i in 10" :key="i" class="h-12 bg-gray-100 animate-pulse rounded" />
    </div>

    <!-- Empty state -->
    <div v-if="!loading && data.length === 0" class="text-center py-12">
      <Icon name="i-lucide-inbox" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-500">No data available</p>
    </div>

    <!-- Pagination -->
    <template v-if="!loading && data.length > 0" #footer>
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-500">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to
          {{ Math.min(currentPage * itemsPerPage, data.length) }} of
          {{ data.length.toLocaleString() }} results
        </div>

        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            size="sm"
            variant="soft"
            :disabled="currentPage === 1"
            @click="previousPage"
          />

          <div class="flex items-center gap-1">
            <!-- First page -->
            <UButton
              v-if="currentPage > 3"
              size="sm"
              variant="soft"
              @click="goToPage(1)"
            >
              1
            </UButton>
            <span v-if="currentPage > 4" class="text-gray-400">...</span>

            <!-- Pages around current -->
            <template
              v-for="page in [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2]"
              :key="page"
            >
              <UButton
                v-if="page >= 1 && page <= totalPages"
                size="sm"
                :variant="page === currentPage ? 'solid' : 'soft'"
                :color="page === currentPage ? 'primary' : 'neutral'"
                @click="goToPage(page)"
              >
                {{ page }}
              </UButton>
            </template>

            <!-- Last page -->
            <span v-if="currentPage < totalPages - 3" class="text-gray-400">...</span>
            <UButton
              v-if="currentPage < totalPages - 2"
              size="sm"
              variant="soft"
              @click="goToPage(totalPages)"
            >
              {{ totalPages }}
            </UButton>
          </div>

          <UButton
            icon="i-lucide-chevron-right"
            size="sm"
            variant="soft"
            :disabled="currentPage === totalPages"
            @click="nextPage"
          />
        </div>
      </div>
    </template>
  </UCard>
</template>
