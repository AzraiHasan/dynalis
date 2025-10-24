<script setup lang="ts">
import { format } from 'date-fns'
import Papa from 'papaparse'
import type { MetricType } from '~/types/gdp'
import { useGDPStore } from '~/stores/gdpStore'
import { useGDPGNIData } from '~/composables/useGDPGNIData'

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'GDP/GNI Dashboard - Dynalis',
})

const router = useRouter()
const toast = useToast()
const { gdpGniData, lastUploadedAt, loadFromCache } = useGDPStore()
const {
  filterBySeriesType,
  filterByDateRange,
  getMilestonesInRange,
} = useGDPGNIData()

// Load data on mount
onMounted(() => {
  loadFromCache()

  // Redirect to upload page if no data
  if (!gdpGniData.value) {
    router.push('/dosmgdp')
  }
})

// State
const selectedMetric = ref<MetricType>('gdp')
const startYear = ref(1970)
const endYear = ref(2024)
const showMilestones = ref(true)
const viewMode = ref<'charts' | 'table'>('charts')

// Computed
const absRecords = computed(() =>
  gdpGniData.value ? filterBySeriesType(gdpGniData.value.records, 'abs') : [],
)

const growthRecords = computed(() =>
  gdpGniData.value ? filterBySeriesType(gdpGniData.value.records, 'growth_yoy') : [],
)

const filteredAbsRecords = computed(() =>
  filterByDateRange(absRecords.value, startYear.value, endYear.value),
)

const currentMilestones = computed(() =>
  getMilestonesInRange(startYear.value, endYear.value),
)

const latestAbsRecord = computed(() =>
  absRecords.value[absRecords.value.length - 1],
)

const latestGrowthRecord = computed(() =>
  growthRecords.value[growthRecords.value.length - 1],
)

const metricOptions = [
  { label: 'GDP', value: 'gdp', icon: 'i-lucide-trending-up' },
  { label: 'GNI', value: 'gni', icon: 'i-lucide-wallet' },
  { label: 'GDP per Capita', value: 'gdp_capita', icon: 'i-lucide-user' },
  { label: 'GNI per Capita', value: 'gni_capita', icon: 'i-lucide-users' },
]

// Table data - combined view
const tableData = computed(() => {
  const years = new Set<number>()

  // Collect all years
  absRecords.value.forEach((r) => {
    const year = new Date(r.date).getFullYear()
    if (year >= startYear.value && year <= endYear.value) {
      years.add(year)
    }
  })

  // Create row for each year
  return Array.from(years)
    .sort((a, b) => b - a) // Descending order
    .map((year) => {
      const absRecord = absRecords.value.find(r => new Date(r.date).getFullYear() === year)
      const growthRecord = growthRecords.value.find(r => new Date(r.date).getFullYear() === year)

      return {
        year,
        gdp_abs: absRecord?.gdp ?? 0,
        gni_abs: absRecord?.gni ?? 0,
        gdp_capita_abs: absRecord?.gdp_capita ?? 0,
        gni_capita_abs: absRecord?.gni_capita ?? 0,
        gdp_growth: growthRecord?.gdp ?? 0,
        gni_growth: growthRecord?.gni ?? 0,
        gdp_capita_growth: growthRecord?.gdp_capita ?? 0,
        gni_capita_growth: growthRecord?.gni_capita ?? 0,
      }
    })
})

// Actions
function setQuickRange(years: number) {
  const currentYear = 2024
  startYear.value = currentYear - years + 1
  endYear.value = currentYear
}

function resetFilters() {
  selectedMetric.value = 'gdp'
  startYear.value = 1970
  endYear.value = 2024
  showMilestones.value = true
  viewMode.value = 'charts'
}

function exportToCSV() {
  try {
    const csv = Papa.unparse(tableData.value)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gdp-gni-export-${startYear.value}-${endYear.value}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.add({
      title: 'Export Successful',
      description: 'Data exported to CSV',
      color: 'green',
    })
  }
  catch {
    toast.add({
      title: 'Export Failed',
      description: 'Failed to export data',
      color: 'red',
    })
  }
}

