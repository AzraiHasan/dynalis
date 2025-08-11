// composables/useFileUpload.ts
import { ref, computed } from 'vue'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

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
      
      // Check file size and warn for large files
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > 50) {
        console.warn(`[File Upload] Large file detected: ${fileSizeMB.toFixed(2)} MB. Processing may take longer.`)
      }
      
      // Parse the file with optimized streaming
      const data = await parseFile(file)
      uploadState.value.status = 'uploading'
      
      // Use larger batch sizes for better performance but smaller memory footprint
      const batchSize = Math.min(500, Math.max(50, Math.floor(10000 / Math.max(1, Object.keys(data[0] || {}).length))))
      const batches = Math.ceil(data.length / batchSize)
      uploadState.value.totalChunks = batches
      
      console.log(`[File Upload] Processing ${data.length} rows in ${batches} batches of ${batchSize} records each`)
      
      // Clear any existing stored data before processing
      localStorage.removeItem('uploadedFileData')
      
      for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize
        const endIdx = Math.min(startIdx + batchSize, data.length)
        const batchData = data.slice(startIdx, endIdx)
        
        // Process this batch
        await processBatch(batchData)
        
        uploadState.value.chunksUploaded++
        uploadState.value.progress = 80 + Math.floor((i + 1) / batches * 20)
        
        // Allow UI to update between batches
        await new Promise(resolve => setTimeout(resolve, 0))
        
        // Memory cleanup hint every 10 batches
        if ((i + 1) % 10 === 0) {
          if (typeof window !== 'undefined' && (window as unknown as { gc?: () => void }).gc) {
            (window as unknown as { gc: () => void }).gc()
          }
        }
      }
      
      uploadState.value.status = 'complete'
      uploadState.value.progress = 100
      uploadState.value.processedRecords = data.length
      
      console.log(`[File Upload] Upload completed: ${data.length} records processed successfully`)
      return data
    } catch (error) {
      uploadState.value.status = 'error'
      uploadState.value.error = error instanceof Error ? error : new Error(String(error))
      console.error('[File Upload] Upload failed:', error)
      throw error
    }
  }
  
  const parseFile = async (file: File): Promise<FileDataRow[]> => {
    return new Promise((resolve, reject) => {
      const fileExt = file.name.toLowerCase().split('.').pop()
      
      if (fileExt === 'csv') {
        // Use streaming parser for large CSV files
        const results: FileDataRow[] = []
        let rowCount = 0
        const maxRows = 50000 // Limit to prevent memory issues
        
        Papa.parse(file, {
          header: true,
          chunk: (chunk) => {
            // Process chunk by chunk to avoid loading entire file into memory
            const chunkData = chunk.data as FileDataRow[]
            
            // Filter out empty rows and apply row limit
            const validRows = chunkData.filter(row => {
              const hasData = Object.values(row).some(value => 
                value !== null && value !== undefined && value !== ''
              )
              return hasData && rowCount < maxRows
            })
            
            results.push(...validRows)
            rowCount += validRows.length
            
            // Update progress
            uploadState.value.progress = Math.min(20 + (rowCount / maxRows) * 60, 80)
            
            // Stop processing if we hit the limit
            if (rowCount >= maxRows) {
              console.warn(`[File Parser] Row limit reached: ${maxRows}. Some data may be truncated.`)
              return false // Stop parsing
            }
          },
          complete: () => {
            console.log(`[File Parser] CSV parsing completed: ${results.length} rows processed`)
            resolve(results)
          },
          error: (error) => reject(error),
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(), // Clean headers
        })
      } else {
        // Excel file - still needs to load entirely but with memory monitoring
        console.log(`[File Parser] Starting Excel parsing for file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
        
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            if (!e.target) {
              reject(new Error('Failed to read file'))
              return
            }
            
            const data = e.target.result
            const workbook = XLSX.read(data as ArrayBuffer, { 
              type: 'array',
              cellDates: false, // Prevent automatic date parsing which can be memory intensive
              cellNF: false, // Skip number formatting
            })
            
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
            
            // Convert with row limit to prevent memory issues
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { 
              raw: false,
              header: 1, // Use array of arrays first to check length
              blankrows: false
            })
            
            // Limit rows and convert to proper format
            const maxRows = 50000
            const limitedData = jsonData.slice(0, maxRows + 1) // +1 for header
            
            if (limitedData.length > maxRows) {
              console.warn(`[File Parser] Excel row limit reached: ${maxRows}. Some data may be truncated.`)
              limitedData.splice(maxRows + 1)
            }
            
            // Convert back to object format using first row as headers
            const firstRow = limitedData[0]
            if (!firstRow || !Array.isArray(firstRow)) {
              reject(new Error('Invalid Excel data format: first row is not an array'))
              return
            }
            
            const headers = (firstRow as unknown[]).map(h => String(h || ''))
            const processedData = limitedData.slice(1).map(row => {
              const rowData: FileDataRow = {}
              if (Array.isArray(row)) {
                headers.forEach((header, index) => {
                  if (header && header.trim()) {
                    const value = (row as unknown[])[index]
                    rowData[header.trim()] = value === undefined || value === '' ? null : value as string | number | null
                  }
                })
              }
              return rowData
            })
            
            console.log(`[File Parser] Excel parsing completed: ${processedData.length} rows processed`)
            resolve(processedData as FileDataRow[])
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