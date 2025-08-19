<template>
  <div>
    <UCard class="mb-6">
      <template #header>
        <h1 class="text-xl font-semibold">Data Upload</h1>
      </template>

      <!-- Step Indicator with proper interaction -->
      <UStepper
        v-model="currentStep"
        :items="items"
        :disabled="stepperDisabled"
        class="mb-6"
      />

      <!-- Step 1: File Upload (Only shown when currentStep is 1) -->
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
            accept=".csv,.xlsx,.xls"
            class="hidden"
            @change="handleFileChange"
          />

          <div v-if="!selectedFileName" class="space-y-2">
            <Icon
              name="i-lucide-upload-cloud"
              class="text-gray-400 mx-auto h-12 w-12"
            />
            <h3 class="text-lg font-medium">Drag and drop your file here</h3>
            <p class="text-sm text-gray-500">or click to browse files</p>
            <p class="text-xs text-gray-400">
              Supports CSV, Excel (.xlsx, .xls)
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
            <p v-if="fileEstimate" class="text-xs text-gray-400">
              {{ fileEstimate }}
            </p>
          </div>
        </div>

        <div
          v-if="errorMessage"
          class="bg-red-50 text-red-500 p-4 rounded-lg text-sm"
        >
          {{ errorMessage }}
        </div>

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
            @click="processFile"
            :loading="isProcessing"
            class="ml-auto"
          >
            Process File
          </UButton>
        </div>
      </div>

      <!-- Step 2: Data Preview and Validation (Only shown when currentStep is 2) -->
      <div v-if="currentStep === 2" class="space-y-6">
        <!-- Summary Statistics -->
        <h3 class="text-lg font-medium mb-2">Summary Statistics</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <UCard class="bg-gray-50">
            <div class="flex items-center space-x-3">
              <div
                class="flex items-center justify-center bg-primary-100 h-12 w-12 rounded-lg"
              >
                <Icon
                  name="i-lucide-database"
                  class="h-6 w-6 text-primary-500"
                />
              </div>
              <div>
                <p class="text-sm text-gray-500">Total Rows</p>
                <p class="text-2xl font-semibold">{{ fileData.length }}</p>
              </div>
            </div>
          </UCard>

          <UCard class="bg-gray-50">
            <div class="flex items-center space-x-3">
              <div
                class="flex items-center justify-center bg-blue-100 h-12 w-12 rounded-lg"
              >
                <Icon name="i-lucide-columns" class="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p class="text-sm text-gray-500">Total Columns</p>
                <p class="text-2xl font-semibold">{{ headers.length }}</p>
              </div>
            </div>
          </UCard>

          <UCard class="bg-gray-50">
            <div class="flex items-center space-x-3">
              <div
                class="flex items-center justify-center bg-amber-100 h-12 w-12 rounded-lg"
              >
                <Icon
                  name="i-lucide-alert-circle"
                  class="h-6 w-6 text-amber-500"
                />
              </div>
              <div>
                <p class="text-sm text-gray-500">Missing Values</p>
                <p class="text-2xl font-semibold">
                  {{ getTotalMissingValues() }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard class="bg-gray-50">
            <div class="flex items-center space-x-3">
              <div
                class="flex items-center justify-center bg-gray-100 h-12 w-12 rounded-lg"
              >
                <Icon name="i-lucide-minus" class="h-6 w-6 text-gray-500" />
              </div>
              <div>
                <p class="text-sm text-gray-500">Dash Values</p>
                <p class="text-2xl font-semibold">{{ getTotalDashValues() }}</p>
                <p class="text-xs text-gray-400">Cells with "-" characters</p>
              </div>
            </div>
          </UCard>
        </div>
        
        <!-- Data Preview Section -->
        <div>
          <h3 class="text-lg font-medium mb-2">Data Preview</h3>
          <div class="overflow-x-auto border rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    v-for="header in previewHeaders"
                    :key="header"
                    class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(row, index) in previewData" :key="index">
                  <td
                    v-for="header in previewHeaders"
                    :key="`${index}-${header}`"
                    class="px-3 py-2 text-sm"
                  >
                    <span
                      v-if="
                        row[header] === null ||
                        row[header] === undefined ||
                        row[header] === ''
                      "
                      class="text-gray-300 italic"
                      >Empty</span
                    >
                    <span
                      v-else-if="row[header] === '-' || row[header] === '–'"
                      class="text-gray-400"
                      >-</span
                    >
                    <span v-else>{{ row[header] }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Showing first 5 rows of {{ fileData.length }} total records
          </p>
        </div>

        

        <!-- Column Quality Check -->
        <div>
          <h3 class="text-lg font-medium mb-2 flex items-center">
            <Icon name="i-lucide-shield-check" class="mr-2 text-gray-600" />
            Data Quality Check
          </h3>

          <!-- Data Quality Alert -->
        <div v-if="hasEmptyCells" class="mb-4">
          <UAlert
            color="warning"
            title="Data Quality Issues Detected"
            description="Empty cells and data irregularities may cause errors during further analysis. Consider fixing these issues before proceeding."
          />
        </div>
        <div v-else class="mb-4">
          <UAlert
            color="success"
            title="Data Quality Check Passed"
            description="Your data looks good with no empty cells detected."
          />
        </div>

          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <UCard v-for="column in headers" :key="column" class="bg-gray-50">
              <template #header>
                <h3 class="font-medium text-sm">{{ column }}</h3>
              </template>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600"> Empty Cells: </span>
                  <UBadge
                    :color="
                      getColumnValidation(column).emptyCells > 0
                        ? 'warning'
                        : 'success'
                    "
                  >
                    {{ getColumnValidation(column).emptyCells }}
                  </UBadge>
                </div>

                <div
                  v-if="getColumnValidation(column).irregularCells > 0"
                  class="flex items-center justify-between"
                >
                  <span class="text-sm text-orange-600"> Irregularities: </span>
                  <UBadge color="warning">
                    {{ getColumnValidation(column).irregularCells }}
                  </UBadge>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        

        <!-- Navigation Buttons -->
        <div class="flex justify-between pt-4 border-t">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="soft"
            @click="currentStep = 1"
          >
            Back to Upload
          </UButton>

          <UButton
            trailing-icon="i-lucide-arrow-right"
            color="primary"
            :variant="hasEmptyCells ? 'soft' : 'solid'"
            @click="currentStep = 3"
          >
            Continue to Review
          </UButton>
        </div>
      </div>

      <!-- Step 3: Review & Commit (New step) -->
      <div v-if="currentStep === 3" class="space-y-6">
        <h3 class="text-lg font-medium mb-4">Review Data & Commit</h3>
        
        <!-- Key Metrics Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-chart-bar" class="text-gray-600" />
              <h2 class="text-lg font-semibold">Key Metrics</h2>
            </div>
          </template>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Total Sites -->
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-map-pin" class="text-gray-600" />
                <h3 class="text-sm text-gray-600">Total Sites</h3>
              </div>
              <p class="text-2xl font-semibold">{{ businessMetrics.totalSites }}</p>
              <p v-if="businessMetrics.missingSites" class="text-xs text-orange-600 mt-1">
                {{ businessMetrics.missingSites }} missing IDs
              </p>
            </div>

            <!-- Total Rental -->
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-wallet" class="text-gray-600" />
                <h3 class="text-sm text-gray-600">Total Rental</h3>
              </div>
              <p class="text-2xl font-semibold">
                {{ (businessMetrics.totalRental / 1000000).toFixed(2) }}M
              </p>
              <p class="text-xs text-gray-400 mt-1">
                {{ formatCurrency(businessMetrics.totalRental) }}
              </p>
            </div>

            <!-- Due Payment -->
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-credit-card" class="text-gray-600" />
                <h3 class="text-sm text-gray-600">Due Payment</h3>
              </div>
              <p class="text-2xl font-semibold">
                {{ (businessMetrics.totalPaymentToPay / 1000000).toFixed(2) }}M
              </p>
              <p class="text-xs text-gray-400 mt-1">
                {{ formatCurrency(businessMetrics.totalPaymentToPay) }}
              </p>
            </div>

            <!-- Deposit -->
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-banknote" class="text-gray-600" />
                <h3 class="text-sm text-gray-600">Deposit</h3>
              </div>
              <p class="text-2xl font-semibold">
                {{ (businessMetrics.totalDeposit / 1000000).toFixed(2) }}M
              </p>
              <p class="text-xs text-gray-400 mt-1">
                {{ formatCurrency(businessMetrics.totalDeposit) }}
              </p>
            </div>
          </div>
        </UCard>

        <!-- Contract Expiration Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-alarm-clock" class="text-gray-600" />
              <h2 class="text-lg font-semibold">Contract Expirations</h2>
            </div>
          </template>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Expired -->
            <div class="p-4 bg-red-50 rounded-lg transition-all hover:bg-red-100">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-alert-circle" class="text-red-600" />
                <h3 class="text-sm text-red-600">Expired</h3>
              </div>
              <p class="text-2xl font-semibold text-red-600">
                {{ expirationMetrics.expired }}
              </p>
              <p class="text-xs text-red-500 mt-1">Past expiration date</p>
              <p
                v-if="expirationMetrics.invalidDates"
                class="text-xs text-gray-500 mt-1"
              >
                + {{ expirationMetrics.invalidDates }} invalid/missing dates
              </p>
            </div>

            <!-- Within 30 Days -->
            <div
              class="p-4 bg-orange-50 rounded-lg transition-all hover:bg-orange-100"
            >
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-clock-alert" class="text-orange-600" />
                <h3 class="text-sm text-orange-600">Within 30 Days</h3>
              </div>
              <p class="text-2xl font-semibold text-orange-600">
                {{ expirationMetrics.within30Days }}
              </p>
              <p class="text-xs text-orange-500 mt-1">Urgent attention needed</p>
            </div>

            <!-- Within 60 Days -->
            <div
              class="p-4 bg-yellow-50 rounded-lg transition-all hover:bg-yellow-100"
            >
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-clock" class="text-yellow-600" />
                <h3 class="text-sm text-yellow-600">Within 60 Days</h3>
              </div>
              <p class="text-2xl font-semibold text-yellow-600">
                {{ expirationMetrics.within60Days }}
              </p>
              <p class="text-xs text-yellow-500 mt-1">Plan for renewal</p>
            </div>

            <!-- Within 90 Days -->
            <div
              class="p-4 bg-blue-50 rounded-lg transition-all hover:bg-blue-100"
            >
              <div class="flex items-center gap-2 mb-2">
                <Icon name="i-lucide-calendar" class="text-blue-600" />
                <h3 class="text-sm text-blue-600">Within 90 Days</h3>
              </div>
              <p class="text-2xl font-semibold text-blue-600">
                {{ expirationMetrics.within90Days }}
              </p>
              <p class="text-xs text-blue-500 mt-1">Early planning</p>
            </div>
          </div>
        </UCard>

        <!-- Navigation Buttons -->
        <div class="flex justify-between pt-4 border-t">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="soft"
            @click="currentStep = 2"
          >
            Back to Validation
          </UButton>

          <UButton
            icon="i-lucide-database"
            color="primary"
            @click="handleCommitData"
            :loading="uploadState.isUploading.value"
          >
            Commit Data & Continue
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
});

