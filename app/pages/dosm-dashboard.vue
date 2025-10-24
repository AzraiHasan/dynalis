<script setup lang="ts">
import { format } from 'date-fns'
import { exportToCSV } from '~/composables/useCPIData'
import { useCPIStore } from '~/stores/cpiStore'

// Page metadata
definePageMeta({
  layout: 'default'
})

// Router and store
const router = useRouter()
const { cpiState, loadFromCache, clearData, getBasicStats } = useCPIStore()

// Filter state
const selectedDivision = ref('all')
const selectedComparisonDivisions = ref(['overall', '01', '02', '03'])

// Load data on mount
onMounted(() => {
  loadFromCache()

  // Redirect if no data
  if (!cpiState.value.cpiData || cpiState.value.cpiData.records.length === 0) {
    router.push('/dosmupload')
  }
})

// Computed properties
const cpiData = computed(() => cpiState.value.cpiData)
const isLoading = computed(() => cpiState.value.isLoading)
const error = computed(() => cpiState.value.error)

const basicStats = computed(() => getBasicStats())

const hasData = computed(() => {
  return cpiData.value && cpiData.value.records.length > 0
})

// Filtered data for line chart
const filteredDataForLineChart = computed(() => {
  if (!cpiData.value) return []
  return selectedDivision.value === 'all'
    ? cpiData.value.records.filter(r => r.division === 'overall')
    : cpiData.value.records.filter(r => r.division === selectedDivision.value)
})

// Data for bar chart (latest year)
const dataForBarChart = computed(() => {
  if (!cpiData.value) return []
  return cpiData.value.records
})

// Data for comparison chart
const dataForComparisonChart = computed(() => {
  if (!cpiData.value) return []
  return cpiData.value.records
})

// Filtered data for table
const filteredDataForTable = computed(() => {
  if (!cpiData.value) return []
  return selectedDivision.value === 'all'
    ? cpiData.value.records
    : cpiData.value.records.filter(r => r.division === selectedDivision.value)
})

// Division options
const divisionOptions = computed(() => {
  if (!cpiData.value) return []

  const divisions = cpiData.value.metadata.divisions.map(div => ({
    value: div,
    label: div === 'overall' ? 'Overall' : `Division ${div}`
  }))

  return [{ value: 'all', label: 'All Divisions' }, ...divisions]
})

// Comparison division options
const comparisonDivisionOptions = computed(() => {
  if (!cpiData.value) return []

  return cpiData.value.metadata.divisions.map(div => ({
    value: div,
    label: div === 'overall' ? 'Overall' : `Division ${div}`
  }))
})

// Format last updated date
const formattedLastUpdated = computed(() => {
  if (!cpiData.value?.lastUpdated) return 'N/A'
  return format(new Date(cpiData.value.lastUpdated), 'PPp')
})

// Handlers
function resetFilters() {
  selectedDivision.value = 'all'
  selectedComparisonDivisions.value = ['overall', '01', '02', '03']
}

function handleExportData() {
  if (!cpiData.value) return

  const dataToExport = filteredDataForTable.value
  const fileName = `cpi-data-${selectedDivision.value}-${format(new Date(), 'yyyy-MM-dd')}.csv`

  exportToCSV(dataToExport, fileName)

  const toast = useToast()
  toast.add({
    title: 'Export successful',
    description: `Exported ${dataToExport.length} records`,
    color: 'green'
  })
}

function handleTableSort(column: string, direction: 'asc' | 'desc') {
  // Sorting is handled by the table component itself
  console.log(`Sorting by ${column} ${direction}`)
}

function navigateToUpload() {
  router.push('/dosmupload')
}

