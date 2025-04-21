<template>
  <div>
    <UCard class="mb-6">
      <template #header>
        <h1 class="text-xl font-semibold">Data Upload</h1>
      </template>

      <MappingInitializer
        v-if="currentStep === 1"
        @statusChanged="handleMappingStatusChange"
        class="mb-6"
      />

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
          v-if="mappingState.isInitialized.value"
          class="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-gray-50 transition"
          :class="dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'"
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

        <div v-else class="border-2 border-dashed rounded-lg p-10 text-center border-gray-200 bg-gray-50">
          <UIcon name="i-lucide-lock" class="text-gray-400 mx-auto h-12 w-12 mb-4" />
          <h3 class="text-lg font-medium text-gray-600">Initialize mapping framework first</h3>
          <p class="text-sm text-gray-500">Please initialize the mapping framework above before uploading files</p>
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
            v-if="selectedFileName && mappingState.isInitialized.value"
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

        <div class="mb-6">
          <h3 class="text-lg font-medium mb-2 flex items-center">
            <Icon name="i-lucide-git-merge" class="mr-2 text-gray-600" />
            Header Mapping
          </h3>

          <div class="bg-gray-50 p-4 rounded-md mb-4">
            <p class="text-sm text-gray-600">
              Map your file columns to standard system fields. This helps
              standardize data across uploads.
            </p>
          </div>

          <HeaderMappingPanel
            :file-headers="headers"
            :system-fields="systemFields"
            :initial-mapping="currentMapping"
            @update="updateMapping"
            @save="saveMapping"
          />
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
            @click="handleProceed"
          >
            Continue to Analysis
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useFileUpload } from "~/composables/useFileUpload";
import type { StepperItem } from "@nuxt/ui";
import { parse, isValid } from "date-fns";
import { DATE_FORMATS } from "~/utils/dateUtils";
import { useHeaderMapping } from "~/composables/useHeaderMapping";
import HeaderMappingPanel from "~/components/HeaderMappingPanel.vue";
import MappingInitializer from "~/components/MappingInitializer.vue";
import { useMappingState } from '~/composables/useMappingState'

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
const { systemFields, fetchSystemFields } = useHeaderMapping();
const currentMapping = ref<Record<string, string>>({});
const mappingSaved = ref(false);
const mappingState = useMappingState();

function handleMappingStatusChange(status: boolean): void {
  console.log("Mapping status changed:", status);
  mappingState.isInitialized.value = status;
  console.log("Updated isInitialized:", mappingState.isInitialized.value);
}

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
]);

// Control stepper interaction - Step 2 should be disabled until file is processed
const stepperDisabled = computed(() => {
  return fileData.value.length === 0;
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

  console.log("File selected:", file.name, file.type, file.size);
};

async function loadSystemFields() {
  try {
    await fetchSystemFields();
  } catch (error) {
    console.error("Failed to load system fields:", error);
    toast.add({
      title: "Error",
      description: "Failed to load mapping fields",
      color: "error",
    });
  }
}

function updateMapping(mapping: Record<string, string>) {
  currentMapping.value = mapping;
  mappingSaved.value = false;
}

async function saveMapping(mapping: Record<string, string>) {
  try {
    // Add save logic here
    mappingSaved.value = true;
    toast.add({
      title: "Success",
      description: "Mapping configuration saved",
      color: "success",
    });
  } catch (error) {
    console.error("Failed to save mapping:", error);
    toast.add({
      title: "Error",
      description: "Failed to save mapping configuration",
      color: "error",
    });
  }
}

onMounted(() => {
  loadSystemFields();
});
// Process file and move to next step
const processFile = async () => {
  if (!selectedFile.value) {
    errorMessage.value = "No file selected";
    return;
  }

  isProcessing.value = true;
  errorMessage.value = "";

  try {
    console.log("Starting file processing...");
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
  console.log("File processing complete:", {
  rows: fileData.value.length,
  headers: headers.value
});
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

// Navigation to next page
const handleProceed = () => {
  try {
    const stored = localStorage.getItem("uploadedFileData");

    if (!stored) {
      toast.add({
        title: "No Data",
        description: "Please upload a file first.",
        color: "error",
      });
      return;
    }

    // Navigate to data staging
    router.push({
      path: "/datastaging",
      query: { fileName: selectedFileName.value },
    });
  } catch (error) {
    console.error("Error navigating:", error);
  }
};
</script>