import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useFileUpload } from "~/composables/useFileUpload";
import { useFileUploadStore } from "~/stores/fileUploadStore";
import type { StepperItem } from "@nuxt/ui";
import { parse, isValid, differenceInDays, format } from "date-fns";
import { DATE_FORMATS } from "~/utils/dateUtils";
import { useUploadState } from "~/composables/useUploadState";
import { useSQLiteBatchUpload } from "~/composables/useSQLiteBatchUpload";

// Interface definitions remain the same
interface FileRow {
  [key: string]: string | number | null;
}

interface ValidationError {
  row: number;
  column: string;
  value: string;
  error: string;
}

interface ColumnValidation {
  emptyCells: number;
  irregularCells: number;
  errors: ValidationError[];
}

// Step management
const currentStep = ref(1);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFileName = ref("");
const errorMessage = ref("");
const selectedFile = ref<File | null>(null);
const isProcessing = ref(false);
const fileData = ref<FileRow[]>([]);
const headers = ref<string[]>([]);
const fileUpload = useFileUpload();
const toast = useToast();
const dragActive = ref(false);
const fileEstimate = ref("");
const router = useRouter();
const uploadState = useUploadState();
const sqliteBatchUpload = useSQLiteBatchUpload();

// Step configurations for UStepper
const items = computed<StepperItem[]>(() => [
  {
    title: "1. Upload File",
    description: "Select and upload your data file",
    icon: "i-lucide-upload-cloud",
    color: "primary",
  },
  {
    title: "2. Validate Data",
    description: "Review and check data quality",
    icon: "i-lucide-check-circle",
    color: currentStep.value === 2 ? "primary" : "neutral",
  },
  {
    title: "3. Review & Commit",
    description: "Analyze metrics and commit data",
    icon: "i-lucide-database",
    color: currentStep.value === 3 ? "primary" : "neutral",
  },
]);

