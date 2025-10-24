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
  division?: string
}

const props = withDefaults(defineProps<Props>(), {
  division: 'overall'
})

// Process data for chart
const chartData = computed(() => {
  // Filter by division
  const filteredData = props.data
    .filter(r => r.division === props.division)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Extract years and inflation values
  const labels = filteredData.map(r => r.date.substring(0, 4)) // Extract year
  const values = filteredData.map(r => r.inflation)

  return {
    labels,
    datasets: [
      {
        label: `Inflation Rate (${props.division === 'overall' ? 'Overall' : 'Division ' + props.division})`,
        data: values,
        borderColor: 'rgb(59, 130, 246)', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  }
})

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    },
    title: {
      display: true,
      text: 'CPI Inflation Trend Over Time'
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
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
