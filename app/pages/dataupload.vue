<template>
  <div class="space-y-8">
    <!-- File Upload Section -->
    <div class="space-y-4">
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Upload Data</h2>
        </template>
        
        <div class="space-y-4">
          <UFormGroup label="Select File" required>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              @change="handleFileChange"
              class="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-50 file:text-primary-700
                hover:file:bg-primary-100"
            />
          </UFormGroup>
          
          <p v-if="selectedFileName" class="text-sm text-gray-600">
            Selected file: {{ selectedFileName }}
          </p>
          
          <p v-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
          </p>
        </div>
      </UCard>

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
        :description="errorMessage"
      />

      <UAlert
        v-if="uploadStatus === 'success'"
        icon="i-lucide-check-circle"
        color="success"
        title="Upload Complete"
        description="Data successfully stored in database"
      />

      <!-- Data Preview -->
      <UCard v-if="headers.length > 0">
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold">Data Preview</h2>
            <UButton
              v-if="fileData.length > 0"
              size="sm"
              @click="showTransformedPreview = !showTransformedPreview"
            >
              {{ showTransformedPreview ? 'Show Raw' : 'Show Transformed' }}
            </UButton>
          </div>
        </template>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th
                  v-for="header in headers"
                  :key="header"
                  class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ header }}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="(row, index) in previewData" :key="index">
                <td
                  v-for="header in headers"
                  :key="header"
                  class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {{ row[header] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Column Statistics -->
      <UCard v-if="headers.length > 0">
        <template #header>
          <h2 class="text-lg font-semibold">Quality Check</h2>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                  Irregularities: {{ getColumnValidation(column).irregularCells }}
                </span>
              </div>
            </div>
          </UCard>
        </div>
      </UCard>

      <!-- Warning Messages -->
      <UAlert
        v-if="warningMessage"
        icon="i-lucide-alert-triangle"
        color="warning"
        :title="warningMessage"
      />

      <!-- Action Buttons -->
      <div class="flex justify-between items-center">
        <UButton
          label="Clear"
          variant="soft"
          color="gray"
          @click="clearAll"
          :disabled="!selectedFile"
        />
        
        <UButton
          label="Process File"
          trailing-icon="i-lucide-arrow-right"
          variant="solid"
          color="primary"
          :loading="isProcessing"
          :disabled="!selectedFile"
          @click="processFile"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parse, isValid, format } from "date-fns";
import type { Database } from '~/types/database.types'
import { generateTableSQL } from '../utils/schemaUtils'
import { generateSchemaHash, compareSchemas, isSchemaMigrationNeeded } from '~/utils/schemaVersioning'
import SchemaMigrationModal from '~/components/SchemaMigrationModal.vue'
import { useOverlay } from '#ui/composables/useOverlay'

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

interface ColumnSchema {
  name: string;
  type: 'date' | 'currency' | 'number' | 'text' | 'unknown';
  sample: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    row: number;
    field: string;
    value: any;
    message: string;
  }>;
}

interface UploadResult {
  success: boolean;
  error?: string;
  uploadedCount: number;
}

const router = useRouter();
const selectedFileName = ref("");
const errorMessage = ref("");
const selectedFile = ref<File | null>(null);
const isProcessing = ref(false);
const fileData = ref<FileRow[]>([]);
const headers = ref<string[]>([]);
const tableName = 'site_data' // Using the default table name from your migrations
const uploadErrors = ref<Array<{ batchIndex: number; error: string }>>([]);

const hasEmptyCells = computed(() => {
  return getTotalMissingValues() > 0;
});