// Control stepper interaction - Steps should be enabled progressively
const stepperDisabled = computed(() => {
  // Allow step 1 always, step 2 only when file is processed, step 3 only when validated
  if (currentStep.value === 1) return false;
  if (currentStep.value === 2) return fileData.value.length === 0;
  if (currentStep.value === 3) return fileData.value.length === 0;
  return false;
});

// Data preview computed properties
const previewData = computed(() => {
  return fileData.value.slice(0, 5);
});

const previewHeaders = computed(() => {
  return headers.value.slice(0, 6); // Limit to first 6 columns for better display
});

const hasEmptyCells = computed(() => {
  return getTotalMissingValues() > 0;
});

// File selection handlers
const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileDrop = (event: DragEvent) => {
  dragActive.value = false;
  if (!event.dataTransfer?.files.length) return;

  if (event.dataTransfer?.files[0]) {
    handleFileSelection(event.dataTransfer.files[0]);
  }
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) {
    handleFileSelection(file);
  }
};

const handleFileSelection = (file: File) => {
  errorMessage.value = "";
  selectedFileName.value = "";
  fileData.value = [];
  headers.value = [];

  const validExtensions = [".csv", ".xlsx", ".xls"];
  const fileExtension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf("."));

  if (!validExtensions.includes(fileExtension)) {
    errorMessage.value = "Please upload only Excel or CSV files";
    if (fileInput.value) fileInput.value.value = "";
    return;
  }

  // Format the file size
  const fileSizeMB = file.size / (1024 * 1024);
  fileEstimate.value =
    fileSizeMB < 1
      ? `${(fileSizeMB * 1024).toFixed(1)} KB`
      : `${fileSizeMB.toFixed(2)} MB`;

  selectedFileName.value = file.name;
  selectedFile.value = file;
};

