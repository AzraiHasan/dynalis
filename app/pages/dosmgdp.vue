<script setup lang="ts">
import type { GDPGNIRecord, GDPGNIValidationError, GDPGNIBasicStats } from '~/types/gdp'
import { useGDPStore } from '~/stores/gdpStore'
import { useGDPGNIData } from '~/composables/useGDPGNIData'

console.log('DEBUG: dosmgdp.vue page loading...')

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'GDP/GNI Upload - Dynalis',
})

console.log('DEBUG: dosmgdp.vue page setup complete')

const router = useRouter()
const toast = useToast()
const { setUploadedData } = useGDPStore()
const {
  processGDPGNIFile,
  validateGDPGNIStructure,
  getColumnValidation,
  calculateBasicStats,
} = useGDPGNIData()

// State
const currentStep = ref(1)
const selectedFile = ref<File | null>(null)
const fileData = ref<GDPGNIRecord[]>([])
const rawData = ref<Record<string, unknown>[]>([])
const headers = ref<string[]>([])
const validationErrors = ref<GDPGNIValidationError[]>([])
const isProcessing = ref(false)
const errorMessage = ref<string | null>(null)
const isDragging = ref(false)

// Computed
const hasFile = computed(() => selectedFile.value !== null)
const hasCriticalErrors = computed(() =>
  validationErrors.value.some(e => e.severity === 'critical'),
)
const hasWarnings = computed(() =>
  validationErrors.value.some(e => e.severity === 'warning'),
)
const basicStats = computed<GDPGNIBasicStats | null>(() =>
  fileData.value.length > 0 ? calculateBasicStats(fileData.value) : null,
)

// File upload handlers
function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFileSelect(files[0])
  }
}

function triggerFileInput() {
  const input = document.getElementById('file-input') as HTMLInputElement
  input?.click()
}

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    handleFileSelect(input.files[0])
  }
}

function handleFileSelect(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    toast.add({
      title: 'Invalid File Type',
      description: 'Please select a CSV file',
      color: 'red',
    })
    return
  }

  selectedFile.value = file
  errorMessage.value = null
}

// Process file
async function processFile() {
  if (!selectedFile.value) return

  isProcessing.value = true
  errorMessage.value = null

  try {
    const records = await processGDPGNIFile(selectedFile.value)

    // Store processed data
    fileData.value = records

    // Create raw data for validation
    rawData.value = records.map(r => ({ ...r }))
    headers.value = ['series', 'date', 'gdp', 'gni', 'gdp_capita', 'gni_capita']

    // Validate structure
    validationErrors.value = validateGDPGNIStructure(rawData.value)

    // Auto-advance to step 2
    currentStep.value = 2

    toast.add({
      title: 'File Processed',
      description: `Successfully processed ${records.length} records`,
      color: 'green',
    })
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to process file'
    toast.add({
      title: 'Processing Error',
      description: errorMessage.value,
      color: 'red',
    })
  }
  finally {
    isProcessing.value = false
  }
}

// Column validation
const columnValidations = computed(() => {
  if (rawData.value.length === 0) return []

  return headers.value.map(column => ({
    column,
    ...getColumnValidation(column, rawData.value),
  }))
})

// Preview data (first 10 rows)
const previewData = computed(() => fileData.value.slice(0, 10))

