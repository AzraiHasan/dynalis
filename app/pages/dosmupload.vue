<script setup lang="ts">
import {
  processCPIFile,
  validateCPIStructure,
  getColumnValidation,
  calculateBasicStats
} from '~/composables/useCPIData'
import { useCPIStore } from '~/stores/cpiStore'
import type { CPIValidationError, CPIColumnValidation } from '~/types/cpi'

// Page metadata
definePageMeta({
  layout: 'default'
})

// Router and store
const router = useRouter()
const { setUploadedData } = useCPIStore()

// Step configuration
const currentStep = ref(1)
const items = [
  { title: 'Upload File', description: 'Select CPI CSV file' },
  { title: 'Validate Data', description: 'Check data quality' },
  { title: 'Review & Commit', description: 'Finalize upload' }
]

// File upload state
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const selectedFileName = ref<string>('')
const dragActive = ref(false)

// Data state
const fileData = ref<Record<string, unknown>[]>([])
const headers = ref<string[]>(['date', 'division', 'inflation'])
const validationErrors = ref<CPIValidationError[]>([])
const columnValidations = ref<Record<string, CPIColumnValidation>>({})

// Processing state
const isProcessing = ref(false)
const errorMessage = ref<string>('')

// Computed properties for validation summary
const totalRows = computed(() => fileData.value.length)
const totalColumns = computed(() => headers.value.length)
const totalMissingValues = computed(() => {
  return Object.values(columnValidations.value).reduce((sum, col) => sum + col.emptyCells, 0)
})
const totalInvalidValues = computed(() => {
  return Object.values(columnValidations.value).reduce((sum, col) => sum + col.invalidCells, 0)
})
const hasValidationIssues = computed(() => {
  return totalMissingValues.value > 0 || totalInvalidValues.value > 0
})

// Basic stats for step 3
const basicStats = computed(() => {
  if (fileData.value.length === 0) return null
  return calculateBasicStats(fileData.value)
})

// File handling functions
function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    handleFileSelection(target.files[0])
  }
}

function handleFileDrop(event: DragEvent) {
  dragActive.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    handleFileSelection(files[0])
  }
}

function handleFileSelection(file: File) {
  // Validate file type
  if (!file.name.endsWith('.csv')) {
    errorMessage.value = 'Please select a CSV file'
    return
  }

  selectedFile.value = file
  selectedFileName.value = file.name
  errorMessage.value = ''
}

async function processFile() {
  if (!selectedFile.value) return

  isProcessing.value = true
  errorMessage.value = ''

  try {
    // Parse the CSV file
    const records = await processCPIFile(selectedFile.value)

    // Validate the structure and content
    const errors = validateCPIStructure(records)
    validationErrors.value = errors

    // Get column-specific validations
    const colValidations: Record<string, CPIColumnValidation> = {}
    for (const col of headers.value) {
      colValidations[col] = getColumnValidation(col, records)
    }
    columnValidations.value = colValidations

    // Store the data
    fileData.value = records

    // Advance to validation step
    currentStep.value = 2
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to process file'
  } finally {
    isProcessing.value = false
  }
}

function clearAll() {
  selectedFile.value = null
  selectedFileName.value = ''
  fileData.value = []
  validationErrors.value = []
  columnValidations.value = {}
  errorMessage.value = ''
  currentStep.value = 1
}

function backToUpload() {
  currentStep.value = 1
}

function continueToReview() {
  currentStep.value = 3
}

function backToValidation() {
  currentStep.value = 2
}