// Process file and move to next step
const processFile = async () => {
  if (!selectedFile.value) {
    errorMessage.value = "No file selected";
    return;
  }

  isProcessing.value = true;
  errorMessage.value = "";

  try {
    // Use the file upload composable
    fileData.value = await fileUpload.processAndUpload(selectedFile.value);
    headers.value =
      fileData.value.length > 0 && fileData.value[0]
        ? Object.keys(fileData.value[0])
        : [];

    // Move to next step after processing
    currentStep.value = 2;

    toast.add({
      title: "File processed successfully",
      description: `${fileData.value.length} rows loaded`,
      color: "success",
    });
  } catch (error) {
    errorMessage.value =
      "Error processing file: " +
      (error instanceof Error ? error.message : "Unknown error");
    toast.add({
      title: "Error processing file",
      description: errorMessage.value,
      color: "error",
    });
  } finally {
    isProcessing.value = false;
  }
};

// Data validation helpers
const getTotalMissingValues = () => {
  return headers.value.reduce((total, header) => {
    return (
      total +
      fileData.value.filter(
        (row) =>
          row[header] === null ||
          row[header] === undefined ||
          row[header] === ""
      ).length
    );
  }, 0);
};

// Helper functions for column validation
const getEmptyCellCount = (column: string): number => {
  return fileData.value.filter(
    (row) =>
      row[column] === null || row[column] === undefined || row[column] === ""
  ).length;
};

const isValidDate = (value: any): boolean => {
  if (!value) return false;

  // Try each format
  for (const dateFormat of DATE_FORMATS) {
    try {
      const parsedDate = parse(value.toString(), dateFormat, new Date());
      if (isValid(parsedDate)) {
        return true;
      }
    } catch (error) {
      continue;
    }
  }

  // Fallback to native Date parsing
  const date = new Date(value);
  return isValid(date);
};

