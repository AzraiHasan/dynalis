// app/composables/useSQLiteBatchUpload.ts
import { ref, computed } from 'vue'
import type { Site } from '~/types/supabase'

// Define state interface for type safety
interface UploadState {
  status: 'idle' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  error: Error | null;
  totalBatches: number;
  processedBatches: number;
  processedRecords: number;
}

export const useSQLiteBatchUpload = () => {
  const state = ref<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    totalBatches: 0,
    processedBatches: 0,
    processedRecords: 0,
  })
  
  const isUploading = computed(() => 
    ['preparing', 'uploading', 'processing'].includes(state.value.status)
  )
  
  const processBulkUpload = async (data: FileRow[]) => {
    try {
      // Reset state
      state.value = {
        status: 'preparing',
        progress: 0,
        error: null,
        totalBatches: 0,
        processedBatches: 0,
        processedRecords: 0,
      }

      // Transform data to match expected site structure
      const transformedData = data.map((row: FileRow) => ({
        site_id: row["SITE ID"]?.toString() || "NO ID",
        exp_date: row["EXP DATE"] || null,
        total_rental: parseFloat(
          (row["TOTAL RENTAL (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
        ),
        total_payment_to_pay: parseFloat(
          (row["TOTAL PAYMENT TO PAY (RM)"]?.toString() || "0").replace(
            /[RM,\s]/g, ""
          )
        ),
        deposit: parseFloat(
          (row["DEPOSIT (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
        ),
      }))
      
      state.value.status = 'uploading'
      state.value.progress = 10

      // Use new server-side API
      const response = await fetch('/api/sites/batch-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites: transformedData }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Upload failed')
      }
      
      const result = await response.json()
      
      state.value.status = 'complete'
      state.value.progress = 100
      state.value.processedRecords = result.count
      
      return { success: true, processedRecords: result.count }
    } catch (error) {
      state.value.status = 'error'
      state.value.error = error instanceof Error ? error : new Error(String(error))
      throw error
    }
  }
  
  return {
    processBulkUpload,
    state,
    isUploading,
    progress: computed(() => state.value.progress)
  }
}