const detectedSchema = computed((): ColumnSchema[] => {
  if (!fileData.value.length || !headers.value.length) return [];

  return headers.value.map(header => ({
    name: header,
    type: 'unknown' as const,
    sample: String(fileData.value[0]?.[header] ?? 'N/A')
  }));
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

    // Add this new section
    if (fileData.value.length > 0) {
      const result = await uploadWithFallback(fileData.value);
      if (!result.success) {
        errorMessage.value = result.error ?? 'Upload failed';
      }
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
const batchSize = 100 // Number of records to upload in each batch

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

const uploadWithRetry = async (batch: any[], batchIndex: number, attempts = 3) => {
  try {
    const { error } = await supabase
      .from('site_data')
      .insert(batch as Database['public']['Tables']['site_data']['Insert'][])
    
    if (error) {
      throw new Error(`Batch ${batchIndex + 1}: ${error.message}`)
    }
    return { error: null }
  } catch (error) {
    if (attempts <= 1) {
      uploadErrors.value.push({
        batchIndex,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { error }
    }
    await new Promise(r => setTimeout(r, 1000))
    return uploadWithRetry(batch, batchIndex, attempts - 1)
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
      sample: sample != null ? String(sample) : 'N/A'
    };
  });
};

const validateTransformedData = (data: Record<string, any>[], schema: ColumnSchema[]): ValidationResult => {
  const errors = [];
  
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    
    // Validate required fields
    const requiredFields = ['site_id', 'exp_date', 'total_rental', 'total_payment', 'deposit'];
    
    for (const field of requiredFields) {
      const value = row?.[field];
      if (value === null || value === undefined || value === '') {
        errors.push({
          row: rowIndex + 1,
          field,
          value,
          message: `${field} is required`
        });
      }
    }
    
    // Validate numeric fields are positive
    const numericFields = ['total_rental', 'total_payment', 'deposit'];
    for (const field of numericFields) {
      const value = row?.[field];
      if (typeof value === 'number' && value < 0) {
        errors.push({
          row: rowIndex + 1,
          field,
          value,
          message: `${field} cannot be negative`
        });
      }
    }
    
    // Validate date field
    if (row?.exp_date && !(row?.exp_date instanceof Date)) {
      errors.push({
        row: rowIndex + 1,
        field: 'exp_date',
        value: row.exp_date,
        message: 'Invalid date format'
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Add validation state
const validationResult = ref<ValidationResult>({ isValid: true, errors: [] });

const handleProceed = async () => {
  if (!fileData.value.length) return
  
  try {
    // Reset error states
    uploadStatus.value = 'uploading'
    uploadProgress.value = 0
    uploadErrors.value = []
    errorMessage.value = ''
    
    const schema = detectColumnTypes(fileData.value)
    const transformedData = fileData.value.map(row => transformForUpload(row, schema))
    validationResult.value = validateTransformedData(transformedData, schema)
    
    if (!validationResult.value.isValid) {
      throw new Error('Validation failed. Please fix the errors before uploading.')
    }
    
    // Prepare data in batches
    const batches = []
    for (let i = 0; i < transformedData.length; i += batchSize) {
      batches.push(transformedData.slice(i, i + batchSize))
    }
    
    // Upload batches with enhanced error handling
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      if (!batch) continue
      
      const { error } = await uploadWithRetry(batch, i)
      if (error) {
        // Continue with remaining batches even if one fails
        console.error(`Batch ${i + 1} failed:`, error)
      }
      
      uploadProgress.value = Math.round(((i + 1) / batches.length) * 100)
    }
    
    // Store in localStorage as fallback
    localStorage.setItem('uploadedFileData', JSON.stringify({
      fileData: fileData.value,
      headers: headers.value,
      fileName: selectedFileName.value,
      uploadErrors: uploadErrors.value
    }))
    
    if (uploadErrors.value.length > 0) {
      uploadStatus.value = 'error'
      errorMessage.value = `Upload completed with ${uploadErrors.value.length} batch errors`
    } else {
      uploadStatus.value = 'success'
      await new Promise(resolve => setTimeout(resolve, 1000))
      router.push('/dashboard')
    }
    
  } catch (error) {
    console.error('Upload error:', error)
    uploadStatus.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'An unknown error occurred'
    
    // Ensure data is saved to localStorage even if upload fails
    localStorage.setItem('uploadedFileData', JSON.stringify({
      fileData: fileData.value,
      headers: headers.value,
      fileName: selectedFileName.value,
      error: errorMessage.value
    }))
  }
}

const showMigrationDialog = async (changes: ReturnType<typeof compareSchemas>) => {
  const modal = overlay.create(SchemaMigrationModal, {
    props: {
      changes
    }
  })
  
  return await modal.open()
}

const overlay = useOverlay()

// onUnmounted(() => {
//   localStorage.removeItem("uploadedFileData");
// });

// Add these new refs and computed properties
const showTransformedPreview = ref(false)
const previewLimit = ref(5)

const transformedPreview = computed(() => {
  if (!fileData.value.length) return []
  
  const schema = detectColumnTypes(fileData.value)
  return fileData.value
    .slice(0, previewLimit.value)
    .map(row => transformForUpload(row, schema))
})

const previewColumns = computed(() => {
  if (!transformedPreview.value.length) return []
  
  // Get all unique keys from transformed data
  const allKeys = new Set<string>()
  transformedPreview.value.forEach(row => {
    Object.keys(row).forEach(key => allKeys.add(key))
  })
  
  // Sort keys to ensure consistent order
  // Put important fields first
  const priorityFields = ['site_id', 'exp_date', 'total_rental', 'total_payment', 'deposit']
  return [
    ...priorityFields.filter(field => allKeys.has(field)),
    ...Array.from(allKeys)
      .filter(key => !priorityFields.includes(key))
      .sort()
  ]
})

const formatPreviewValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  if (value instanceof Date) return value.toLocaleDateString()
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Add these new interfaces and refs
interface CleanupOption {
  id: string
  label: string
  description: string
  icon: string
  apply: () => void
  previewCount?: number
}

interface CleanupPreview {
  field: string
  oldValue: any
  newValue: any
  rowIndex: number
}

const selectedCleanupOptions = ref<Set<string>>(new Set())
const cleanupPreviews = ref<Record<string, CleanupPreview[]>>({})

// Add cleanup options
const cleanupOptions = computed((): CleanupOption[] => {
  if (!fileData.value.length) return []

  return [
    {
      id: 'trim-whitespace',
      label: 'Trim Whitespace',
      description: 'Remove leading and trailing spaces from text fields',
      icon: 'i-lucide-scissors',
      previewCount: countWhitespaceIssues(),
      apply: () => applyTrimWhitespace()
    },
    {
      id: 'standardize-dates',
      label: 'Standardize Dates',
      description: `Convert all dates to ${DATE_FORMATS[0]} format`,
      icon: 'i-lucide-calendar',
      previewCount: getInvalidDateCount(),
      apply: () => applyStandardizeDates()
    },
    {
      id: 'format-currency',
      label: 'Format Currency',
      description: 'Remove currency symbols and standardize number format',
      icon: 'i-lucide-currency',
      previewCount: getInvalidCurrencyCount(),
      apply: () => applyFormatCurrency()
    },
    {
      id: 'remove-dashes',
      label: 'Convert Dashes to Null',
      description: 'Convert "-", "–", "—" to null values',
      icon: 'i-lucide-minus',
      previewCount: getTotalDashValues(),
      apply: () => applyRemoveDashes()
    }
  ]
})

// Add cleanup functions
const countWhitespaceIssues = (): number => {
  return headers.value.reduce((count, header) => {
    return count + fileData.value.filter(row => {
      const value = row[header]
      return typeof value === 'string' && value.trim() !== value
    }).length
  }, 0)
}

const applyTrimWhitespace = () => {
  const previews: CleanupPreview[] = []
  
  fileData.value = fileData.value.map((row, rowIndex) => {
    const newRow = { ...row }
    headers.value.forEach(header => {
      const value = row[header]
      if (typeof value === 'string' && value.trim() !== value) {
        previews.push({
          field: header,
          oldValue: value,
          newValue: value.trim(),
          rowIndex
        })
        newRow[header] = value.trim()
      }
    })
    return newRow
  })
  
  cleanupPreviews.value['trim-whitespace'] = previews
}

const applyStandardizeDates = () => {
  const previews: CleanupPreview[] = []
  const targetFormat = DATE_FORMATS[0]
  
  fileData.value = fileData.value.map((row, rowIndex) => {
    const newRow = { ...row }
    headers.value.forEach(header => {
      if (header.toLowerCase().includes('date')) {
        const value = row[header]
        if (value && !isValidDate(value)) {
          try {
            const standardizedDate = parseDate(value.toString())
            if (standardizedDate) {
              previews.push({
                field: header,
                oldValue: value,
                newValue: format(standardizedDate, targetFormat || 'dd/MM/yyyy'),
                rowIndex
              })
              newRow[header] = format(standardizedDate, targetFormat || 'dd/MM/yyyy')
            }
          } catch (error) {
            // Skip invalid dates
          }
        }
      }
    })
    return newRow
  })
  
  cleanupPreviews.value['standardize-dates'] = previews
}

const applyFormatCurrency = () => {
  const previews: CleanupPreview[] = []
  
  fileData.value = fileData.value.map((row, rowIndex) => {
    const newRow = { ...row }
    headers.value.forEach(header => {
      if (header.toLowerCase().includes('rental') || 
          header.toLowerCase().includes('payment') || 
          header.toLowerCase().includes('deposit')) {
        const value = row[header]
        if (value && !isValidCurrency(value)) {
          const numericValue = parseFloat(value.toString().replace(/[^0-9.-]+/g, ''))
          if (!isNaN(numericValue)) {
            previews.push({
              field: header,
              oldValue: value,
              newValue: numericValue.toFixed(2),
              rowIndex
            })
            newRow[header] = numericValue.toFixed(2)
          }
        }
      }
    })
    return newRow
  })
  
  cleanupPreviews.value['format-currency'] = previews
}

const applyRemoveDashes = () => {
  const previews: CleanupPreview[] = []
  
  fileData.value = fileData.value.map((row, rowIndex) => {
    const newRow = { ...row }
    headers.value.forEach(header => {
      const value = row[header]
      if (value === '-' || value === '–' || value === '—') {
        previews.push({
          field: header,
          oldValue: value,
          newValue: null,
          rowIndex
        })
        newRow[header] = null
      }
    })
    return newRow
  })
  
  cleanupPreviews.value['remove-dashes'] = previews
}

const applySelectedCleanups = () => {
  selectedCleanupOptions.value.forEach(optionId => {
    const option = cleanupOptions.value.find(opt => opt.id === optionId)
    option?.apply()
  })
  
  // Revalidate after cleanup
  const schema = detectColumnTypes(fileData.value)
  const transformedData = fileData.value.map(row => transformForUpload(row, schema))
  validationResult.value = validateTransformedData(transformedData, schema)
}

const uploadWithFallback = async (data: FileRow[]): Promise<UploadResult> => {
  uploadStatus.value = 'uploading'
  uploadProgress.value = 0
  
  try {
    // Attempt Supabase upload
    const { error } = await supabase.from('site_data').insert(
      data.map(row => ({
        ...transformForUpload(row, detectColumnTypes(fileData.value)),
        upload_batch_id: crypto.randomUUID(),
        file_name: selectedFileName.value
      }))
    )
    
    if (error) throw error
    
    uploadStatus.value = 'success'
    return { success: true, uploadedCount: data.length }
  } catch (error) {
    console.error('Supabase upload failed:', error)
    
    // Fallback to localStorage
    localStorage.setItem('uploadedFileData', JSON.stringify({
      fileData: data,
      headers: headers.value,
      fileName: selectedFileName.value
    }))
    
    uploadStatus.value = 'error'
    return {
      success: false,
      error: 'Database upload failed. Data saved locally.',
      uploadedCount: 0
    }
  }
}
</script>

<template>
  <!-- ... existing template code ... -->
</template>