const isValidCurrency = (value: any): boolean => {
  if (!value) return false;
  // Matches format like "RM 1,234.56" or "1234.56" or "1,234"
  const currencyRegex = /^(RM\s*)?[\d,]+(\.\d{2})?$/;
  return currencyRegex.test(value.toString().trim());
};

const getColumnValidation = (column: string): ColumnValidation => {
  const emptyCells = getEmptyCellCount(column);
  let irregularCells = 0;
  const errors: ValidationError[] = [];

  fileData.value.forEach((row, index) => {
    const value = row[column];
    if (value !== null && value !== undefined && value !== "") {
      const columnLower = column.toLowerCase();

      if (columnLower.includes("date")) {
        if (!isValidDate(value)) {
          irregularCells++;
          errors.push({
            row: index + 1,
            column,
            value: value.toString(),
            error: `Invalid date format. Expected formats: ${DATE_FORMATS.join(
              ", "
            )}`,
          });
        }
      } else if (
        columnLower.includes("rental") ||
        columnLower.includes("payment") ||
        columnLower.includes("deposit")
      ) {
        if (!isValidCurrency(value)) irregularCells++;
      } else if (columnLower.includes("id")) {
        // Assuming IDs shouldn't be empty and shouldn't contain spaces
        if (typeof value !== "string" || value.includes(" ")) irregularCells++;
      }
    }
  });

  return {
    emptyCells,
    irregularCells,
    errors,
  };
};

const getTotalDashValues = () => {
  return headers.value.reduce((total, header) => {
    return (
      total +
      fileData.value.filter(
        (row) =>
          row[header] === "-" || row[header] === "–" || row[header] === "—"
      ).length
    );
  }, 0);
};

// Reset to initial state
const clearAll = () => {
  selectedFileName.value = "";
  errorMessage.value = "";
  selectedFile.value = null;
  isProcessing.value = false;
  fileData.value = [];
  headers.value = [];
  fileEstimate.value = "";

  if (fileInput.value) {
    fileInput.value.value = "";
  }
};

// Get the file upload store
const fileUploadStore = useFileUploadStore();

