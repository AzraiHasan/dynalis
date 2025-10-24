<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import type { GDPGNIRecord } from '~/types/gdp'

Chart.register(...registerables)

interface Props {
  absRecords: GDPGNIRecord[]
  seriesType: 'abs' | 'growth'
}

const props = defineProps<Props>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

function createChart() {
  if (!chartCanvas.value) return

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy()
  }

  // Prepare data
  const labels = props.absRecords.map(r => new Date(r.date).getFullYear())
  const gdpData = props.absRecords.map(r => r.gdp)
  const gniData = props.absRecords.map(r => r.gni)
  const gdpCapitaData = props.absRecords.map(r => r.gdp_capita)
  const gniCapitaData = props.absRecords.map(r => r.gni_capita)

  const isGrowth = props.seriesType === 'growth'

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: isGrowth ? 'GDP Growth' : 'GDP',
          data: gdpData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          yAxisID: 'y',
          tension: 0.3,
        },
        {
          label: isGrowth ? 'GNI Growth' : 'GNI',
          data: gniData,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          yAxisID: 'y',
          tension: 0.3,
        },
        {
          label: isGrowth ? 'GDP/Capita Growth' : 'GDP per Capita',
          data: gdpCapitaData,
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          yAxisID: isGrowth ? 'y' : 'y1',
          tension: 0.3,
          borderDash: [5, 5],
        },
        {
          label: isGrowth ? 'GNI/Capita Growth' : 'GNI per Capita',
          data: gniCapitaData,
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          yAxisID: isGrowth ? 'y' : 'y1',
          tension: 0.3,
          borderDash: [5, 5],
        },
      ],
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
              if (isGrowth) {
                return `${label}: ${value.toFixed(2)}%`
              }
              else {
                return `${label}: ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            },
          },
        },
      },
      scales: {
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
            text: isGrowth ? 'Growth Rate (%)' : 'GDP/GNI (RM millions)',
          },
          ticks: {
            callback: (value) => {
              return isGrowth ? `${value}%` : value.toLocaleString()
            },
          },
        },
        y1: isGrowth
          ? undefined
          : {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Per Capita (RM)',
              },
              grid: {
                drawOnChartArea: false,
              },
              ticks: {
                callback: (value) => {
                  return value.toLocaleString()
                },
              },
            },
      },
    },
  })
}

// Watch for changes and recreate chart
watch(
  () => [props.absRecords, props.seriesType],
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