// Commit data
async function commitData() {
  isProcessing.value = true

  try {
    setUploadedData(fileData.value, selectedFile.value!.name)

    toast.add({
      title: 'Data Committed',
      description: 'GDP/GNI data successfully saved',
      color: 'green',
    })

    // Redirect to dashboard
    await router.push('/dosmgdp-dashboard')
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to commit data'
    toast.add({
      title: 'Commit Error',
      description: errorMessage.value,
      color: 'red',
    })
  }
  finally {
    isProcessing.value = false
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// Format number
function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Lifecycle hooks for debugging
onBeforeMount(() => {
  console.log('DEBUG: dosmgdp.vue onBeforeMount - Component about to mount')
})

onMounted(() => {
  console.log('DEBUG: dosmgdp.vue onMounted - Component mounted successfully')
  console.log('DEBUG: Current route:', router.currentRoute.value.path)
})
</script>

<template>
  <div>
    <UCard class="mb-6">
      <template #header>
        <h1 class="text-xl font-semibold">GDP/GNI Data Upload</h1>
      </template>

      <!-- Step Indicator -->
      <UStepper
        v-model="currentStep"
        :items="[
          { title: 'Upload File', description: 'Select GDP/GNI CSV file' },
          { title: 'Validate Data', description: 'Check data quality' },
          { title: 'Review & Commit', description: 'Finalize upload' }
        ]"
        class="mb-6"
      />

      <!-- Step 1: File Upload -->
      <div v-if="currentStep === 1" class="space-y-4">
        <!-- Drag & Drop Zone -->
        <div
          class="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-gray-50 transition"
          :class="
            isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
          "
          @dragenter.prevent="handleDragEnter"
          @dragleave.prevent="handleDragLeave"
          @dragover.prevent="handleDragOver"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input
            id="file-input"
            type="file"
            accept=".csv"
            class="hidden"
            @change="onFileInputChange"
          >

          <div v-if="!selectedFile?.name" class="space-y-2">
            <Icon
              name="i-lucide-upload-cloud"
              class="text-gray-400 mx-auto h-12 w-12"
            />
            <h3 class="text-lg font-medium">
              {{ isDragging ? 'Drop file here' : 'Drag and drop your CSV file here' }}
            </h3>
            <p class="text-sm text-gray-500">
              or click to browse files
            </p>
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
              {{ selectedFile?.name }}
            </h3>
            <p class="text-sm text-gray-500">File selected</p>
          </div>
        </div>

        <!-- DOSM Data Source Info -->
        <UCard class="bg-blue-50 border-blue-200 border">
          <div class="flex items-start space-x-3">
            <Icon
              name="i-lucide-info"
              class="text-blue-600 h-5 w-5 flex-shrink-0 mt-0.5"
            />
            <div class="flex-1">
              <h4 class="font-medium text-blue-900 mb-2">DOSM GDP/GNI Data Source</h4>
              <p class="text-sm text-blue-800 mb-3">
                Download the official GDP & GNI data from Malaysia's Department of Statistics:
              </p>
              <a
                href="https://storage.dosm.gov.my/gdp/gdp_gni_annual_real.csv"
                target="_blank"
                class="text-sm text-blue-600 hover:text-blue-800 underline flex items-center"
              >
                <Icon name="i-lucide-download" class="h-4 w-4 mr-1" />
                gdp_gni_annual_real.csv
              </a>
              <p class="text-xs text-blue-700 mt-2">
                Expected columns: series, date, gdp, gni, gdp_capita, gni_capita
              </p>
              <p class="text-xs text-blue-700 mt-1">
                Date range: 1970-2024 | Series types: "abs" (absolute values) and "growth_yoy" (% growth)
              </p>
            </div>
          </div>
        </UCard>

        <!-- Error Message -->
        <div
          v-if="errorMessage"
          class="bg-red-50 text-red-500 p-4 rounded-lg text-sm"
        >
          {{ errorMessage }}
        </div>

        <!-- Process Button -->
        <div class="flex justify-between">
          <UButton
            v-if="selectedFile?.name"
            icon="i-lucide-x"
            color="neutral"
            variant="soft"
            @click="selectedFile = null; errorMessage = ''"
          >
            Change File
          </UButton>

          <UButton
            v-if="selectedFile?.name"
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
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Total Records
              </p>
              <p class="text-2xl font-bold">
                {{ fileData.length }}
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Total Columns
              </p>
              <p class="text-2xl font-bold">
                {{ headers.length }}
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Missing Values
              </p>
              <p class="text-2xl font-bold">
                {{ columnValidations.reduce((sum, cv) => sum + cv.emptyCells, 0) }}
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Validation Errors
              </p>
              <p
                class="text-2xl font-bold"
                :class="{
                  'text-red-500': hasCriticalErrors,
                  'text-yellow-500': hasWarnings && !hasCriticalErrors,
                  'text-green-500': !hasCriticalErrors && !hasWarnings,
                }"
              >
                {{ validationErrors.length }}
              </p>
            </div>
          </UCard>
        </div>

        <!-- Data Quality Alert -->
        <UAlert
          v-if="hasCriticalErrors"
          color="red"
          variant="soft"
          icon="i-lucide-alert-circle"
          title="Critical Errors Found"
          description="Please fix critical errors before proceeding"
        />
        <UAlert
          v-else-if="hasWarnings"
          color="yellow"
          variant="soft"
          icon="i-lucide-alert-triangle"
          title="Warnings Detected"
          description="You can proceed but review warnings carefully"
        />
        <UAlert
          v-else
          color="green"
          variant="soft"
          icon="i-lucide-check-circle"
          title="All Validations Passed"
          description="Data is ready to be committed"
        />

        <!-- Data Preview -->
        <UCard v-if="previewData.length > 0">
          <template #header>
            <h3 class="font-semibold">
              Data Preview (First 10 Rows)
            </h3>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left font-medium text-gray-700">Series</th>
                  <th class="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                  <th class="px-4 py-3 text-right font-medium text-gray-700">GDP</th>
                  <th class="px-4 py-3 text-right font-medium text-gray-700">GNI</th>
                  <th class="px-4 py-3 text-right font-medium text-gray-700">GDP/Capita</th>
                  <th class="px-4 py-3 text-right font-medium text-gray-700">GNI/Capita</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in previewData"
                  :key="index"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="px-4 py-3">{{ row.series }}</td>
                  <td class="px-4 py-3">{{ row.date }}</td>
                  <td class="px-4 py-3 text-right">{{ formatNumber(row.gdp) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatNumber(row.gni) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatNumber(row.gdp_capita) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatNumber(row.gni_capita) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <!-- Column Quality Checks -->
        <UCard v-if="columnValidations.length > 0">
          <template #header>
            <h3 class="font-semibold">
              Column Quality Checks
            </h3>
          </template>

          <div class="space-y-4">
            <div
              v-for="cv in columnValidations"
              :key="cv.column"
              class="border rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <Icon name="i-lucide-table" class="w-4 h-4" />
                  <span class="font-medium">{{ cv.column }}</span>
                </div>
                <div class="flex gap-2">
                  <UBadge v-if="cv.emptyCells > 0" color="red" variant="soft">
                    {{ cv.emptyCells }} empty
                  </UBadge>
                  <UBadge v-if="cv.invalidCells > 0" color="orange" variant="soft">
                    {{ cv.invalidCells }} invalid
                  </UBadge>
                  <UBadge v-if="cv.emptyCells === 0 && cv.invalidCells === 0" color="green" variant="soft">
                    Valid
                  </UBadge>
                </div>
              </div>

              <div v-if="cv.errors.length > 0" class="mt-2">
                <UAccordion
                  :items="[{
                    label: `View ${cv.errors.length} error(s)`,
                    content: cv.errors.map(e => `Row ${e.row}: ${e.error}`).join('\n'),
                  }]"
                />
              </div>
            </div>
          </div>
        </UCard>

        <!-- Navigation Buttons -->
        <div class="flex justify-between">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="soft"
            @click="currentStep = 1"
          >
            Back to Upload
          </UButton>
          <UButton
            icon="i-lucide-arrow-right"
            color="primary"
            trailing
            :disabled="hasCriticalErrors"
            @click="currentStep = 3"
          >
            Continue to Review
          </UButton>
        </div>
      </div>

      <!-- Step 3: Review & Commit -->
      <div v-if="currentStep === 3" class="space-y-6">
        <!-- Basic Statistics -->
        <div v-if="basicStats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Total Years
              </p>
              <p class="text-2xl font-bold">
                {{ Math.floor(basicStats.totalRecords / 2) }}
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Date Range
              </p>
              <p class="text-lg font-bold">
                {{ new Date(basicStats.dateRange.start).getFullYear() }}-{{ new Date(basicStats.dateRange.end).getFullYear() }}
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Total Records
              </p>
              <p class="text-2xl font-bold">
                {{ basicStats.totalRecords }}
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-sm text-gray-500">
                Latest Year
              </p>
              <p class="text-2xl font-bold">
                {{ basicStats.latestYear }}
              </p>
            </div>
          </UCard>
        </div>

        <!-- Latest Values Showcase -->
        <div v-if="basicStats" class="grid md:grid-cols-2 gap-6">
          <!-- Absolute Values -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">
                Latest Absolute Values ({{ basicStats.latestYear }})
              </h3>
            </template>

            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GDP</span>
                <span class="text-lg font-bold">RM {{ formatNumber(basicStats.latestAbsValues.gdp, 0) }}M</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GNI</span>
                <span class="text-lg font-bold">RM {{ formatNumber(basicStats.latestAbsValues.gni, 0) }}M</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GDP per Capita</span>
                <span class="text-lg font-bold">RM {{ formatNumber(basicStats.latestAbsValues.gdp_capita, 2) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GNI per Capita</span>
                <span class="text-lg font-bold">RM {{ formatNumber(basicStats.latestAbsValues.gni_capita, 2) }}</span>
              </div>
            </div>
          </UCard>

          <!-- Growth Rates -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">
                Latest Growth Rates ({{ basicStats.latestYear }})
              </h3>
            </template>

            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GDP Growth</span>
                <span
                  class="text-lg font-bold"
                  :class="{
                    'text-green-600': basicStats.latestGrowthRates.gdp > 0,
                    'text-red-600': basicStats.latestGrowthRates.gdp < 0,
                  }"
                >
                  {{ formatNumber(basicStats.latestGrowthRates.gdp, 2) }}%
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GNI Growth</span>
                <span
                  class="text-lg font-bold"
                  :class="{
                    'text-green-600': basicStats.latestGrowthRates.gni > 0,
                    'text-red-600': basicStats.latestGrowthRates.gni < 0,
                  }"
                >
                  {{ formatNumber(basicStats.latestGrowthRates.gni, 2) }}%
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GDP/Capita Growth</span>
                <span
                  class="text-lg font-bold"
                  :class="{
                    'text-green-600': basicStats.latestGrowthRates.gdp_capita > 0,
                    'text-red-600': basicStats.latestGrowthRates.gdp_capita < 0,
                  }"
                >
                  {{ formatNumber(basicStats.latestGrowthRates.gdp_capita, 2) }}%
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">GNI/Capita Growth</span>
                <span
                  class="text-lg font-bold"
                  :class="{
                    'text-green-600': basicStats.latestGrowthRates.gni_capita > 0,
                    'text-red-600': basicStats.latestGrowthRates.gni_capita < 0,
                  }"
                >
                  {{ formatNumber(basicStats.latestGrowthRates.gni_capita, 2) }}%
                </span>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Dataset Information -->
        <UCard class="bg-green-50 border-green-200 border">
          <div class="flex items-start space-x-3">
            <Icon
              name="i-lucide-check-circle"
              class="text-green-600 h-5 w-5 flex-shrink-0 mt-0.5"
            />
            <div class="flex-1">
              <h4 class="font-medium text-green-900 mb-2">Ready to Commit</h4>
              <p class="text-sm text-green-800 mb-2">
                This GDP/GNI data from DOSM will be saved to your browser's local storage.
              </p>
              <p class="text-sm text-green-800 font-medium">
                File: {{ selectedFile?.name }}
              </p>
              <div class="mt-3 text-xs text-green-700 space-y-1">
                <p><strong>Dataset:</strong> Annual Real GDP & GNI</p>
                <p><strong>Source:</strong> Department of Statistics Malaysia (DOSM)</p>
                <p><strong>License:</strong> CC BY 4.0</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Navigation Buttons -->
        <div class="flex justify-between">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="soft"
            @click="currentStep = 2"
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
