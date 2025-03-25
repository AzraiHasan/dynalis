<template>
  <div>
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
            color="error"
            variant="soft"
            @click="clearAll"
          />
        </div>
      </div>
    </UCard>

    <!-- Data Analysis Section -->
    <div v-if="fileData.length > 0" class="grid gap-4 mb-4">
      <!-- Dataset Summary -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Dataset Summary</h2>
        </template>
        <div class="space-y-2">
          <p>Total Rows: {{ fileData.length }}</p>
          <p>Total Columns: {{ headers.length }}</p>
          <p>Column Names: {{ headers.join(", ") }}</p>
          <p>Missing Values: {{ getTotalMissingValues() }}</p>
          <p>Dash Values: {{ getTotalDashValues() }}</p>
          <!-- Proceed Section -->
          <div v-if="fileData.length > 0" class="mt-6">
            <div
              class="mb-4 p-4 rounded-lg"
              :class="
                hasEmptyCells
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-green-50 text-green-700'
              "
            >
              <p v-if="hasEmptyCells">
                Empty cells and data irregularities may cause error during
                further analysis, please rectify before you decide to proceed
              </p>
              <p v-else>You have no empty cells. Click NEXT to proceed</p>
            </div>

            <UButton
              label="Proceed"
              trailing-icon="i-lucide-arrow-right"
              variant="outline"
              :color="hasEmptyCells ? 'warning' : 'primary'"
              @click="handleProceed"
            />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Column Statistics -->
    <div class="my-6">
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Quality Check</h2>
        </template>
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <UCard v-for="column in headers" :key="column" class="bg-gray-50">
            <template #header>
              <h3 class="font-medium text-sm">{{ column }}</h3>
            </template>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-alert-circle" class="text-gray-500" />
                <span class="text-sm text-gray-600">
                  Empty Cells: {{ getColumnValidation(column).emptyCells }}
                </span>
              </div>
              <div
                v-if="getColumnValidation(column).irregularCells > 0"
                class="flex items-center gap-2"
              >
                <Icon name="i-lucide-alert-triangle" class="text-orange-500" />
                <span class="text-sm text-orange-600">
                  Irregularities:
                  {{ getColumnValidation(column).irregularCells }}
                </span>
              </div>
            </div>
          </UCard>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import { useFileUpload } from "~/composables/useFileUpload";

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

interface StoredData {
  fileData: FileRow[];
  headers: string[];
  fileName: string;
}

const router = useRouter();
const selectedFileName = ref("");
const errorMessage = ref("");
const selectedFile = ref<File | null>(null);
const isProcessing = ref(false);
const fileData = ref<FileRow[]>([]);
const headers = ref<string[]>([]);
const fileUpload = useFileUpload();
const toast = useToast()

const hasEmptyCells = computed(() => {
  return getTotalMissingValues() > 0;
});

const handleFileChange = (event: Event) => {
  errorMessage.value = "";
  selectedFileName.value = "";
  fileData.value = [];
  headers.value = [];

  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    errorMessage.value = "Please select a file";
    return;
  }

  const validExtensions = [".csv", ".xlsx", ".xls"];
  const fileExtension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf("."));

  if (!validExtensions.includes(fileExtension)) {
    errorMessage.value = "Please upload only Excel or CSV files";
    input.value = "";
    return;
  }

  selectedFileName.value = file.name;
  selectedFile.value = file;
};

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
  } catch (error) {
    errorMessage.value =
      "Error processing file: " +
      (error instanceof Error ? error.message : "Unknown error");
  } finally {
    isProcessing.value = false;
  }
};

const processCSV = (file: File): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        fileData.value = results.data as FileRow[];
        headers.value = results.meta.fields || [];
        resolve(results);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

const processExcel = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Excel file is empty");
  }

  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error("Worksheet not found");
  }

  if (!worksheet["!ref"]) {
    throw new Error("Worksheet is empty");
  }

  const data = XLSX.utils.sheet_to_json<FileRow>(worksheet, { raw: false });

  if (data.length === 0) {
    throw new Error("No data found in worksheet");
  }

  fileData.value = data;
  headers.value = Object.keys(data[0] || {});
};

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

const getEmptyCellCount = (column: string): number => {
  return fileData.value.filter(
    (row) =>
      row[column] === null || row[column] === undefined || row[column] === ""
  ).length;
};

// Define accepted date formats
const DATE_FORMATS = [
  "dd/MM/yyyy",
  "dd-MM-yyyy",
  "yyyy/MM/dd",
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "MM-dd-yyyy",
];

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

const clearAll = () => {
  selectedFileName.value = "";
  errorMessage.value = "";
  selectedFile.value = null;
  isProcessing.value = false;
  fileData.value = [];
  headers.value = [];

  const fileInput = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  if (fileInput) {
    fileInput.value = "";
  }
};

const handleProceed = () => {
  try {
    const stored = localStorage.getItem("uploadedFileData");
    console.log("Before navigation - localStorage data:", stored);
    
    if (!stored) {
      toast.add({
        title: "No Data",
        description: "Please upload a file first.",
        color: "error"
      });
      return;
    }
    
    // Navigate without modifying localStorage
    router.push({
      path: "/datastaging",
      query: { fileName: selectedFileName.value },
    });
  } catch (error) {
    console.error("Error navigating:", error);
  }
};

// onUnmounted(() => {
//   localStorage.removeItem("uploadedFileData");
// });
</script>