async function commitData() {
  if (fileData.value.length === 0) return

  isProcessing.value = true
  errorMessage.value = ''

  try {
    // Save to store and localStorage
    setUploadedData(fileData.value, selectedFileName.value)

    // Show success toast
    const toast = useToast()
    toast.add({
      title: 'Success',
      description: 'CPI data uploaded successfully',
      color: 'green'
    })

    // Redirect to dashboard
    await router.push('/dosm-dashboard')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to commit data'
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div>
    <UCard class="mb-6">
      <template #header>
        <h1 class="text-xl font-semibold">DOSM CPI Data Upload</h1>
      </template>

      <!-- Step Indicator -->
      <UStepper
        v-model="currentStep"
        :items="items"
        class="mb-6"
      />

      <!-- Step 1: File Upload -->
      <div v-if="currentStep === 1" class="space-y-4">
        <div
          class="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-gray-50 transition"
          :class="
            dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
          "
          @dragenter.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @dragover.prevent="dragActive = true"
          @drop.prevent="handleFileDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="hidden"
            @change="handleFileChange"
          >

          <div v-if="!selectedFileName" class="space-y-2">
            <Icon
              name="i-lucide-upload-cloud"
              class="text-gray-400 mx-auto h-12 w-12"
            />
            <h3 class="text-lg font-medium">Drag and drop your CSV file here</h3>
            <p class="text-sm text-gray-500">or click to browse files</p>
            <p class="text-xs text-gray-400">
              Supports CSV files only
            </p>
          </div>

          <div v-else class="space-y-2">
            <Icon
              name="i-lucide-file"
              class="text-primary-500 mx-auto h-12 w-12"
            />
            <h3 class="text-lg font-medium text-primary-700">
              {{ selectedFileName }}
            </h3>
            <p class="text-sm text-gray-500">File selected</p>
          </div>
        </div>

        <div
          v-if="errorMessage"
          class="bg-red-50 text-red-500 p-4 rounded-lg text-sm"
        >
          {{ errorMessage }}
        </div>

        <!-- DOSM Data Source Info -->
        <UCard class="bg-blue-50 border-blue-200 border">
          <div class="flex items-start space-x-3">
            <Icon
              name="i-lucide-info"
              class="text-blue-600 h-5 w-5 flex-shrink-0 mt-0.5"
            />
            <div class="flex-1">
              <h4 class="font-medium text-blue-900 mb-2">DOSM CPI Data Source</h4>
              <p class="text-sm text-blue-800 mb-3">
                Download the official CPI inflation data from Malaysia's Department of Statistics:
              </p>
              <a
                href="https://storage.dosm.gov.my/cpi/cpi_2d_annual_inflation.csv"
                target="_blank"
                class="text-sm text-blue-600 hover:text-blue-800 underline flex items-center"
              >
                <Icon name="i-lucide-download" class="h-4 w-4 mr-1" />
                cpi_2d_annual_inflation.csv
              </a>
              <p class="text-xs text-blue-700 mt-2">
                Once downloaded, upload it here to analyze and visualize the data.
              </p>
            </div>
          </div>
        </UCard>

        <div class="flex justify-between">
          <UButton
            v-if="selectedFileName"
            icon="i-lucide-x"
            color="neutral"
            variant="soft"
            @click="clearAll"
          >
            Change File
          </UButton>

          <UButton
            v-if="selectedFileName"
            icon="i-lucide-file-check"
            color="primary"
            :loading="isProcessing"
            class="ml-auto"
            @click="processFile"
          >
            Process File
          </UButton>
        </div>
      </div>

      <!-- Step 2: Data Validation -->
      <div v-if="currentStep === 2" class="space-y-6">
        <!-- Summary Statistics -->
        <div class="grid grid-cols-4 gap-4">
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Total Rows</p>
              <p class="text-2xl font-bold">{{ totalRows.toLocaleString() }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Columns</p>
              <p class="text-2xl font-bold">{{ totalColumns }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Missing Values</p>
              <p class="text-2xl font-bold" :class="totalMissingValues > 0 ? 'text-orange-500' : 'text-green-500'">
                {{ totalMissingValues }}
              </p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Invalid Values</p>
              <p class="text-2xl font-bold" :class="totalInvalidValues > 0 ? 'text-red-500' : 'text-green-500'">
                {{ totalInvalidValues }}
              </p>
            </div>
          </UCard>
        </div>

        <!-- Data Preview -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Data Preview (First 5 Rows)</h3>
          </template>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Division</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Inflation</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(row, index) in fileData.slice(0, 5)" :key="index">
                  <td class="px-4 py-2 text-sm">{{ row.date || '(empty)' }}</td>
                  <td class="px-4 py-2 text-sm">{{ row.division || '(empty)' }}</td>
                  <td class="px-4 py-2 text-sm">{{ row.inflation ?? '(empty)' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <!-- Column Quality Checks -->
        <div>
          <h3 class="font-semibold mb-3">Column Quality Checks</h3>
          <div class="space-y-3">
            <UCard
              v-for="col in headers"
              :key="col"
              :class="columnValidations[col]?.invalidCells > 0 ? 'border-red-200 bg-red-50' : 'border-green-200'"
              class="border"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <h4 class="font-medium capitalize">{{ col }}</h4>
                  <div class="flex gap-4 mt-2">
                    <span class="text-sm">
                      Empty: <UBadge :color="columnValidations[col]?.emptyCells > 0 ? 'orange' : 'green'">
                        {{ columnValidations[col]?.emptyCells || 0 }}
                      </UBadge>
                    </span>
                    <span class="text-sm">
                      Invalid: <UBadge :color="columnValidations[col]?.invalidCells > 0 ? 'red' : 'green'">
                        {{ columnValidations[col]?.invalidCells || 0 }}
                      </UBadge>
                    </span>
                  </div>
                </div>
                <Icon
                  :name="columnValidations[col]?.invalidCells > 0 ? 'i-lucide-x-circle' : 'i-lucide-check-circle'"
                  :class="columnValidations[col]?.invalidCells > 0 ? 'text-red-500' : 'text-green-500'"
                  class="h-6 w-6"
                />
              </div>
              <!-- Show first few errors if any -->
              <div v-if="columnValidations[col]?.errors.length > 0" class="mt-3 text-xs text-red-600">
                <details>
                  <summary class="cursor-pointer">Show errors ({{ columnValidations[col].errors.length }})</summary>
                  <ul class="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    <li v-for="(err, idx) in columnValidations[col].errors.slice(0, 10)" :key="idx">
                      Row {{ err.row + 1 }}: {{ err.error }} (value: "{{ err.value }}")
                    </li>
                    <li v-if="columnValidations[col].errors.length > 10" class="italic">
                      ... and {{ columnValidations[col].errors.length - 10 }} more
                    </li>
                  </ul>
                </details>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Data Quality Alert -->
        <UAlert
          :color="hasValidationIssues ? 'orange' : 'green'"
          :icon="hasValidationIssues ? 'i-lucide-alert-triangle' : 'i-lucide-check-circle'"
          :title="hasValidationIssues ? 'Data quality issues detected' : 'Data validation passed'"
          :description="hasValidationIssues ? 'Some validation issues were found, but you can still proceed.' : 'All data looks good!'"
        />

        <!-- Navigation -->
        <div class="flex justify-between">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="soft"
            @click="backToUpload"
          >
            Back to Upload
          </UButton>
          <UButton
            icon="i-lucide-arrow-right"
            color="primary"
            trailing
            @click="continueToReview"
          >
            Continue to Review
          </UButton>
        </div>
      </div>

      <!-- Step 3: Review & Commit -->
      <div v-if="currentStep === 3" class="space-y-6">
        <!-- Basic Statistics -->
        <div v-if="basicStats" class="grid grid-cols-2 gap-4">
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Total Records</p>
              <p class="text-2xl font-bold">{{ basicStats.totalRecords.toLocaleString() }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Date Range</p>
              <p class="text-lg font-bold">{{ basicStats.dateRange.start.substring(0, 4) }} - {{ basicStats.dateRange.end.substring(0, 4) }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Number of Divisions</p>
              <p class="text-2xl font-bold">{{ basicStats.numberOfDivisions }}</p>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">Latest Year</p>
              <p class="text-2xl font-bold">{{ basicStats.latestYear }}</p>
            </div>
          </UCard>
        </div>

        <!-- Data Type Information -->
        <UCard class="bg-green-50 border-green-200 border">
          <div class="flex items-start space-x-3">
            <Icon
              name="i-lucide-check-circle"
              class="text-green-600 h-5 w-5 flex-shrink-0 mt-0.5"
            />
            <div class="flex-1">
              <h4 class="font-medium text-green-900 mb-2">Ready to Commit</h4>
              <p class="text-sm text-green-800 mb-2">
                This CPI inflation data from DOSM will be saved to your browser's local storage.
              </p>
              <p class="text-sm text-green-800 font-medium">
                File: {{ selectedFileName }}
              </p>
            </div>
          </div>
        </UCard>

        <div
          v-if="errorMessage"
          class="bg-red-50 text-red-500 p-4 rounded-lg text-sm"
        >
          {{ errorMessage }}
        </div>

        <!-- Navigation -->
        <div class="flex justify-between">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="soft"
            @click="backToValidation"
          >
            Back to Validation
          </UButton>
          <UButton
            icon="i-lucide-check"
            color="primary"
            :loading="isProcessing"
            @click="commitData"
          >
            Commit Data & Continue
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