// Date processing utilities (from datastaging.vue)
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") {
    return null;
  }

  for (const dateFormat of DATE_FORMATS) {
    try {
      const parsedDate = parse(dateStr, dateFormat, new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (error) {
      continue;
    }
  }

  const fallbackDate = new Date(dateStr);
  return isValid(fallbackDate) ? fallbackDate : null;
};

const getDaysUntilExpiration = (expDate: string): number | null => {
  const parsedDate = parseDate(expDate);

  if (!parsedDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return differenceInDays(parsedDate, today);
};

// Business metrics computation (from datastaging.vue)
const businessMetrics = computed(() => {
  if (fileData.value.length === 0)
    return {
      totalSites: 0,
      missingSites: 0,
      totalRental: 0,
      totalPaymentToPay: 0,
      totalDeposit: 0,
    };

  const data = fileData.value;
  const sitesData = data.filter(
    (row) =>
      row["SITE ID"] && row["SITE ID"].toString().toUpperCase() !== "NO ID"
  );
  const missingSites = data.filter(
    (row) =>
      !row["SITE ID"] || row["SITE ID"].toString().toUpperCase() === "NO ID"
  ).length;

  const parseCurrency = (value: any): number => {
    if (!value) return 0;
    const numStr = value.toString().replace(/[RM,\s]/g, "");
    return parseFloat(numStr) || 0;
  };

  const totalRental = data.reduce(
    (sum, row) => sum + parseCurrency(row["TOTAL RENTAL (RM)"]),
    0
  );
  const totalPaymentToPay = data.reduce(
    (sum, row) => sum + parseCurrency(row["TOTAL PAYMENT TO PAY (RM)"]),
    0
  );
  const totalDeposit = data.reduce(
    (sum, row) => sum + parseCurrency(row["DEPOSIT (RM)"]),
    0
  );

  return {
    totalSites: sitesData.length,
    missingSites,
    totalRental,
    totalPaymentToPay,
    totalDeposit,
  };
});

// Expiration metrics computation (from datastaging.vue)
const expirationMetrics = computed(() => {
  if (fileData.value.length === 0)
    return {
      expired: 0,
      within30Days: 0,
      within60Days: 0,
      within90Days: 0,
      invalidDates: 0,
      totalProcessed: 0,
    };

  const data = fileData.value;
  let expired = 0;
  let within30Days = 0;
  let within60Days = 0;
  let within90Days = 0;
  let invalidDates = 0;
  let totalProcessed = 0;

  data.forEach((row) => {
    totalProcessed++;
    const expDate = row["EXP DATE"];
    const daysUntil = getDaysUntilExpiration(expDate?.toString() || "");

    if (daysUntil === null) {
      invalidDates++;
    } else if (daysUntil <= 0) {
      expired++;
    } else if (daysUntil <= 30) {
      within30Days++;
    } else if (daysUntil <= 60) {
      within60Days++;
    } else if (daysUntil <= 90) {
      within90Days++;
    }
  });

  return {
    expired,
    within30Days,
    within60Days,
    within90Days,
    invalidDates,
    totalProcessed,
  };
});

// Format currency helper (from datastaging.vue)
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Commit functionality (from datastaging.vue)
const handleCommitData = async () => {
  try {
    // Use the file upload store instead of localStorage
    const data = fileUploadStore.uploadedData.value;
    
    if (!data.fileData || data.fileData.length === 0) {
      console.error("No data available for processing");
      toast.add({
        title: "No Data",
        description: "Please upload a file first.",
        color: "error",
        duration: 5000,
      });
      return;
    }

    if (
      !Array.isArray(data.fileData) ||
      data.fileData.length === 0
    ) {
      console.error("Invalid data structure:", data);
      throw new Error("Invalid data structure");
    }

    console.log(`Starting processing of ${data.fileData.length} records`);

    // Start the upload process
    uploadState.startUpload();
    uploadState.isUploading.value = true;
    console.log("Upload state initialized, status:", uploadState.status.value);

    // Always use SQLite backend
    console.log("Using SQLite backend for data processing");
    uploadState.updateProgress(15, "Processing with SQLite backend...");

    const result = await sqliteBatchUpload.processBulkUpload(data.fileData);
    console.log("SQLite processing result:", result);

    // Update progress and status
    console.log("Processing completed:", result);
    uploadState.updateProgress(100, `Processing completed successfully.`);
    uploadState.status.value = "complete";

    // Store the job ID for reference in the dashboard
    if (result) {
      // Safely check if jobId exists in the result
      const jobId = result && "jobId" in result ? result.jobId : undefined;
      if (jobId) {
        localStorage.setItem("background_job_id", String(jobId));
        console.log("Job ID stored in localStorage:", jobId);
      }
    }

    // Navigate to dashboard
    console.log("Processing complete, navigating to dashboard");
    await navigateToDashboard();
  } catch (error) {
    console.error("SQLite processing error:", error);
    uploadState.status.value = "error";
    uploadState.error.value = error instanceof Error ? error : new Error(String(error));
    toast.add({
      title: "Error",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
      duration: 5000,
    });
  }
};

const navigateToDashboard = async (): Promise<void> => {
  try {
    console.log("Navigating to dashboard");
    // Clear upload-related data before navigation
    uploadState.isUploading.value = false;
    uploadState.status.value = "idle";

    // Get job ID
    const jobId = localStorage.getItem("background_job_id");
    console.log("Retrieved job ID for dashboard:", jobId);

    // Set a flag to indicate we're coming from processing
    localStorage.setItem("dashboard_building", "true");

    // Navigate to dashboard with job ID if available
    console.log("Redirecting to dashboard with parameters:", {
      job_id: jobId || undefined,
      building: "true",
    });

    await router.push({
      path: "/dashboard",
      query: {
        job_id: jobId || undefined,
        building: "true",
      },
    });

    toast.add({
      title: "Success",
      description: "Upload completed. Redirecting to dashboard.",
      color: "success",
      duration: 5000,
    });
  } catch (error) {
    console.error("Error navigating to dashboard:", error);
    toast.add({
      title: "Error",
      description: "Failed to navigate to dashboard. Please try again.",
      color: "error",
      duration: 5000,
    });
  }
};
</script>
