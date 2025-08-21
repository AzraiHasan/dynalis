// composables/useResetDemo.ts
import { ref } from 'vue'
import { useState } from '#app'
import { useSiteService } from '~/utils/supabaseService'

interface ResetDemoService {
  resetDemo: () => Promise<void>
  isResetting: Ref<boolean>
  resetProgress: Ref<number>
  resetStatus: Ref<string>
}

export const useResetDemo = (): ResetDemoService => {
  const siteService = useSiteService()
  const isResetting = ref(false)
  const resetProgress = ref(0)
  const resetStatus = ref('')

  const clearSupabaseData = async () => {
    resetStatus.value = 'Clearing database tables...'
    
    try {
      await siteService.clearAllDemoData()
      resetProgress.value = 40 // 40% for database clearing
      resetStatus.value = 'Database cleared successfully'
      console.log('Successfully cleared all available database tables')
    } catch (error) {
      console.error('Failed to clear database:', error)
      resetStatus.value = 'Database clearing failed'
      throw error
    }
  }

  const clearLocalStorage = () => {
    resetStatus.value = 'Clearing local storage...'
    
    const keysToRemove = [
      'uploadedFileData',
      'background_job_id', 
      'dashboard_building',
      'sidebar-collapsed'
    ]

    // Clear specific keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`Removed localStorage key: ${key}`)
    })

    // Clear pattern-based keys (bg_upload_*)
    const allKeys = Object.keys(localStorage)
    const bgUploadKeys = allKeys.filter(key => key.startsWith('bg_upload_'))
    bgUploadKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log(`Removed localStorage key: ${key}`)
    })

    resetProgress.value = 60 // 60% after local storage
  }

  const clearApplicationState = () => {
    resetStatus.value = 'Resetting application state...'
    
    try {
      // Clear all Nuxt useState cache
      const stateKeys = [
        'site-data',
        'site-data-loading', 
        'site-data-error',
        'site-data-timestamp',
        'upload-state',
        'file-upload-state'
      ]

      stateKeys.forEach(key => {
        const state = useState(key, () => null)
        if (key.includes('loading')) {
          state.value = false
        } else if (key.includes('error')) {
          state.value = null
        } else if (key.includes('timestamp')) {
          state.value = 0
        } else {
          state.value = null
        }
        console.log(`Reset state: ${key}`)
      })

      resetProgress.value = 80 // 80% after state clearing
    } catch (error) {
      console.error('Error clearing application state:', error)
      throw error
    }
  }

  const resetDemo = async () => {
    if (isResetting.value) {
      console.warn('Reset already in progress')
      return
    }

    try {
      isResetting.value = true
      resetProgress.value = 0
      resetStatus.value = 'Starting reset...'

      // Step 1: Clear Supabase data (40% of progress)
      await clearSupabaseData()

      // Step 2: Clear local storage (20% of progress) 
      clearLocalStorage()

      // Step 3: Clear application state (20% of progress)
      clearApplicationState()

      // Step 4: Final cleanup (20% of progress)
      resetStatus.value = 'Finalizing reset...'
      resetProgress.value = 90

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500))

      resetProgress.value = 100
      resetStatus.value = 'Reset completed successfully!'

      console.log('Demo reset completed successfully')

      // Auto-clear status after success and force refresh
      setTimeout(() => {
        resetStatus.value = ''
        resetProgress.value = 0
        
        // Force a complete page refresh to ensure UI updates
        if (process.client) {
          window.location.reload()
        }
      }, 1500)

    } catch (error) {
      console.error('Reset demo failed:', error)
      resetStatus.value = `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      
      // Keep error visible longer
      setTimeout(() => {
        resetStatus.value = ''
        resetProgress.value = 0
      }, 5000)
      
      throw error
    } finally {
      isResetting.value = false
    }
  }

  return {
    resetDemo,
    isResetting,
    resetProgress,
    resetStatus
  }
}