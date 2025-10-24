<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import type { GDPGNIRecord, MetricType } from '~/types/gdp'

Chart.register(...registerables)

interface Props {
  metric: MetricType
  absRecords: GDPGNIRecord[]
  growthRecords: GDPGNIRecord[]
}

const props = defineProps<Props>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const metricLabels: Record<MetricType, { name: string; unit: string; icon: string }> = {
  gdp: { name: 'GDP', unit: 'RM millions', icon: 'i-lucide-trending-up' },
  gni: { name: 'GNI', unit: 'RM millions', icon: 'i-lucide-wallet' },
  gdp_capita: { name: 'GDP per Capita', unit: 'RM', icon: 'i-lucide-user' },
  gni_capita: { name: 'GNI per Capita', unit: 'RM', icon: 'i-lucide-users' },
}

const metricInfo = computed(() => metricLabels[props.metric])

const latestValue = computed(() => {
  const latest = props.absRecords[props.absRecords.length - 1]
  return latest ? latest[props.metric] : 0
})

const latestYear = computed(() => {
  const latest = props.absRecords[props.absRecords.length - 1]
  return latest ? new Date(latest.date).getFullYear() : 0
})

const latestGrowth = computed(() => {
  const latest = props.growthRecords[props.growthRecords.length - 1]
  return latest ? latest[props.metric] : 0
})

const stats = computed(() => {
  const values = props.absRecords.map(r => r[props.metric])
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((sum, v) => sum + v, 0) / values.length,
  }
})

function createChart() {
  if (!chartCanvas.value) return

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy()
  }

  // Prepare data - last 10 years for mini chart
  const recentRecords = props.absRecords.slice(-10)
  const labels = recentRecords.map(r => new Date(r.date).getFullYear())
  const data = recentRecords.map(r => r[props.metric])

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
        },
      },
    },
  })
}

watch(
  () => [props.metric, props.absRecords],
  () => {
    createChart()
  },
  { deep: true },
)

onMounted(() => {
  createChart()
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon :name="metricInfo.icon" class="w-5 h-5 text-blue-500" />
          <span class="font-semibold">{{ metricInfo.name }}</span>
        </div>
        <UBadge color="gray" variant="soft">
          {{ latestYear }}
        </UBadge>
      </div>

      <!-- Latest Value -->
      <div>
        <p class="text-3xl font-bold">
          {{ formatNumber(latestValue, metric.includes('capita') ? 2 : 0) }}
        </p>
        <p class="text-sm text-gray-500">
          {{ metricInfo.unit }}
        </p>
      </div>

      <!-- Growth Badge -->
      <div>
        <UBadge
          :color="latestGrowth >= 0 ? 'green' : 'red'"
          variant="soft"
          size="lg"
        >
          <UIcon
            :name="latestGrowth >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
            class="w-3 h-3 mr-1"
          />
          {{ latestGrowth >= 0 ? '+' : '' }}{{ formatNumber(latestGrowth, 2) }}% YoY
        </UBadge>
      </div>

      <!-- Mini Chart -->
      <div class="relative w-full" style="height: 80px;">
        <canvas ref="chartCanvas" />
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
        <div class="text-center">
          <p class="text-xs text-gray-500">
            Min
          </p>
          <p class="text-sm font-semibold">
            {{ formatNumber(stats.min, 0) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-500">
            Avg
          </p>
          <p class="text-sm font-semibold">
            {{ formatNumber(stats.avg, 0) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-500">
            Max
          </p>
          <p class="text-sm font-semibold">
            {{ formatNumber(stats.max, 0) }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