function handleClearData() {
  if (confirm('Are you sure you want to clear all CPI data?')) {
    clearData()
    router.push('/dosmupload')
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <UCard class="mb-6">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <h1 class="text-2xl font-bold mb-2">DOSM CPI Dashboard</h1>
          <div v-if="hasData" class="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>
              <Icon name="i-lucide-calendar" class="h-4 w-4 inline mr-1" />
              Last updated: {{ formattedLastUpdated }}
            </span>
            <span>
              <Icon name="i-lucide-database" class="h-4 w-4 inline mr-1" />
              {{ cpiData?.metadata.recordCount.toLocaleString() }} records
            </span>
            <span v-if="basicStats">
              <Icon name="i-lucide-calendar-range" class="h-4 w-4 inline mr-1" />
              {{ basicStats.dateRange.start.substring(0, 4) }} -
              {{ basicStats.dateRange.end.substring(0, 4) }}
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <UButton
            icon="i-lucide-upload"
            variant="soft"
            @click="navigateToUpload"
          >
            Upload New Data
          </UButton>
          <UButton
            icon="i-lucide-trash-2"
            color="red"
            variant="soft"
            @click="handleClearData"
          >
            Clear Data
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- No data state -->
    <UCard v-if="!hasData && !isLoading" class="text-center py-12">
      <Icon name="i-lucide-inbox" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h2 class="text-xl font-semibold mb-2">No CPI Data Available</h2>
      <p class="text-gray-500 mb-4">Upload DOSM CPI data to start analyzing inflation trends.</p>
      <UButton
        icon="i-lucide-upload"
        color="primary"
        @click="navigateToUpload"
      >
        Upload CPI Data
      </UButton>
    </UCard>

    <!-- Loading state -->
    <div v-if="isLoading" class="space-y-4">
      <div class="h-32 bg-gray-100 animate-pulse rounded" />
      <div class="h-96 bg-gray-100 animate-pulse rounded" />
    </div>

    <!-- Error state -->
    <UAlert
      v-if="error"
      color="red"
      icon="i-lucide-alert-circle"
      title="Error loading data"
      :description="error"
      class="mb-6"
    />

    <!-- Dashboard content -->
    <div v-if="hasData && !isLoading" class="space-y-6">
      <!-- Summary Statistics -->
      <div v-if="basicStats" class="grid grid-cols-4 gap-4">
        <UCard>
          <div class="text-center">
            <Icon name="i-lucide-database" class="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p class="text-sm text-gray-500">Total Records</p>
            <p class="text-2xl font-bold">{{ basicStats.totalRecords.toLocaleString() }}</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <Icon name="i-lucide-calendar-range" class="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p class="text-sm text-gray-500">Date Range</p>
            <p class="text-lg font-bold">
              {{ basicStats.dateRange.start.substring(0, 4) }} -
              {{ basicStats.dateRange.end.substring(0, 4) }}
            </p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <Icon name="i-lucide-pie-chart" class="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <p class="text-sm text-gray-500">Divisions</p>
            <p class="text-2xl font-bold">{{ basicStats.numberOfDivisions }}</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <Icon name="i-lucide-trending-up" class="h-8 w-8 text-orange-500 mx-auto mb-2" />
            <p class="text-sm text-gray-500">Latest Year</p>
            <p class="text-2xl font-bold">{{ basicStats.latestYear }}</p>
          </div>
        </UCard>
      </div>

      <!-- Filter Controls -->
      <UCard>
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <label class="text-sm font-medium text-gray-700 mb-1 block">Filter by Division</label>
            <USelectMenu
              v-model="selectedDivision"
              :options="divisionOptions"
              value-attribute="value"
              option-attribute="label"
            />
          </div>

          <div class="flex items-end gap-2">
            <UButton
              icon="i-lucide-rotate-ccw"
              variant="soft"
              @click="resetFilters"
            >
              Reset Filters
            </UButton>
            <UButton
              icon="i-lucide-download"
              color="primary"
              variant="soft"
              @click="handleExportData"
            >
              Export Data
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 gap-6">
        <!-- Line Chart (Full Width) -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Inflation Trend Over Time</h3>
          </template>
          <DOSMInflationLineChart
            :data="filteredDataForLineChart"
            :division="selectedDivision === 'all' ? 'overall' : selectedDivision"
          />
        </UCard>

        <!-- Bar Chart and Comparison Chart (Side by Side) -->
        <div class="grid grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <h3 class="font-semibold">Division Comparison (Latest Year)</h3>
            </template>
            <DOSMDivisionBarChart :data="dataForBarChart" />
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold">Multi-Division Comparison</h3>
                <UButton
                  size="xs"
                  variant="soft"
                  @click="selectedComparisonDivisions = ['overall', '01', '02', '03']"
                >
                  Reset
                </UButton>
              </div>
            </template>
            <div class="mb-4">
              <USelectMenu
                v-model="selectedComparisonDivisions"
                :options="comparisonDivisionOptions"
                value-attribute="value"
                option-attribute="label"
                multiple
                placeholder="Select divisions to compare"
              />
            </div>
            <DOSMComparisonChart
              :data="dataForComparisonChart"
              :divisions="selectedComparisonDivisions"
            />
          </UCard>
        </div>
      </div>

      <!-- Data Table -->
      <DOSMCPIDataTable
        :data="filteredDataForTable"
        :loading="isLoading"
        @sort="handleTableSort"
        @export="handleExportData"
      />
    </div>
  </div>
</template>
