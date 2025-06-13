// stores/fileUploadStore.ts
import { ref } from 'vue'

export interface FileDataRow {
  [key: string]: string | number | null;
}

interface UploadedData {
  fileData: FileDataRow[];
  headers: string[];
  fileName: string;
}

// Create a reactive state that persists during the session
export const useFileUploadStore = () => {
  // State is created only once and reused across imports
  const state = useState<UploadedData>('fileUploadData', () => ({
    fileData: [],
    headers: [],
    fileName: ''
  }))

  const setUploadedData = (data: FileDataRow[], fileName: string) => {
    const headers = data.length > 0 ? Object.keys(data[0]) : []
    
    state.value = {
      fileData: data,
      headers,
      fileName
    }
  }

  const addBatchData = (batch: FileDataRow[]) => {
    if (batch.length > 0 && state.value.headers.length === 0) {
      state.value.headers = Object.keys(batch[0])
    }
    
    state.value.fileData = [...state.value.fileData, ...batch]
  }

  const resetData = () => {
    state.value = {
      fileData: [],
      headers: [],
      fileName: ''
    }
  }

  return {
    uploadedData: readonly(state),
    setUploadedData,
    addBatchData,
    resetData
  }
}