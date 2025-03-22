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

    <!-- Add this after the file upload card -->
    <UAlert
      v-if="uploadStatus === 'uploading'"
      color="info"
      class="mb-4"
    >
      <div class="flex flex-col gap-2">
        <p>Uploading data to database...</p>
        <UProgress
          v-model="uploadProgress"
          class="w-full"
        />
      </div>
    </UAlert>

    <UAlert
      v-if="uploadStatus === 'error'"
      color="error"
      class="mb-4"
    >
      <p>{{ errorMessage }}</p>
      <p class="text-sm mt-1">Your data is safely stored locally. You can try uploading again or proceed to the dashboard.</p>
    </UAlert>

    <!-- Data Analysis Section -->
    <div
      v-if="fileData.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"
    >
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
        </div>
      </UCard>

      <!-- Add this after the Dataset Summary card -->
      <UCard v-if="fileData.length > 0">
        <template #header>
          <h2 class="text-lg font-semibold">Schema Detection</h2>
        </template>
        <div class="space-y-4">
          <div v-for="column in detectedSchema" :key="column.name" class="flex items-center gap-4">
            <p class="font-medium w-1/3">{{ column.name }}</p>
            <UBadge :color="column.type === 'unknown' ? 'info' : 'success'">
              {{ column.type }}
            </UBadge>
            <p class="text-sm text-gray-500">Sample: {{ column.sample }}</p>
          </div>
        </div>
      </UCard>

      <!-- Add this before the Proceed Section -->
      <div class="space-y-4">
        <!-- Upload Status -->
        <UAlert
          v-if="uploadStatus === 'uploading'"
          icon="i-lucide-upload"
          color="info"
          title="Uploading Data"
          :description="`Progress: ${uploadProgress}%`"
        >
          <UProgress v-model="uploadProgress" color="info" />
        </UAlert>

        <UAlert
          v-if="uploadStatus === 'error'"
          icon="i-lucide-alert-triangle"
          color="error"
          title="Upload Error"
          description="Falling back to local storage"
        />

        <UAlert
          v-if="uploadStatus === 'success'"
          icon="i-lucide-check-circle"
          color="success"
          title="Upload Complete"
          description="Data successfully stored in database"
        />

        <!-- Required Fields Validation -->
        <div v-if="fileData.length > 0" class="space-y-2">
          <h3 class="font-semibold">Required Fields Status:</h3>
          <div class="grid gap-2">
            <div v-for="field in requiredFields" :key="field">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="isFieldValid(field) ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
                  :class="isFieldValid(field) ? 'text-green-500' : 'text-red-500'"
                />
                <span>{{ field }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Data Quality Summary -->
        <div v-if="fileData.length > 0" class="p-4 bg-gray-50 rounded-lg">
          <h3 class="font-semibold mb-2">Data Quality Summary:</h3>
          <ul class="space-y-1">
            <li>Total Records: {{ fileData.length }}</li>
            <li>Empty Cells: {{ getTotalMissingValues() }}</li>
            <li>Invalid Date Formats: {{ getInvalidDateCount() }}</li>
            <li>Invalid Currency Formats: {{ getInvalidCurrencyCount() }}</li>
          </ul>
        </div>
      </div>

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
            Empty cells and data irregularities may cause error during further analysis, please rectify
            before you decide to proceed
          </p>
          <p v-else>You have no empty cells. Click NEXT to proceed</p>
        </div>
        
          <UButton
            label="Proceed"
            trailing-icon="i-lucide-arrow-right"
            variant="outline"
            :color="hasEmptyCells ? 'warning' : 'primary'"
            :disabled="!isDataValid"
            @click="handleProceed"
          />
        
      </div>

      <!-- Column Statistics -->
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
import type { Database } from '~/types/database.types'
import { generateTableSQL } from '../utils/schemaUtils'
import { generateSchemaHash, compareSchemas, isSchemaMigrationNeeded } from '~/utils/schemaVersioning'

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

interface SiteDataRow {
  site_id: string | null;
  exp_date: Date | null;
  total_rental: number;
  total_payment: number;
  deposit: number;
  upload_batch_id: string;
  file_name: string;
  raw_data: FileRow;
  column_headers: string[];
}

interface ColumnSchema {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'unknown';
  sample: any;
}

const router = useRouter();
const selectedFileName = ref("");
const errorMessage = ref("");
const selectedFile = ref<File | null>(null);
const isProcessing = ref(false);
const fileData = ref<FileRow[]>([]);
const headers = ref<string[]>([]);
const tableName = 'site_data' // Using the default table name from your migrations

const hasEmptyCells = computed(() => {
  return getTotalMissingValues() > 0;
});

const detectedSchema = computed((): ColumnSchema[] => {
  if (!fileData.value.length || !headers.value.length) return [];

  return headers.value.map(header => {
    const sample = fileData.value[0]?.[header];
    let type: ColumnSchema['type'] = 'unknown';

    // Check first non-null value in the column
    const firstNonNull = fileData.value.find(row => row[header] != null)?.[header];

    if (firstNonNull != null) {
      if (isValidDate(firstNonNull)) {
        type = 'date';
      } else if (isValidCurrency(firstNonNull)) {
        type = 'currency';
      } else if (!isNaN(Number(firstNonNull))) {
        type = 'number';
      } else {
        type = 'text';
      }
    }

    return {
      name: header,
      type,
      sample: sample ?? 'N/A'
    };
  });
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
    const fileExtension = selectedFile.value.name
      .toLowerCase()
      .substring(selectedFile.value.name.lastIndexOf("."));

    if (fileExtension === ".csv") {
      await processCSV(selectedFile.value);
    } else {
      await processExcel(selectedFile.value);
    }
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

const supabase = useSupabaseClient<Database>()
const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
const uploadProgress = ref(0)

const requiredFields = [
  'SITE ID',
  'EXP DATE',
  'TOTAL RENTAL (RM)',
  'TOTAL PAYMENT TO PAY (RM)',
  'DEPOSIT (RM)'
]

const isFieldValid = (field: string): boolean => {
  if (!fileData.value.length) return false
  
  return !fileData.value.some(row => {
    const value = row[field]
    if (!value) return true

    switch (field) {
      case 'EXP DATE':
        return !isValidDate(value)
      case 'TOTAL RENTAL (RM)':
      case 'TOTAL PAYMENT TO PAY (RM)':
      case 'DEPOSIT (RM)':
        return !isValidCurrency(value)
      case 'SITE ID':
        return !value.toString().trim()
      default:
        return false
    }
  })
}

const getInvalidDateCount = (): number => {
  return fileData.value.filter(row => {
    const date = row['EXP DATE']
    return date && !isValidDate(date)
  }).length
}

const getInvalidCurrencyCount = (): number => {
  const currencyFields = [
    'TOTAL RENTAL (RM)',
    'TOTAL PAYMENT TO PAY (RM)',
    'DEPOSIT (RM)'
  ]
  
  return currencyFields.reduce((count, field) => {
    return count + fileData.value.filter(row => {
      const value = row[field]
      return value && !isValidCurrency(value)
    }).length
  }, 0)
}

// Add computed property for overall validation
const isDataValid = computed(() => {
  return requiredFields.every(field => isFieldValid(field))
})

// Modify the existing warning message section
const warningMessage = computed(() => {
  if (!isDataValid.value) {
    return 'Please fix validation errors before proceeding'
  }
  if (hasEmptyCells.value) {
    return 'Empty cells and data irregularities may cause errors during analysis'
  }
  return null
})

const uploadWithRetry = async (batch: any[], attempts = 3) => {
  try {
    const { error } = await supabase
      .from('site_data')
      .insert(batch as Database['public']['Tables']['site_data']['Insert'][])
    
    if (error) throw error
    return { error: null }
  } catch (error) {
    if (attempts <= 1) return { error }
    await new Promise(r => setTimeout(r, 1000))
    return uploadWithRetry(batch, attempts - 1)
  }
}

const transformForUpload = (row: FileRow, schema: ColumnSchema[]) => {
  const transformed: Record<string, any> = {
    upload_batch_id: crypto.randomUUID(),
    file_name: selectedFileName.value,
    raw_data: row,
    column_headers: headers.value
  };

  schema.forEach(col => {
    const value = row[col.name];
    switch (col.type) {
      case 'date':
        transformed[col.name.toLowerCase()] = value ? parseDate(value.toString()) : null;
        break;
      case 'currency':
      case 'number':
        transformed[col.name.toLowerCase()] = parseFloat(value?.toString() || '0');
        break;
      default:
        transformed[col.name.toLowerCase()] = value?.toString();
    }
  });

  return transformed;
};

const detectColumnTypes = (data: FileRow[]): ColumnSchema[] => {
  if (!data.length || !headers.value.length) return [];

  return headers.value.map(header => {
    const sample = data[0]?.[header];
    let type: ColumnSchema['type'] = 'unknown';

    // Check first non-null value in the column
    const firstNonNull = data.find(row => row[header] != null)?.[header];

    if (firstNonNull != null) {
      if (isValidDate(firstNonNull)) {
        type = 'date';
      } else if (isValidCurrency(firstNonNull)) {
        type = 'currency';
      } else if (!isNaN(Number(firstNonNull))) {
        type = 'number';
      } else {
        type = 'text';
      }
    }

    return {
      name: header,
      type,
      sample: sample ?? 'N/A'
    };
  });
};

const handleProceed = async () => {
  try {
    uploadStatus.value = 'uploading'
    
    // Detect schema
    const schema = detectColumnTypes(fileData.value)
    const schemaHash = generateSchemaHash(schema)
    
    // Check existing schema version
    const { data: existingVersion } = await supabase
      .from('schema_versions')
      .select('*')
      .eq('table_name', tableName)
      .eq('is_current', true)
      .single()
    
    if (existingVersion) {
      const changes = compareSchemas(
        schema,
        existingVersion.schema_definition
      )
      
      if (isSchemaMigrationNeeded(changes)) {
        // Show migration confirmation dialog
        const shouldMigrate = await showMigrationDialog(changes)
        if (!shouldMigrate) {
          uploadStatus.value = 'idle'
          return
        }
      }
      
      // Create new version if schema changed
      if (existingVersion.hash !== schemaHash) {
        const { error: versionError } = await supabase
          .from('schema_versions')
          .insert({
            table_name: tableName,
            version: existingVersion.version + 1,
            schema_definition: schema,
            hash: schemaHash
          })
        
        if (versionError) throw versionError
      }
    } else {
      // Create initial schema version
      const { error: versionError } = await supabase
        .from('schema_versions')
        .insert({
          table_name: tableName,
          version: 1,
          schema_definition: schema,
          hash: schemaHash
        })
      
      if (versionError) throw versionError
    }
    
    // Continue with table creation and data upload...
    // (previous implementation)
    
  } catch (error) {
    console.error("Error during upload:", error)
    uploadStatus.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'An unknown error occurred'
  }
}

const showMigrationDialog = async (changes: ReturnType<typeof compareSchemas>) => {
  return await useConfirmDialog({
    title: 'Schema Changes Detected',
    content: `
      The following changes were detected:
      ${changes.removed.length ? `\nRemoved columns: ${changes.removed.join(', ')}` : ''}
      ${changes.typeChanged.length ? `\nChanged types: ${changes.typeChanged.map(c => 
        `${c.column} (${c.from} → ${c.to})`).join(', ')}` : ''}
      
      Do you want to create a new schema version?
    `,
    confirmLabel: 'Create New Version',
    cancelLabel: 'Cancel Upload'
  })
}

// onUnmounted(() => {
//   localStorage.removeItem("uploadedFileData");
// });
</script>
