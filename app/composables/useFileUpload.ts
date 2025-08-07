// composables/useFileUpload.ts
import { ref, computed } from 'vue'
import { useSupabaseClient } from '#imports'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parseDate } from '~/utils/dateUtils'

// Define interfaces
interface UploadState {
  uploadId: string;
  status: 'idle' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  error: Error | null;
  filename: string;
  totalChunks: number;
  chunksUploaded: number;
  processedRecords: number;
}

interface FileDataRow {
  [key: string]: string | number | null;
}

export const useFileUpload = () => {
  const supabase = useSupabaseClient()
  const uploadState = ref<UploadState>({
    uploadId: '',
    status: 'idle',
    progress: 0,
    error: null,
    filename: '',
    totalChunks: 0,
    chunksUploaded: 0,
    processedRecords: 0
  })
  
  const isUploading = computed(() => 
    ['preparing', 'uploading', 'processing'].includes(uploadState.value.status)
  )
  
  const processAndUpload = async (file: File): Promise<FileDataRow[]> => {
    try {
      // Reset state
      uploadState.value = {
        uploadId: crypto.randomUUID(),
        status: 'preparing',
        progress: 5,
        error: null,
        filename: file.name,
        totalChunks: 0,
        chunksUploaded: 0,
        processedRecords: 0
      }
      
      // Parse the file
      const data = await parseFile(file)
      uploadState.value.status = 'uploading'
      
      // Process in batches to avoid memory issues
      const batchSize = 100
      const batches = Math.ceil(data.length / batchSize)
      uploadState.value.totalChunks = batches
      
      for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize
        const endIdx = Math.min(startIdx + batchSize, data.length)
        const batchData = data.slice(startIdx, endIdx)
        
        // Process this batch
        await processBatch(batchData)
        
        uploadState.value.chunksUploaded++
        uploadState.value.progress = 5 + Math.floor((i + 1) / batches * 90)
      }
      
      uploadState.value.status = 'complete'
      uploadState.value.progress = 100
      uploadState.value.processedRecords = data.length
      
      return data
    } catch (error) {
      uploadState.value.status = 'error'
      uploadState.value.error = error instanceof Error ? error : new Error(String(error))
      throw error
    }
  }
  
  const parseFile = async (file: File): Promise<FileDataRow[]> => {
    return new Promise((resolve, reject) => {
      const fileExt = file.name.toLowerCase().split('.').pop()
      
      if (fileExt === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: (results) => resolve(results.data as FileDataRow[]),
          error: (error) => reject(error)
        })
      } else {
        // Excel file
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            if (!e.target) {
              reject(new Error('Failed to read file'))
              return
            }
            
            const data = e.target.result
            // Fix XLSX.read typing by explicitly casting data to ArrayBuffer
            const workbook = XLSX.read(data as ArrayBuffer, { type: 'array' })
            const firstSheet = workbook.SheetNames[0]
            if (!firstSheet) {
              reject(new Error('No worksheet found in Excel file'))
              return
            }
            
            const worksheet = workbook.Sheets[firstSheet]
            if (!worksheet) {
              reject(new Error('Worksheet is empty or invalid'))
              return
            }
            
            // Now we're sure worksheet is not undefined
            const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { raw: false })
            resolve(jsonData as FileDataRow[])
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      }
    })
  }
  
  const processBatch = async (batch: FileDataRow[]): Promise<FileDataRow[]> => {
    // Save in localStorage instead of using Supabase directly for now
    const storedData = localStorage.getItem('uploadedFileData')
    const existingData = storedData ? JSON.parse(storedData) : { fileData: [], headers: [] }
    
    if (batch.length > 0 && existingData.headers.length === 0) {
      // Fix: Add a check or fallback for batch[0]
      const firstRow = batch[0];
      if (firstRow) {
        existingData.headers = Object.keys(firstRow);
      }
    }
    
    existingData.fileData = [...existingData.fileData, ...batch]
    existingData.fileName = uploadState.value.filename
    
    localStorage.setItem('uploadedFileData', JSON.stringify(existingData))
    
    return batch
  }
  
  return {
    processAndUpload,
    uploadState,
    isUploading,
    progress: computed(() => uploadState.value.progress)
  }
}