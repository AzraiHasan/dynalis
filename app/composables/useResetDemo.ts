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
    console.log('🚀 [RESET] Starting database clearing process')
    
    try {
      console.log('🔄 [RESET] Calling siteService.clearAllDemoData()')
      await siteService.clearAllDemoData()
      resetProgress.value = 40 // 40% for database clearing
      resetStatus.value = 'Database cleared successfully'
      console.log('✅ [RESET] Successfully cleared all available database tables')
      console.log('🎯 [RESET] Sites table clearing should be complete at this point')
    } catch (error) {
      console.error('❌ [RESET] Failed to clear database:', error)
      console.error('🚨 [RESET] Database clearing error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      })
      resetStatus.value = 'Database clearing failed'
      throw error
    }
  }

  const clearLocalStorage = () => {
    console.log('🔄 [RESET] Starting local storage clearing')
    resetStatus.value = 'Clearing local storage...'
    
    const keysToRemove = [
      'uploadedFileData',
      'background_job_id', 
      'dashboard_building',
      'sidebar-collapsed'
    ]

    console.log('📋 [RESET] Keys to remove from localStorage:', keysToRemove)
    // Clear specific keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✅ [RESET] Removed localStorage key: ${key}`)
    })

    // Clear pattern-based keys (bg_upload_*)
    const allKeys = Object.keys(localStorage)
    const bgUploadKeys = allKeys.filter(key => key.startsWith('bg_upload_'))
    console.log('🔍 [RESET] Found bg_upload_* keys:', bgUploadKeys)
    bgUploadKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✅ [RESET] Removed localStorage key: ${key}`)
    })

    resetProgress.value = 60 // 60% after local storage
    console.log('✅ [RESET] Local storage clearing completed')
  }

  const clearApplicationState = () => {
    console.log('🔄 [RESET] Starting application state clearing')
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

      console.log('📋 [RESET] Application state keys to reset:', stateKeys)
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
        console.log(`✅ [RESET] Reset state: ${key}`)
      })

      resetProgress.value = 80 // 80% after state clearing
      console.log('✅ [RESET] Application state clearing completed')
    } catch (error) {
      console.error('❌ [RESET] Error clearing application state:', error)
      throw error
    }
  }

  const resetDemo = async () => {
    if (isResetting.value) {
      console.warn('⚠️ [RESET] Reset already in progress')
      return
    }

    try {
      console.log('🚀 [RESET] ===================================================')
      console.log('🚀 [RESET] STARTING COMPLETE DEMO RESET OPERATION')
      console.log('🚀 [RESET] ===================================================')
      
      isResetting.value = true
      resetProgress.value = 0
      resetStatus.value = 'Starting reset...'

      // Step 1: Clear Supabase data (40% of progress)
      console.log('🔄 [RESET] STEP 1: Clearing Supabase database data')
      await clearSupabaseData()
      console.log('✅ [RESET] STEP 1 COMPLETED: Database clearing finished')

      // Step 2: Clear local storage (20% of progress) 
      console.log('🔄 [RESET] STEP 2: Clearing local storage')
      clearLocalStorage()
      console.log('✅ [RESET] STEP 2 COMPLETED: Local storage cleared')

      // Step 3: Clear application state (20% of progress)
      console.log('🔄 [RESET] STEP 3: Clearing application state')
      clearApplicationState()
      console.log('✅ [RESET] STEP 3 COMPLETED: Application state cleared')

      // Step 4: Final cleanup (20% of progress)
      console.log('🔄 [RESET] STEP 4: Finalizing reset')
      resetStatus.value = 'Finalizing reset...'
      resetProgress.value = 90

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500))

      resetProgress.value = 100
      resetStatus.value = 'Reset completed successfully!'

      console.log('✅ [RESET] Demo reset completed successfully')
      console.log('🎯 [RESET] ALL STEPS COMPLETED - Sites table should be empty now')
      console.log('🚀 [RESET] ===================================================')

      // Auto-clear status after success and force refresh
      setTimeout(() => {
        resetStatus.value = ''
        resetProgress.value = 0
        
        // Force a complete page refresh to ensure UI updates
        if (import.meta.client) {
          window.location.reload()
        }
      }, 1500)

    } catch (error) {
      console.error('❌ [RESET] Reset demo failed:', error)
      console.error('🚨 [RESET] RESET FAILURE - Full error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      })
      console.error('🚨 [RESET] ===================================================')
      resetStatus.value = `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      
      // Keep error visible longer
      setTimeout(() => {
        resetStatus.value = ''
        resetProgress.value = 0
      }, 5000)
      
      throw error
    } finally {
      isResetting.value = false
      console.log('🏁 [RESET] Reset operation finished (cleanup phase)')
    }
  }

  return {
    resetDemo,
    isResetting,
    resetProgress,
    resetStatus
  }
}