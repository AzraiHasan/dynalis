// composables/useUploadState.ts
export const useUploadState = () => {
  const isUploading = ref(false)
  const progress = ref(0)
  const status = ref<'idle' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'error'>('idle')
  const statusMessage = ref('')
  const error = ref<Error | null>(null)
  
  const startUpload = () => {
    isUploading.value = true
    progress.value = 0
    status.value = 'preparing'
    statusMessage.value = 'Preparing data...'
    error.value = null
  }
  
  const updateProgress = (newProgress: number, message?: string) => {
    progress.value = newProgress
    if (message) statusMessage.value = message
  }
  
  const finishUpload = () => {
    progress.value = 100
    status.value = 'complete'
    statusMessage.value = 'Upload complete!'
    setTimeout(() => {
      isUploading.value = false
    }, 1500)
  }
  
  const setError = (err: Error) => {
    error.value = err
    status.value = 'error'
    statusMessage.value = `Error: ${err.message}`
  }
  
  return {
    isUploading,
    progress,
    status,
    statusMessage,
    error,
    startUpload,
    updateProgress,
    finishUpload,
    setError
  }
}