function refreshData() {
  loadFromCache()
  toast.add({
    title: 'Data Refreshed',
    description: 'Latest data loaded from cache',
    color: 'green',
  })
}

// Format helpers
function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'MMM dd, yyyy, HH:mm')
}

function getGrowthColor(value: number): string {
  return value >= 0 ? 'text-green-600' : 'text-red-600'
}

function getTrendIcon(value: number): string {
  return value >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
}

// Calculate year-over-year change for absolute values
function calculateYoYChange(metric: MetricType): number {
  if (absRecords.value.length < 2) return 0

  const latest = absRecords.value[absRecords.value.length - 1]
  const previous = absRecords.value[absRecords.value.length - 2]

  const latestValue = latest[metric]
  const previousValue = previous[metric]

  return ((latestValue - previousValue) / previousValue) * 100
}
</script>

<template>
  <div v-if="gdpGniData" class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-3xl font-bold">
            GDP & GNI Analytics Dashboard
          </h1>
          <p class="text-gray-500 mt-1">
            Annual Real Values (1970-2024)
          </p>
        </div>

        <div class="flex gap-2">
          <UButton
            icon="i-lucide-upload"
            variant="outline"
            @click="router.push('/dosmgdp')"
          >
            Upload New Data
          </UButton>
          <UButton
            icon="i-lucide-download"
            variant="outline"
            @click="exportToCSV"
          >
            Export CSV
          </UButton>
          <UButton
            icon="i-lucide-refresh-cw"
            variant="outline"
            @click="refreshData"
          >
            Refresh
          </UButton>
        </div>
      </div>

      <!-- Metadata Badges -->
      <div class="flex flex-wrap gap-2">
        <UBadge color="gray" variant="soft">
          <UIcon name="i-lucide-clock" class="w-3 h-3 mr-1" />
          Last uploaded: {{ lastUploadedAt ? formatDate(lastUploadedAt) : 'N/A' }}
        </UBadge>
        <UBadge color="blue" variant="soft">
          <UIcon name="i-lucide-database" class="w-3 h-3 mr-1" />
          {{ gdpGniData.metadata.recordCount }} records
        </UBadge>
        <UBadge color="green" variant="soft">
          <UIcon name="i-lucide-calendar" class="w-3 h-3 mr-1" />
          {{ new Date(gdpGniData.metadata.dateRange.start).getFullYear() }}-{{ new Date(gdpGniData.metadata.dateRange.end).getFullYear() }}
        </UBadge>
        <UBadge color="purple" variant="soft">
          <UIcon name="i-lucide-building" class="w-3 h-3 mr-1" />
          <a href="https://open.dosm.gov.my" target="_blank" class="hover:underline">
            DOSM Official Data
          </a>
        </UBadge>
      </div>
    </div>

    <!-- Filter Controls -->
    <UCard class="mb-8">
      <template #header>
        <h2 class="text-lg font-semibold">
          Filters & Controls
        </h2>
      </template>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Metric Selector -->
        <div>
          <label class="block text-sm font-medium mb-2">Metric</label>
          <USelectMenu
            v-model="selectedMetric"
            :options="metricOptions"
            value-attribute="value"
            option-attribute="label"
          >
            <template #label>
              <div class="flex items-center gap-2">
                <UIcon :name="metricOptions.find(m => m.value === selectedMetric)?.icon || 'i-lucide-trending-up'" class="w-4 h-4" />
                {{ metricOptions.find(m => m.value === selectedMetric)?.label }}
              </div>
            </template>
          </USelectMenu>
        </div>

        <!-- Date Range -->
        <div>
          <label class="block text-sm font-medium mb-2">Start Year</label>
          <UInput
            v-model.number="startYear"
            type="number"
            :min="1970"
            :max="endYear"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">End Year</label>
          <UInput
            v-model.number="endYear"
            type="number"
            :min="startYear"
            :max="2024"
          />
        </div>

        <!-- Quick Range Buttons -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium mb-2">Quick Ranges</label>
          <div class="flex gap-2 flex-wrap">
            <UButton variant="outline" size="sm" @click="setQuickRange(5)">
              Last 5 Years
            </UButton>
            <UButton variant="outline" size="sm" @click="setQuickRange(10)">
              Last 10 Years
            </UButton>
            <UButton variant="outline" size="sm" @click="setQuickRange(20)">
              Last 20 Years
            </UButton>
            <UButton variant="outline" size="sm" @click="startYear = 1970; endYear = 2024">
              All Time
            </UButton>
          </div>
        </div>

        <!-- View Mode & Milestones -->
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">View Mode</label>
            <UButtonGroup class="w-full">
              <UButton
                :variant="viewMode === 'charts' ? 'solid' : 'outline'"
                class="flex-1"
                @click="viewMode = 'charts'"
              >
                Charts
              </UButton>
              <UButton
                :variant="viewMode === 'table' ? 'solid' : 'outline'"
                class="flex-1"
                @click="viewMode = 'table'"
              >
                Table
              </UButton>
            </UButtonGroup>
          </div>

          <div class="flex items-center gap-2">
            <USwitch v-model="showMilestones" />
            <span class="text-sm">Show Historical Milestones</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton variant="ghost" @click="resetFilters">
            Reset All Filters
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Summary Statistics Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <!-- Latest GDP -->
      <UCard>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500">Latest GDP</span>
            <UIcon :name="getTrendIcon(calculateYoYChange('gdp'))" class="w-4 h-4" :class="getGrowthColor(calculateYoYChange('gdp'))" />
          </div>
          <p class="text-2xl font-bold">
            RM {{ formatNumber(latestAbsRecord?.gdp || 0, 0) }}M
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestAbsRecord?.date || '').getFullYear() }}
          </p>
          <UBadge
            :color="calculateYoYChange('gdp') >= 0 ? 'green' : 'red'"
            variant="soft"
            class="mt-2"
          >
            {{ calculateYoYChange('gdp') >= 0 ? '+' : '' }}{{ formatNumber(calculateYoYChange('gdp'), 2) }}% YoY
          </UBadge>
        </div>
      </UCard>

      <!-- Latest GNI -->
      <UCard>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500">Latest GNI</span>
            <UIcon :name="getTrendIcon(calculateYoYChange('gni'))" class="w-4 h-4" :class="getGrowthColor(calculateYoYChange('gni'))" />
          </div>
          <p class="text-2xl font-bold">
            RM {{ formatNumber(latestAbsRecord?.gni || 0, 0) }}M
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestAbsRecord?.date || '').getFullYear() }}
          </p>
          <UBadge
            :color="calculateYoYChange('gni') >= 0 ? 'green' : 'red'"
            variant="soft"
            class="mt-2"
          >
            {{ calculateYoYChange('gni') >= 0 ? '+' : '' }}{{ formatNumber(calculateYoYChange('gni'), 2) }}% YoY
          </UBadge>
        </div>
      </UCard>

      <!-- Latest GDP per Capita -->
      <UCard>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500">GDP per Capita</span>
            <UIcon :name="getTrendIcon(calculateYoYChange('gdp_capita'))" class="w-4 h-4" :class="getGrowthColor(calculateYoYChange('gdp_capita'))" />
          </div>
          <p class="text-2xl font-bold">
            RM {{ formatNumber(latestAbsRecord?.gdp_capita || 0, 2) }}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestAbsRecord?.date || '').getFullYear() }}
          </p>
          <UBadge
            :color="calculateYoYChange('gdp_capita') >= 0 ? 'green' : 'red'"
            variant="soft"
            class="mt-2"
          >
            {{ calculateYoYChange('gdp_capita') >= 0 ? '+' : '' }}{{ formatNumber(calculateYoYChange('gdp_capita'), 2) }}% YoY
          </UBadge>
        </div>
      </UCard>

      <!-- Latest GNI per Capita -->
      <UCard>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500">GNI per Capita</span>
            <UIcon :name="getTrendIcon(calculateYoYChange('gni_capita'))" class="w-4 h-4" :class="getGrowthColor(calculateYoYChange('gni_capita'))" />
          </div>
          <p class="text-2xl font-bold">
            RM {{ formatNumber(latestAbsRecord?.gni_capita || 0, 2) }}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestAbsRecord?.date || '').getFullYear() }}
          </p>
          <UBadge
            :color="calculateYoYChange('gni_capita') >= 0 ? 'green' : 'red'"
            variant="soft"
            class="mt-2"
          >
            {{ calculateYoYChange('gni_capita') >= 0 ? '+' : '' }}{{ formatNumber(calculateYoYChange('gni_capita'), 2) }}% YoY
          </UBadge>
        </div>
      </UCard>
    </div>

    <!-- Growth Rates Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <UCard>
        <div>
          <span class="text-sm text-gray-500">GDP Growth</span>
          <p class="text-2xl font-bold" :class="getGrowthColor(latestGrowthRecord?.gdp || 0)">
            {{ formatNumber(latestGrowthRecord?.gdp || 0, 2) }}%
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestGrowthRecord?.date || '').getFullYear() }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div>
          <span class="text-sm text-gray-500">GNI Growth</span>
          <p class="text-2xl font-bold" :class="getGrowthColor(latestGrowthRecord?.gni || 0)">
            {{ formatNumber(latestGrowthRecord?.gni || 0, 2) }}%
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestGrowthRecord?.date || '').getFullYear() }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div>
          <span class="text-sm text-gray-500">GDP/Capita Growth</span>
          <p class="text-2xl font-bold" :class="getGrowthColor(latestGrowthRecord?.gdp_capita || 0)">
            {{ formatNumber(latestGrowthRecord?.gdp_capita || 0, 2) }}%
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestGrowthRecord?.date || '').getFullYear() }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div>
          <span class="text-sm text-gray-500">GNI/Capita Growth</span>
          <p class="text-2xl font-bold" :class="getGrowthColor(latestGrowthRecord?.gni_capita || 0)">
            {{ formatNumber(latestGrowthRecord?.gni_capita || 0, 2) }}%
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ new Date(latestGrowthRecord?.date || '').getFullYear() }}
          </p>
        </div>
      </UCard>
    </div>

    <!-- Metric Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <DOSMGDPMetricCard
        metric="gdp"
        :abs-records="absRecords"
        :growth-records="growthRecords"
      />
      <DOSMGDPMetricCard
        metric="gni"
        :abs-records="absRecords"
        :growth-records="growthRecords"
      />
      <DOSMGDPMetricCard
        metric="gdp_capita"
        :abs-records="absRecords"
        :growth-records="growthRecords"
      />
      <DOSMGDPMetricCard
        metric="gni_capita"
        :abs-records="absRecords"
        :growth-records="growthRecords"
      />
    </div>

    <!-- Charts Section -->
    <div v-if="viewMode === 'charts'" class="mb-8 space-y-6">
      <!-- Dual-Axis Chart for Selected Metric -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            {{ metricOptions.find(m => m.value === selectedMetric)?.label }} - Dual Axis View
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            Absolute values and growth rates over time
          </p>
        </template>

        <DOSMGDPDualAxisChart
          :metric="selectedMetric"
          :abs-records="filteredAbsRecords"
          :growth-records="growthRecords.filter(r => {
            const year = new Date(r.date).getFullYear()
            return year >= startYear && year <= endYear
          })"
          :milestones="currentMilestones"
          :show-milestones="showMilestones"
        />
      </UCard>

      <!-- All Metrics Comparison - Absolute Values -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            All Metrics Comparison - Absolute Values
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            Compare GDP, GNI, and per capita values
          </p>
        </template>

        <DOSMGDPComparisonChart
          :abs-records="filteredAbsRecords"
          series-type="abs"
        />
      </UCard>

      <!-- All Metrics Comparison - Growth Rates -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">
            All Metrics Comparison - Growth Rates
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            Compare year-over-year growth rates
          </p>
        </template>

        <DOSMGDPComparisonChart
          :abs-records="growthRecords.filter(r => {
            const year = new Date(r.date).getFullYear()
            return year >= startYear && year <= endYear
          })"
          series-type="growth"
        />
      </UCard>

      <!-- Historical Milestones -->
      <UCard v-if="showMilestones && currentMilestones.length > 0" class="mt-6">
        <template #header>
          <h2 class="text-lg font-semibold">
            Historical Milestones ({{ startYear }}-{{ endYear }})
          </h2>
        </template>

        <div class="space-y-4">
          <div
            v-for="milestone in currentMilestones"
            :key="milestone.year"
            class="flex gap-4 p-4 rounded-lg"
            :class="{
              'bg-red-50': milestone.impact === 'crisis',
              'bg-green-50': milestone.impact === 'recovery',
              'bg-blue-50': milestone.impact === 'milestone',
            }"
          >
            <div class="flex-shrink-0">
              <UBadge
                :color="milestone.impact === 'crisis' ? 'red' : milestone.impact === 'recovery' ? 'green' : 'blue'"
                size="lg"
              >
                {{ milestone.year }}
              </UBadge>
            </div>
            <div>
              <p class="font-semibold">
                {{ milestone.event }}
              </p>
              <p class="text-sm text-gray-600 mt-1">
                {{ milestone.description }}
              </p>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Data Table -->
    <div v-if="viewMode === 'table'">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">
              Complete Data Table
            </h2>
            <span class="text-sm text-gray-500">
              {{ tableData.length }} years
            </span>
          </div>
        </template>

        <UTable
          :rows="tableData"
          :columns="[
            { key: 'year', label: 'Year', sortable: true },
            { key: 'gdp_abs', label: 'GDP (RM M)' },
            { key: 'gdp_growth', label: 'GDP Growth (%)' },
            { key: 'gni_abs', label: 'GNI (RM M)' },
            { key: 'gni_growth', label: 'GNI Growth (%)' },
            { key: 'gdp_capita_abs', label: 'GDP/Capita (RM)' },
            { key: 'gdp_capita_growth', label: 'GDP/Capita Growth (%)' },
            { key: 'gni_capita_abs', label: 'GNI/Capita (RM)' },
            { key: 'gni_capita_growth', label: 'GNI/Capita Growth (%)' },
          ]"
        >
          <template #gdp_abs-data="{ row }">
            {{ formatNumber(row.gdp_abs, 0) }}
          </template>
          <template #gdp_growth-data="{ row }">
            <span :class="getGrowthColor(row.gdp_growth)">
              {{ formatNumber(row.gdp_growth, 2) }}%
            </span>
          </template>
          <template #gni_abs-data="{ row }">
            {{ formatNumber(row.gni_abs, 0) }}
          </template>
          <template #gni_growth-data="{ row }">
            <span :class="getGrowthColor(row.gni_growth)">
              {{ formatNumber(row.gni_growth, 2) }}%
            </span>
          </template>
          <template #gdp_capita_abs-data="{ row }">
            {{ formatNumber(row.gdp_capita_abs, 2) }}
          </template>
          <template #gdp_capita_growth-data="{ row }">
            <span :class="getGrowthColor(row.gdp_capita_growth)">
              {{ formatNumber(row.gdp_capita_growth, 2) }}%
            </span>
          </template>
          <template #gni_capita_abs-data="{ row }">
            {{ formatNumber(row.gni_capita_abs, 2) }}
          </template>
          <template #gni_capita_growth-data="{ row }">
            <span :class="getGrowthColor(row.gni_capita_growth)">
              {{ formatNumber(row.gni_capita_growth, 2) }}%
            </span>
          </template>
        </UTable>
      </UCard>
    </div>
  </div>

  <!-- No Data State -->
  <div v-else class="container mx-auto px-4 py-16 text-center">
    <UIcon name="i-lucide-database" class="w-16 h-16 mx-auto text-gray-400 mb-4" />
    <h2 class="text-2xl font-bold mb-2">
      No Data Available
    </h2>
    <p class="text-gray-500 mb-6">
      Please upload GDP/GNI data to view the dashboard
    </p>
    <UButton size="lg" @click="router.push('/dosmgdp')">
      Upload Data
    </UButton>
  </div>
</template>
