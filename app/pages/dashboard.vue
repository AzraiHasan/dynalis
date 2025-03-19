<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Data Dashboard</h1>
    
    <!-- Upload Section -->
    <UCard class="mb-4">
      <template #header>
        <h2 class="text-lg font-semibold">Upload Your File</h2>
      </template>
      
      <div class="space-y-4">
        <UInput
          type="file"
          accept=".csv,.xlsx,.xls"
          @change="handleFileChange"
        />
        
        <p v-if="selectedFileName" class="text-sm text-gray-600">
          Selected file: {{ selectedFileName }}
        </p>
        
        <p v-if="errorMessage" class="text-red-500 text-sm">
          {{ errorMessage }}
        </p>

        <div v-if="selectedFileName" class="flex gap-2">
          <UButton
            label="Process File"
            icon="i-lucide-file-check"
            @click="processFile"
            :loading="isProcessing"
          />
          <UButton
            label="Clear"
            icon="i-lucide-x"
            color="red"
            variant="soft"
            @click="clearAll"
          />
        </div>
      </div>
    </UCard>

    <!-- Data Analysis Section -->
    <div v-if="fileData.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <!-- Dataset Summary -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Dataset Summary</h2>
        </template>
        <div class="space-y-2">
          <p>Total Rows: {{ fileData.length }}</p>
          <p>Total Columns: {{ headers.length }}</p>
          <p>Column Names: {{ headers.join(', ') }}</p>
          <p>Missing Values: {{ getTotalMissingValues() }}</p>
        </div>
      </UCard>

      <!-- Column Statistics -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Column Statistics</h2>
        </template>
        <div class="space-y-4">
          <div v-for="column in headers" :key="column" class="border-b pb-2">
            <h3 class="font-medium">{{ column }}</h3>
            <div class="text-sm text-gray-600">
              Empty Cells: {{ getEmptyCellCount(column) }}
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Proceed Section -->
    <div v-if="fileData.length > 0" class="mt-6">
      <!-- Status Message -->
      <div class="mb-4 p-4 rounded-lg" :class="hasEmptyCells ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'">
        <p v-if="hasEmptyCells">
          Empty cells may cause error during further analysis, please rectify before you decide to proceed
        </p>
        <p v-else>
          You have no empty cells. Click NEXT to proceed
        </p>
      </div>

      <!-- Proceed Button -->
      <UButton
        label="Proceed"
        trailing-icon="i-lucide-arrow-right"
        variant="outline"
        :color="hasEmptyCells ? 'warning' : 'primary'"
        @click="handleProceed"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const selectedFileName = ref('')
const errorMessage = ref('')
const selectedFile = ref<File | null>(null)
const isProcessing = ref(false)
const fileData = ref<any[]>([])
const headers = ref<string[]>([])
const hasEmptyCells = computed(() => {
  return getTotalMissingValues() > 0
})

const handleFileChange = (event: Event) => {
  errorMessage.value = ''
  selectedFileName.value = ''
  fileData.value = []
  headers.value = []
  
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) {
    errorMessage.value = 'Please select a file'
    return
  }

  // Validate file type
  const validExtensions = ['.csv', '.xlsx', '.xls']
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  
  if (!validExtensions.includes(fileExtension)) {
    errorMessage.value = 'Please upload only Excel or CSV files'
    input.value = '' // Reset input
    return
  }

  selectedFileName.value = file.name
  selectedFile.value = file
}

const processFile = async () => {
  if (!selectedFile.value) {
    errorMessage.value = 'No file selected'
    return
  }

  isProcessing.value = true
  errorMessage.value = ''

  try {
    const fileExtension = selectedFile.value.name.toLowerCase().substring(selectedFile.value.name.lastIndexOf('.'))
    
    if (fileExtension === '.csv') {
      await processCSV(selectedFile.value)
    } else {
      await processExcel(selectedFile.value)
    }
  } catch (error) {
    errorMessage.value = 'Error processing file: ' + (error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isProcessing.value = false
  }
}

const processCSV = (file: File) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        fileData.value = results.data
        headers.value = results.meta.fields || []
        resolve(results)
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

const processExcel = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer)
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  
  const data = XLSX.utils.sheet_to_json(worksheet)
  fileData.value = data
  headers.value = Object.keys(data[0] || {})
}

const isDateColumn = (header: string) => {
  return header.toLowerCase().includes('date') && 
    fileData.value.some(row => {
      const value = row[header]
      return value && !isNaN(new Date(value).getTime())
    })
}

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

const getNumericColumns = () => {
  return headers.value.filter(header => {
    return isDateColumn(header) || fileData.value.some(row => typeof row[header] === 'number')
  })
}

// First, let's create a type for our stats return value
type ColumnStats = {
  min: number | string;
  max: number | string;
  avg: number | string;
  missing: number;
}

const getColumnStats = (column: string): ColumnStats => {
  if (isDateColumn(column)) {
    const values = fileData.value
      .map(row => row[column])
      .filter(val => val && !isNaN(new Date(val).getTime()))
      .map(val => new Date(val))
    
    const missing = fileData.value.length - values.length
    
    return {
      min: values.length ? formatDate(new Date(Math.min(...values))) : 'N/A',
      max: values.length ? formatDate(new Date(Math.max(...values))) : 'N/A',
      avg: '-', // Use dash for dates since average isn't applicable
      missing
    }
  }

  const values = fileData.value
    .map(row => row[column])
    .filter(val => typeof val === 'number' && !isNaN(val))
  
  const missing = fileData.value.length - values.length
  
  if (values.length === 0) {
    return {
      min: 'N/A',
      max: 'N/A',
      avg: 'N/A',
      missing
    }
  }
  
  const average = values.reduce((a, b) => a + b, 0) / values.length
  
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Number(average.toFixed(2)),
    missing
  }
}

const getTotalMissingValues = () => {
  return headers.value.reduce((total, header) => {
    return total + fileData.value.filter(row => 
      row[header] === null || 
      row[header] === undefined || 
      row[header] === ''
    ).length
  }, 0)
}

const getEmptyCellCount = (column: string): number => {
  return fileData.value.filter(row => 
    row[column] === null || 
    row[column] === undefined || 
    row[column] === ''
  ).length
}

const downloadAnalysis = () => {
  const analysis = {
    summary: {
      totalRows: fileData.value.length,
      totalColumns: headers.value.length,
      totalMissingValues: getTotalMissingValues()
    },
    columnStats: Object.fromEntries(
      getNumericColumns().map(column => [column, getColumnStats(column)])
    )
  }

  const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data-analysis.json'
  a.click()
  URL.revokeObjectURL(url)
}

const clearAll = () => {
  selectedFileName.value = ''
  errorMessage.value = ''
  selectedFile.value = null
  isProcessing.value = false
  fileData.value = []
  headers.value = []
  
  // Reset the file input
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  if (fileInput) {
    fileInput.value = ''
  }
}

const handleProceed = () => {
  alert('User decided to proceed with current file')
}
</script>


















