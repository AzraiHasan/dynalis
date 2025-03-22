<!-- pages/dashboard.vue -->

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">Dashboard</h1>
    
    <!-- Rental Distribution Chart -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Rental Distribution</h2>
      </template>
      <ClientOnly>
        <Bar
          v-if="rentalChartData"
          :data="rentalChartData"
          :options="chartOptions"
          class="h-[300px]"
        />
      </ClientOnly>
    </UCard>

    <!-- Contract Expiration Chart -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Contract Expiration Status</h2>
      </template>
      <ClientOnly>
        <Doughnut
          v-if="expirationChartData"
          :data="expirationChartData"
          :options="chartOptions"
          class="h-[300px]"
        />
      </ClientOnly>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'

// Register ChartJS components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
)

const router = useRouter()

// Chart configuration
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
}

// Initialize chart data with proper type
interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor: string[]
    borderColor: string[]
    borderWidth: number
  }[]
}

const rentalChartData = ref<ChartData | null>(null)
const expirationChartData = ref<ChartData | null>(null)

// Helper function to calculate rental ranges
const calculateRentalRanges = (data: any[]) => {
  const ranges = {
    '0-1000': 0,
    '1001-5000': 0,
    '5001-10000': 0,
    '10000+': 0
  }

  data.forEach(row => {
    const rental = parseFloat(row['TOTAL RENTAL (RM)']?.replace(/[RM,\s]/g, '') || '0')
    if (rental <= 1000) ranges['0-1000']++
    else if (rental <= 5000) ranges['1001-5000']++
    else if (rental <= 10000) ranges['5001-10000']++
    else ranges['10000+']++
  })

  return ranges
}

// Helper function to calculate expiration status
const calculateExpirationStatus = (data: any[]) => {
  const status = {
    expired: 0,
    within30Days: 0,
    within60Days: 0,
    within90Days: 0,
    valid: 0
  }

  data.forEach(row => {
    const expDate = new Date(row['EXP DATE'])
    const today = new Date()
    const daysUntil = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil <= 0) status.expired++
    else if (daysUntil <= 30) status.within30Days++
    else if (daysUntil <= 60) status.within60Days++
    else if (daysUntil <= 90) status.within90Days++
    else status.valid++
  })

  return status
}

onMounted(() => {
  try {
    const stored = localStorage.getItem('uploadedFileData')
    if (!stored) {
      console.log('No data found in localStorage')
      router.push('/dataupload')
      return
    }

    const data = JSON.parse(stored)
    console.log('Retrieved data:', data) // Debug log

    if (!data.fileData || !Array.isArray(data.fileData) || data.fileData.length === 0) {
      console.log('Invalid or empty data structure:', data)
      router.push('/dataupload')
      return
    }
    
    // Prepare rental distribution data
    const rentalRanges = calculateRentalRanges(data.fileData)
    console.log('Rental ranges:', rentalRanges) // Debug log
    
    rentalChartData.value = {
      labels: Object.keys(rentalRanges),
      datasets: [{
        label: 'Number of Sites',
        data: Object.values(rentalRanges),
        backgroundColor: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
        borderColor: ['#059669', '#059669', '#059669', '#059669'],
        borderWidth: 1
      }]
    }

    // Prepare expiration data
    const expirationStatus = calculateExpirationStatus(data.fileData)
    console.log('Expiration status:', expirationStatus) // Debug log
    
    expirationChartData.value = {
      labels: ['Expired', 'Within 30 Days', 'Within 60 Days', 'Within 90 Days', 'Valid'],
      datasets: [{
        data: [
          expirationStatus.expired,
          expirationStatus.within30Days,
          expirationStatus.within60Days,
          expirationStatus.within90Days,
          expirationStatus.valid
        ],
        backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#6B7280'],
        label: 'Contract Status',
        borderColor: [],
        borderWidth: 0
      }]
    }
  } catch (error) {
    console.error('Error preparing chart data:', error)
    router.push('/dataupload')
  }
})
</script>

<style>

</style>



