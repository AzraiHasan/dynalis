<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions
} from 'chart.js'
import type { CPIRecord } from '~/types/cpi'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface Props {
  data: CPIRecord[]
  divisions?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  divisions: () => ['overall', '01', '02', '03']
})

// Color palette for divisions
const colorPalette = [
  'rgb(59, 130, 246)',   // blue
  'rgb(239, 68, 68)',    // red
  'rgb(34, 197, 94)',    // green
  'rgb(234, 179, 8)',    // yellow
  'rgb(168, 85, 247)',   // purple
  'rgb(236, 72, 153)',   // pink
  'rgb(14, 165, 233)',   // sky
  'rgb(249, 115, 22)',   // orange
  'rgb(6, 182, 212)',    // cyan
  'rgb(132, 204, 22)',   // lime
  'rgb(244, 63, 94)',    // rose
  'rgb(139, 92, 246)',   // violet
  'rgb(20, 184, 166)',   // teal
  'rgb(251, 146, 60)'    // amber
]

// Process data for chart
const chartData = computed(() => {
  // Get all unique years across all data
  const allYears = [...new Set(props.data.map(r => r.date.substring(0, 4)))].sort()

  // Create a dataset for each division
  const datasets = props.divisions.map((division, index) => {
    const divisionData = props.data
      .filter(r => r.division === division)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Map data to years
    const yearMap = new Map(divisionData.map(r => [r.date.substring(0, 4), r.inflation]))
    const values = allYears.map(year => yearMap.get(year) ?? null)

    const color = colorPalette[index % colorPalette.length]

    return {
      label: division === 'overall' ? 'Overall' : `Division ${division}`,
      data: values,
      borderColor: color,
      backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 4,
      spanGaps: true
    }
  })

  return {
    labels: allYears,
    datasets
  }
})

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      onClick: (e, legendItem, legend) => {
        // Toggle dataset visibility
        const index = legendItem.datasetIndex!
        const chart = legend.chart
        const meta = chart.getDatasetMeta(index)

        meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null
        chart.update()
      }
    },
    title: {
      display: true,
      text: 'Division Comparison Over Time'
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return `${context.dataset.label}: ${context.parsed.y?.toFixed(2) ?? 'N/A'}%`
        }
      }
    }
  },
  scales: {
    y: {
      title: {
        display: true,
        text: 'Inflation Rate (%)'
      },
      ticks: {
        callback: (value) => `${value}%`
      }
    },
    x: {
      title: {
        display: true,
        text: 'Year'
      }
    }
  }
}
</script>

<template>
  <div class="w-full h-[400px]">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
