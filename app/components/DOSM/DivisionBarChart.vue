<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
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
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface Props {
  data: CPIRecord[]
  year?: number
}

const props = defineProps<Props>()

// Process data for chart
const chartData = computed(() => {
  // Filter by year if specified, otherwise use latest year
  let filteredData = props.data

  if (props.year) {
    const yearStr = props.year.toString()
    filteredData = props.data.filter(r => r.date.startsWith(yearStr))
  } else {
    // Get latest year
    const years = props.data.map(r => parseInt(r.date.substring(0, 4)))
    const latestYear = Math.max(...years)
    filteredData = props.data.filter(r => r.date.startsWith(latestYear.toString()))
  }

  // Group by division and calculate average if multiple entries
  const divisionMap = new Map<string, number[]>()
  filteredData.forEach(r => {
    if (!divisionMap.has(r.division)) {
      divisionMap.set(r.division, [])
    }
    divisionMap.get(r.division)!.push(r.inflation)
  })

  // Calculate averages and sort
  const divisions: string[] = []
  const values: number[] = []

  Array.from(divisionMap.entries())
    .sort((a, b) => {
      // Sort: overall first, then numerically
      if (a[0] === 'overall') return -1
      if (b[0] === 'overall') return 1
      return a[0].localeCompare(b[0])
    })
    .forEach(([division, inflationValues]) => {
      divisions.push(division === 'overall' ? 'Overall' : `Division ${division}`)
      const avg = inflationValues.reduce((sum, v) => sum + v, 0) / inflationValues.length
      values.push(avg)
    })

  return {
    labels: divisions,
    datasets: [
      {
        label: 'Inflation Rate (%)',
        data: values,
        backgroundColor: values.map(v =>
          v < 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)' // red for negative, green for positive
        ),
        borderColor: values.map(v =>
          v < 0 ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)'
        ),
        borderWidth: 1
      }
    ]
  }
})

const chartYear = computed(() => {
  if (props.year) return props.year
  const years = props.data.map(r => parseInt(r.date.substring(0, 4)))
  return Math.max(...years)
})

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: true,
      text: `Inflation by Division (${chartYear.value})`
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return `Inflation: ${context.parsed.y.toFixed(2)}%`
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
        text: 'Division'
      }
    }
  }
}
</script>

<template>
  <div class="w-full h-[400px]">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
