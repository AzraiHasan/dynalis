// composables/useFileUpload.ts
import { ref, computed } from 'vue'
import { useSupabaseClient } from '#imports'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parseDate } from '~/utils/dateUtils'

export const useFileUpload = () => {
  const supabase = useSupabaseClient()
  const uploadState = ref({
    uploadId: '',
    status: 'idle', // idle, preparing, uploading, processing, complete, error
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
  
  const processAndUpload = async (file) => {
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
      uploadState.value.error = error
      throw error
    }
  }
  
  const parseFile = async (file) => {
    return new Promise((resolve, reject) => {
      const fileExt = file.name.toLowerCase().split('.').pop()
      
      if (fileExt === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error)
        })
      } else {
        // Excel file
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = e.target.result
            const workbook = XLSX.read(data, { type: 'array' })
            const firstSheet = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheet]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false })
            resolve(jsonData)
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      }
    })
  }
  
  const processBatch = async (batch) => {
    // Save in localStorage instead of using Supabase directly for now
    const storedData = localStorage.getItem('uploadedFileData')
    const existingData = storedData ? JSON.parse(storedData) : { fileData: [], headers: [] }
    
    if (batch.length > 0 && existingData.headers.length === 0) {
      existingData.headers = Object.keys(batch[0])
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