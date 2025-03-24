// composables/useBatchUploadService.ts
import { ref, computed } from 'vue'
import { useSupabaseClient } from '#imports'
import { parseDate } from '~/utils/dateUtils'
import type { Database } from '~/types/supabase'

interface BatchUploadState {
  status: 'idle' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  error: Error | null;
  totalBatches: number;
  processedBatches: number;
  processedRecords: number;
}

// Define the shape of site data to match our database schema
type SiteInsert = Database['public']['Tables']['sites']['Insert']

export const useBatchUploadService = () => {
  const supabase = useSupabaseClient<Database>()
  const state = ref<BatchUploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    totalBatches: 0,
    processedBatches: 0,
    processedRecords: 0
  })

  const isUploading = computed(() => 
    ['preparing', 'uploading', 'processing'].includes(state.value.status)
  )
  
  // Process data through batched inserts
  const processBulkUpload = async (data: any[]): Promise<any> => {
    try {
      // Reset state
      state.value = {
        status: 'preparing',
        progress: 0,
        error: null,
        totalBatches: 0,
        processedBatches: 0,
        processedRecords: 0
      }

      // Transform data to match database schema
      const transformedData: SiteInsert[] = data.map(row => ({
        site_id: row['SITE ID']?.toString() || 'NO ID',
        exp_date: row['EXP DATE'] ? parseDate(row['EXP DATE']?.toString() || '')?.toISOString() || null : null,
        total_rental: parseFloat((row['TOTAL RENTAL (RM)']?.toString() || '0').replace(/[RM,\s]/g, '')),
        total_payment_to_pay: parseFloat((row['TOTAL PAYMENT TO PAY (RM)']?.toString() || '0').replace(/[RM,\s]/g, '')),
        deposit: parseFloat((row['DEPOSIT (RM)']?.toString() || '0').replace(/[RM,\s]/g, '')),
        updated_at: new Date().toISOString()
      }))
      
      // Process in batches for better performance
      const batchSize = 100
      const batches = Math.ceil(transformedData.length / batchSize)
      state.value.totalBatches = batches
      state.value.status = 'uploading'
      
      let processedRecords = 0
      
      for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize
        const endIdx = Math.min(startIdx + batchSize, transformedData.length)
        const batchData = transformedData.slice(startIdx, endIdx)
        
        try {
          const { error } = await supabase
            .from('sites')
            .upsert(batchData, { onConflict: 'site_id' })
            
          if (error) throw error
          
          processedRecords += batchData.length
          state.value.processedBatches = i + 1
          state.value.processedRecords = processedRecords
          state.value.progress = Math.round(((i + 1) / batches) * 100)
        } catch (error) {
          console.error(`Error processing batch ${i+1}:`, error)
          throw error
        }
      }
      
      state.value.status = 'complete'
      state.value.progress = 100
      
      return { success: true, processedRecords }
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
