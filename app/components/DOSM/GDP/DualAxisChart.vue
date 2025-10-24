<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import type { GDPGNIRecord, MetricType, HistoricalMilestone } from '~/types/gdp'

Chart.register(...registerables)

interface Props {
  metric: MetricType
  absRecords: GDPGNIRecord[]
  growthRecords: GDPGNIRecord[]
  milestones?: HistoricalMilestone[]
  showMilestones?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  milestones: () => [],
  showMilestones: false,
})

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const metricLabels: Record<MetricType, string> = {
  gdp: 'GDP',
  gni: 'GNI',
  gdp_capita: 'GDP per Capita',
  gni_capita: 'GNI per Capita',
}

const metricUnits: Record<MetricType, string> = {
  gdp: 'RM millions',
  gni: 'RM millions',
  gdp_capita: 'RM',
  gni_capita: 'RM',
}

function createChart() {
  if (!chartCanvas.value) return

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy()
  }

  // Early return if no data
  if (!props.absRecords || props.absRecords.length === 0) {
    console.warn('No absolute records available for chart')
    return
  }

  // Prepare data
  const absLabels = props.absRecords.map(r => new Date(r.date).getFullYear())
  const absData = props.absRecords.map(r => r[props.metric])

  // Align growth data with absLabels - find matching year or use null
  const growthData = absLabels.map(year => {
    const growthRecord = props.growthRecords.find(r => new Date(r.date).getFullYear() === year)
    return growthRecord ? growthRecord[props.metric] : null
  })

  // Check if there's any valid growth data
  const hasGrowthData = growthData.some(val => val !== null && val !== undefined && !isNaN(val as number))

  // Create milestone annotations
  const annotations: Record<string, unknown> = {}
  if (props.showMilestones && props.milestones.length > 0) {
    props.milestones.forEach((milestone, index) => {
      annotations[`milestone${index}`] = {
        type: 'line',
        xMin: absLabels.indexOf(milestone.year),
        xMax: absLabels.indexOf(milestone.year),
        borderColor: milestone.impact === 'crisis' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          display: true,
          content: milestone.year.toString(),
          position: 'start',
        },
      }
    })
  }

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // Build datasets array
  const datasets: any[] = [
    {
      label: `${metricLabels[props.metric]} (${metricUnits[props.metric]})`,
      data: absData,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      yAxisID: 'y',
      tension: 0.3,
      fill: true,
    },
  ]

  // Only add growth dataset if there's valid data
  if (hasGrowthData) {
    datasets.push({
      label: `${metricLabels[props.metric]} Growth (%)`,
      data: growthData,
      borderColor: 'rgb(249, 115, 22)',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      yAxisID: 'y1',
      tension: 0.3,
      borderDash: [5, 5],
      spanGaps: true,
    })
  }

  // Build scales configuration
  const scalesConfig: any = {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Year',
      },
    },
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      title: {
        display: true,
        text: metricUnits[props.metric],
      },
      ticks: {
        callback: (tickValue: string | number) => {
          const value = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue
          return value.toLocaleString()
        },
      },
    },
  }

  // Add y1 axis only if there's growth data
  if (hasGrowthData) {
    scalesConfig.y1 = {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: 'Growth Rate (%)',
      },
      grid: {
        drawOnChartArea: false,
      },
      ticks: {
        callback: (tickValue: string | number) => {
          const value = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue
          return `${value.toFixed(1)}%`
        },
      },
    }
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: absLabels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || ''
              const value = context.parsed.y
              if (context.datasetIndex === 0) {
                // Absolute values
                return `${label}: ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
              else {
                // Growth rates
                return `${label}: ${value.toFixed(2)}%`
              }
            },
          },
        },
      },
      scales: scalesConfig,
    },
  })
}

// Watch for changes and recreate chart
watch(
  () => [props.metric, props.absRecords, props.growthRecords, props.showMilestones],
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
</script>

<template>
  <div class="relative w-full" style="height: 400px;">
    <canvas ref="chartCanvas" />
  </div>
</template>
